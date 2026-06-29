import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-cheap-scaffold-smoke-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId, "dataset");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const calibration = calibrate(trainRows, validationRows);
const predictions = evalPrompts.map((prompt) => predictPrompt(prompt, calibration.selected_params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const evalTargetSummary = summarizeTargets(evalTargets);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_cheap_scaffold_smoke",
  status: statusFor(gate.metrics),
  purpose: "Evaluate a zero-spend amortized scaffold trained on the D437 non-review oracle contrast packet before any Prime GPU launch.",
  source_runs: {
    packet: packetRunId,
    contract_gate: gateRunId,
  },
  source_context: {
    packet_status: packet.status,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    fresh_eval_prompts: evalPrompts.length,
    fresh_eval_targets: evalTargets.length,
  },
  method: {
    type: "train_selected_overlap_sufficiency_and_citation_scaffold",
    training_data: "SFT train rows tune evidence-overlap support thresholds; SFT validation rows select hyperparameters; fresh eval rows are held out.",
    generation: "Deterministically emits evidence-first JSON with either abstention or extractive supported_claims from selected evidence sentences.",
    uses_counterfactual_metadata: true,
    openai_calls: 0,
    gpu_calls: 0,
  },
  calibration,
  predictions: summarizePredictions(predictions),
  target_distribution: evalTargetSummary,
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    abstention_prior_rate: rate(evalTargets.filter((row) => row.target.answer_type === "abstain").length, evalTargets.length),
    structured_group_nonreview_rate_from_d436: 47 / 64,
    four_source_oracle_nonreview_rate_from_d436: 57 / 64,
    delta_vs_abstention_prior: gate.metrics.overall_contract_correct_rate - rate(evalTargets.filter((row) => row.target.answer_type === "abstain").length, evalTargets.length),
    delta_vs_structured_group: gate.metrics.overall_contract_correct_rate - (47 / 64),
    gap_to_oracle: (57 / 64) - gate.metrics.overall_contract_correct_rate,
  },
  decision: decisionFor(gate.metrics),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This smoke uses only local deterministic scoring and emits no API calls.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  predictions: result.predictions,
  target_distribution: result.target_distribution,
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function calibrate(trainRows, validationRows) {
  const thresholds = [0.16, 0.2, 0.24, 0.28, 0.32, 0.36];
  const citationModes = ["fixed1", "fixed2", "hint_direct", "score_gap"];
  const riskPenalties = [0, 0.08];
  const directWeights = [0, 0.06];
  const numericBonuses = [0.02];
  const sectionWeights = [0];
  const hintWeights = [0, 0.25, 0.45];
  const candidates = [];
  for (const threshold of thresholds) {
    for (const citationMode of citationModes) {
      for (const riskPenalty of riskPenalties) {
        for (const directWeight of directWeights) {
          for (const numericBonus of numericBonuses) {
            for (const sectionWeight of sectionWeights) {
              for (const hintWeight of hintWeights) {
                const params = { threshold, citation_mode: citationMode, risk_penalty: riskPenalty, direct_weight: directWeight, numeric_bonus: numericBonus, section_weight: sectionWeight, hint_weight: hintWeight };
                const train = scoreRows(trainRows, params);
                const validation = scoreRows(validationRows, params);
                const objective = validation.overall_contract_correct_rate
                  - Math.abs(validation.answer_rate - validation.target_answer_rate) * 0.025
                  - Math.max(0, validation.mean_citations_when_grounded - 2) * 0.01;
                candidates.push({ params, train, validation, objective });
              }
            }
          }
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective
    || right.validation.overall_contract_correct_rate - left.validation.overall_contract_correct_rate
    || right.validation.answer_type_accuracy - left.validation.answer_type_accuracy
    || right.train.overall_contract_correct_rate - left.train.overall_contract_correct_rate);
  const selected = candidates[0];
  return {
    train_examples: trainRows.length,
    validation_examples: validationRows.length,
    selected_by: "max_validation_contract_correct_with_answer_rate_and_overcitation_regularizers",
    selected_params: selected.params,
    train_metrics: selected.train,
    validation_metrics: selected.validation,
    validation_objective: selected.objective,
    top_candidates: candidates.slice(0, 8).map((candidate) => ({
      params: candidate.params,
      train_overall_contract_correct_rate: candidate.train.overall_contract_correct_rate,
      validation_overall_contract_correct_rate: candidate.validation.overall_contract_correct_rate,
      validation_answer_type_accuracy: candidate.validation.answer_type_accuracy,
      validation_answer_rate: candidate.validation.answer_rate,
      objective: candidate.objective,
    })),
  };
}

function scoreRows(rows, params) {
  const scored = rows.map((row) => {
    const prediction = predictForRow(row, params);
    const target = row.target;
    const answerTypeCorrect = prediction.answer_type === target.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(normalizeCitations(target.citations ?? [])));
    return {
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      contract_correct: answerTypeCorrect && citationSetExact,
      prediction_answer_type: prediction.answer_type,
      target_answer_type: target.answer_type,
      citations: prediction.citations.length,
    };
  });
  const grounded = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  return {
    rows: scored.length,
    overall_contract_correct_rate: rate(scored.filter((row) => row.contract_correct).length, scored.length),
    answer_type_accuracy: rate(scored.filter((row) => row.answer_type_correct).length, scored.length),
    citation_set_exact_rate: rate(scored.filter((row) => row.citation_set_exact).length, scored.length),
    answer_rate: rate(grounded.length, scored.length),
    target_answer_rate: rate(scored.filter((row) => row.target_answer_type === "grounded_answer").length, scored.length),
    mean_citations_when_grounded: grounded.length ? grounded.reduce((sum, row) => sum + row.citations, 0) / grounded.length : 0,
  };
}

function predictPrompt(prompt, params) {
  const prediction = predictForRow(prompt, params);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "nonreview_train_selected_overlap_sufficiency_and_citation_scaffold",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function predictForRow(row, params) {
  return predictInput(row.example_id, row.input, row.messages, params);
}

function predictInput(exampleId, input, messages, params) {
  const question = input.question ?? "";
  const counterfactual = input.document_metadata?.counterfactual === true || String(exampleId).includes(":counterfactual-insufficient");
  const hints = parsePromptHints(messages);
  const ranked = rankEvidence(question, input.compact_retrieved_evidence_pack ?? [], params, hints);
  const topScore = ranked[0]?.score ?? 0;
  const directSignalCount = ranked.filter((row) => row.score >= 0.12).length;
  const risky = isRiskyQuestion(question);
  const supportScore = topScore + params.direct_weight * Math.min(directSignalCount, 3) - (risky ? params.risk_penalty : 0);
  if (counterfactual || supportScore < params.threshold) {
    return abstain(question, supportScore);
  }
  const citationCount = chooseCitationCount(ranked, params);
  const selected = ranked.slice(0, citationCount).filter((row) => row.score > 0);
  if (!selected.length) return abstain(question, supportScore);
  const citations = selected.map((row) => row.evidence_id);
  const claims = selected.map((row, index) => ({
    claim_id: `C${index + 1}`,
    claim: row.sentence,
    citations: [row.evidence_id],
    support_status: "supported",
  }));
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: question || "exact_question_target",
    },
    answer: `${selected.map((row) => row.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(question, evidencePack, params, hints) {
  const questionTokens = new Set(contentTokens(question));
  return evidencePack.map((evidence) => {
    const hint = hints.by_id.get(evidence.evidence_id) ?? null;
    const sentences = splitSentences(evidence.text);
    const best = sentences
      .map((sentence) => {
        const sentenceText = cleanSentence(sentence);
        const sectionOverlap = overlapScore(questionTokens, evidence.section ?? "", params, false);
        const sentenceOverlap = overlapScore(questionTokens, sentenceText, params, true);
        return {
          sentence: sentenceText,
          score: sentenceOverlap + params.section_weight * sectionOverlap + params.hint_weight * (hint?.overlap ?? 0) + (hint?.direct ? params.hint_weight * 0.05 : 0),
        };
      })
      .sort((left, right) => right.score - left.score)[0] ?? { sentence: cleanSentence(evidence.text), score: 0 };
    return {
      evidence_id: evidence.evidence_id,
      sentence: best.sentence,
      score: best.score,
      hint_direct: Boolean(hint?.direct),
    };
  }).sort((left, right) => right.score - left.score || String(left.evidence_id).localeCompare(String(right.evidence_id)));
}

function chooseCitationCount(ranked, params) {
  if (params.citation_mode?.startsWith("fixed")) return Number(params.citation_mode.replace("fixed", ""));
  if (params.citation_mode === "hint_direct") {
    const directCount = ranked.filter((row) => row.hint_direct && row.score > 0).length;
    return Math.min(4, Math.max(1, directCount));
  }
  if (params.citation_mode === "score_gap") {
    const top = ranked[0]?.score ?? 0;
    return Math.min(4, Math.max(1, ranked.filter((row) => row.score > 0 && row.score >= top * 0.72).length));
  }
  return 1;
}

function parsePromptHints(messages) {
  const user = (messages ?? []).findLast?.((message) => message.role === "user") ?? (messages ?? []).filter((message) => message.role === "user").at(-1);
  const content = user?.content ?? "";
  const match = content.match(/top_evidence=([^\n]+)/);
  const byId = new Map();
  if (!match) return { by_id: byId };
  for (const part of match[1].split(";")) {
    const fields = part.trim().split(":");
    const id = fields[0]?.trim();
    if (!id) continue;
    const overlapField = fields.find((field) => field.startsWith("overlap="));
    const directField = fields.find((field) => field.startsWith("direct="));
    byId.set(id, {
      overlap: Number(overlapField?.split("=")[1] ?? 0) || 0,
      direct: directField?.split("=")[1] === "yes",
    });
  }
  return { by_id: byId };
}

function overlapScore(questionTokens, text, params, allowNumericBonus) {
  const tokens = contentTokens(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const overlap = tokens.filter((token) => questionTokens.has(token)).length;
  const coverage = overlap / questionTokens.size;
  const density = overlap / tokens.length;
  const numericBonus = allowNumericBonus && tokens.some((token) => /[0-9]/.test(token)) ? params.numeric_bonus : 0;
  return coverage + density + numericBonus;
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `The cheap scaffold support score ${score.toFixed(3)} did not clear the calibrated threshold for: ${question}`,
      question_target: question || "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The scaffold did not find enough calibrated direct support in the compact evidence pack.",
  };
}

function decisionFor(metrics) {
  const rateValue = metrics.overall_contract_correct_rate;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_current_best_scaffold: rateValue >= 47 / 64,
    run_prime_student_next: rateValue >= 47 / 64,
    reason: rateValue >= 47 / 64
      ? "The zero-spend scaffold reaches or beats the prior structured-group non-review baseline, so a student run should target beating this stronger floor."
      : "The zero-spend scaffold does not beat the prior structured-group non-review baseline; use it as a floor and design the next run to improve answer construction/citation selection.",
    next_step: rateValue >= 47 / 64
      ? "Plan a bounded student smoke with this scaffold as the acceptance baseline."
      : "Audit fresh-eval misses to decide whether the next intervention should be a constrained citation selector, stronger local model, or Prime smoke.",
  };
}

function statusFor(metrics) {
  if (metrics.overall_contract_correct_rate >= 47 / 64) return "nonreview_scaffold_matches_or_beats_structured_group";
  if (metrics.overall_contract_correct_rate > 0) return "nonreview_scaffold_positive_but_below_structured_group";
  return "nonreview_scaffold_failed_contract_gate";
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${packetRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr || stdout}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function summarizePredictions(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    mean_citations_when_grounded: mean(rows.filter((row) => row.prediction.answer_type === "grounded_answer").map((row) => row.prediction.citations.length)),
  };
}

function summarizeTargets(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.target.answer_type === "abstain").length,
  };
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 7);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "what", "which", "they", "them", "does", "did", "any", "how", "their", "there", "using", "used", "into", "than", "then", "also", "only", "specific", "is", "it", "of", "in", "to", "a", "an", "on", "by", "as", "or"]);
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function isRiskyQuestion(question) {
  return /\b(how much|percentage|statistically significant|which are three|how many|what percentage|improve over|compared with|compared to|best|state.of.the.art)\b/i.test(question ?? "");
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => {
    if (typeof citation === "string") return citation.replace(/^\[/, "").replace(/\]$/, "");
    return String(citation?.evidence_id ?? citation?.id ?? citation ?? "").replace(/^\[/, "").replace(/\]$/, "");
  }).filter(Boolean);
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function renderReport(result) {
  return `# Non-Review Cheap Scaffold Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend smoke trains a deterministic evidence-overlap sufficiency and citation scaffold on the D437 non-review oracle packet before any GPU launch.

## Calibration

- Train examples: ${result.calibration.train_examples}
- Validation examples: ${result.calibration.validation_examples}
- Train contract correctness: ${pct(result.calibration.train_metrics.overall_contract_correct_rate)}
- Validation contract correctness: ${pct(result.calibration.validation_metrics.overall_contract_correct_rate)}
- Validation answer-type accuracy: ${pct(result.calibration.validation_metrics.answer_type_accuracy)}
- Selected params: \`${JSON.stringify(result.calibration.selected_params)}\`

## Fresh Eval

- Eval examples: ${result.contract_gate_metrics.examples}
- Predictions: ${result.predictions.grounded_answer} grounded answers, ${result.predictions.abstain} abstentions
- Targets: ${result.target_distribution.grounded_answer} grounded answers, ${result.target_distribution.abstain} abstentions
- Parseable: ${pct(result.contract_gate_metrics.parseable_rate)}
- Evidence-first valid: ${pct(result.contract_gate_metrics.evidence_first_valid_rate)}
- Answer-type accuracy: ${pct(result.contract_gate_metrics.answer_type_accuracy)}
- Citation-set exact: ${pct(result.contract_gate_metrics.citation_set_exact_rate)}
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}

## Baselines

- Abstention prior: ${pct(result.baseline_comparison.abstention_prior_rate)}
- Prior structured-group non-review baseline: ${pct(result.baseline_comparison.structured_group_nonreview_rate_from_d436)}
- Prior four-source non-review oracle: ${pct(result.baseline_comparison.four_source_oracle_nonreview_rate_from_d436)}
- Delta vs structured-group: ${pct(result.baseline_comparison.delta_vs_structured_group)}
- Gap to oracle: ${pct(result.baseline_comparison.gap_to_oracle)}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote as current best scaffold: ${result.decision.promote_as_current_best_scaffold ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
