import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "nonreview-oracle-contrast-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "nonreview-citation-selector-smoke-2026-06-29-v1";
const packetDir = path.join(runsDir, packetRunId, "dataset");
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const trainRows = await readJsonl(path.join(packetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(packetDir, "sft_validation.jsonl"));
const evalPrompts = await readJsonl(path.join(packetDir, "eval_prompts.jsonl"));
const evalTargets = await readJsonl(path.join(packetDir, "eval_targets_diagnostic.jsonl"));

const calibration = calibrate(trainRows, validationRows);
const predictions = evalPrompts.map((row) => predictRow(row, calibration.selected_params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "nonreview_citation_selector_smoke",
  status: statusFor(gate.metrics),
  purpose: "Test whether a train/validation-selected citation selector can recover the D437 non-review fresh-eval citation gap without LLM or GPU spend.",
  source_runs: {
    packet: packetRunId,
    contract_gate: gateRunId,
  },
  source_context: {
    packet_status: packet.status,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    eval_prompts: evalPrompts.length,
    eval_targets: evalTargets.length,
  },
  method: {
    type: "deterministic_train_selected_evidence_support_selector",
    answerability: "Calibrated evidence-support threshold with counterfactual abstention guard.",
    citation_selection: "Evidence-level support score with learned weights over question overlap, prompt hints, retrieval rank, numeric overlap, section/title overlap, and citation count mode.",
    supervision: "SFT train targets tune parameters; SFT validation targets select parameters; fresh eval targets are held out for reporting only.",
    uses_counterfactual_metadata: true,
    openai_calls: 0,
    gpu_calls: 0,
  },
  calibration,
  predictions: summarizePredictions(predictions),
  target_distribution: summarizeTargets(evalTargets),
  contract_gate_metrics: gate.metrics,
  baseline_comparison: {
    abstention_prior_rate: rate(evalTargets.filter((row) => row.target.answer_type === "abstain").length, evalTargets.length),
    cheap_scaffold_d439_rate: 37 / 64,
    structured_group_nonreview_rate_from_d436: 47 / 64,
    four_source_oracle_nonreview_rate_from_d436: 57 / 64,
    delta_vs_d439: gate.metrics.overall_contract_correct_rate - (37 / 64),
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
    note: "Local deterministic selector only. No OpenAI, Prime, or other model calls.",
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
  contract_gate_metrics: result.contract_gate_metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function calibrate(trainRows, validationRows) {
  const thresholds = [0.2, 0.26, 0.32, 0.4];
  const citationModes = ["top1", "top2", "positive_margin", "hint_direct"];
  const overlapWeights = [1];
  const hintWeights = [0, 0.45, 0.85];
  const rankWeights = [0, 0.06];
  const sectionWeights = [0];
  const numericWeights = [0.08];
  const riskyPenalties = [0, 0.08];
  const directBonuses = [0.08];
  const candidates = [];
  for (const threshold of thresholds) {
    for (const citationMode of citationModes) {
      for (const overlapWeight of overlapWeights) {
        for (const hintWeight of hintWeights) {
          for (const rankWeight of rankWeights) {
            for (const sectionWeight of sectionWeights) {
              for (const numericWeight of numericWeights) {
                for (const riskyPenalty of riskyPenalties) {
                  for (const directBonus of directBonuses) {
                    const params = { threshold, citation_mode: citationMode, overlap_weight: overlapWeight, hint_weight: hintWeight, rank_weight: rankWeight, section_weight: sectionWeight, numeric_weight: numericWeight, risky_penalty: riskyPenalty, direct_bonus: directBonus };
                    const train = scoreRows(trainRows, params);
                    const validation = scoreRows(validationRows, params);
                    const objective = validation.overall_contract_correct_rate
                      - Math.abs(validation.answer_rate - validation.target_answer_rate) * 0.02
                      - Math.max(0, validation.mean_citations_when_grounded - validation.mean_target_citations_when_grounded) * 0.01;
                    candidates.push({ params, train, validation, objective });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective
    || right.validation.overall_contract_correct_rate - left.validation.overall_contract_correct_rate
    || right.validation.citation_set_exact_rate - left.validation.citation_set_exact_rate
    || right.validation.answer_type_accuracy - left.validation.answer_type_accuracy
    || right.train.overall_contract_correct_rate - left.train.overall_contract_correct_rate);
  const selected = candidates[0];
  return {
    train_examples: trainRows.length,
    validation_examples: validationRows.length,
    selected_by: "validation_contract_correct_with_answer_rate_and_overcitation_regularizers",
    selected_params: selected.params,
    train_metrics: selected.train,
    validation_metrics: selected.validation,
    validation_objective: selected.objective,
    top_candidates: candidates.slice(0, 10).map((candidate) => ({
      params: candidate.params,
      train_overall_contract_correct_rate: candidate.train.overall_contract_correct_rate,
      validation_overall_contract_correct_rate: candidate.validation.overall_contract_correct_rate,
      validation_answer_type_accuracy: candidate.validation.answer_type_accuracy,
      validation_citation_set_exact_rate: candidate.validation.citation_set_exact_rate,
      validation_answer_rate: candidate.validation.answer_rate,
      objective: candidate.objective,
    })),
  };
}

function scoreRows(rows, params) {
  const scored = rows.map((row) => {
    const prediction = buildPrediction(row, params);
    const target = row.target;
    const targetCitations = normalizeCitations(target.citations ?? []);
    const answerTypeCorrect = prediction.answer_type === target.answer_type;
    const citationSetExact = prediction.answer_type === "abstain"
      ? prediction.citations.length === 0
      : setEqual(new Set(prediction.citations), new Set(targetCitations));
    return {
      answer_type_correct: answerTypeCorrect,
      citation_set_exact: citationSetExact,
      contract_correct: answerTypeCorrect && citationSetExact,
      prediction_answer_type: prediction.answer_type,
      target_answer_type: target.answer_type,
      citations: prediction.citations.length,
      target_citations: targetCitations.length,
    };
  });
  const grounded = scored.filter((row) => row.prediction_answer_type === "grounded_answer");
  const targetGrounded = scored.filter((row) => row.target_answer_type === "grounded_answer");
  return {
    rows: scored.length,
    overall_contract_correct_rate: rate(scored.filter((row) => row.contract_correct).length, scored.length),
    answer_type_accuracy: rate(scored.filter((row) => row.answer_type_correct).length, scored.length),
    citation_set_exact_rate: rate(scored.filter((row) => row.citation_set_exact).length, scored.length),
    answer_rate: rate(grounded.length, scored.length),
    target_answer_rate: rate(targetGrounded.length, scored.length),
    mean_citations_when_grounded: mean(grounded.map((row) => row.citations)),
    mean_target_citations_when_grounded: mean(targetGrounded.map((row) => row.target_citations)),
  };
}

function predictRow(row, params) {
  const prediction = buildPrediction(row, params);
  return {
    example_id: row.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "nonreview_train_selected_citation_selector",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function buildPrediction(row, params) {
  const input = row.input;
  const question = input.question ?? "";
  const counterfactual = input.document_metadata?.counterfactual === true || String(row.example_id).includes(":counterfactual-insufficient");
  const ranked = rankEvidence(row, params);
  const topScore = ranked[0]?.score ?? 0;
  const supportScore = topScore - (isRiskyQuestion(question) ? params.risky_penalty : 0);
  if (counterfactual || supportScore < params.threshold) return abstain(question, supportScore);
  const citations = chooseCitations(ranked, params);
  if (!citations.length) return abstain(question, supportScore);
  const selected = citations.map((id) => ranked.find((candidate) => candidate.evidence_id === id)).filter(Boolean);
  const claims = selected.map((item, index) => ({
    claim_id: `C${index + 1}`,
    claim: item.sentence,
    citations: [item.evidence_id],
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
    answer: `${selected.map((item) => item.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function rankEvidence(row, params) {
  const input = row.input;
  const questionTokens = new Set(contentTokens(input.question));
  const titleTokens = new Set(contentTokens(input.document_metadata?.title ?? ""));
  const hints = parsePromptHints(row.messages);
  return (input.compact_retrieved_evidence_pack ?? []).map((evidence) => {
    const hint = hints.get(evidence.evidence_id) ?? { overlap: 0, direct: false };
    const sentence = bestSentence(questionTokens, evidence.text);
    const sentenceOverlap = overlapScore(questionTokens, sentence);
    const sectionOverlap = overlapScore(questionTokens, evidence.section ?? "");
    const titleOverlap = overlapScore(titleTokens, `${evidence.section ?? ""} ${evidence.text ?? ""}`);
    const numeric = numericOverlap(input.question, evidence.text);
    const rankBonus = params.rank_weight / Math.max(1, Number(evidence.retrieval_rank ?? 9));
    const score = params.overlap_weight * sentenceOverlap
      + params.hint_weight * hint.overlap
      + (hint.direct ? params.direct_bonus : 0)
      + params.section_weight * Math.max(sectionOverlap, titleOverlap)
      + params.numeric_weight * numeric
      + rankBonus;
    return {
      evidence_id: evidence.evidence_id,
      sentence,
      score,
      hint_direct: hint.direct,
      retrieval_rank: Number(evidence.retrieval_rank ?? 9),
    };
  }).sort((left, right) => right.score - left.score || left.retrieval_rank - right.retrieval_rank || String(left.evidence_id).localeCompare(String(right.evidence_id)));
}

function chooseCitations(ranked, params) {
  const positive = ranked.filter((row) => row.score > 0);
  if (!positive.length) return [];
  if (params.citation_mode === "top1") return positive.slice(0, 1).map((row) => row.evidence_id);
  if (params.citation_mode === "top2") return positive.slice(0, 2).map((row) => row.evidence_id);
  if (params.citation_mode === "top3") return positive.slice(0, 3).map((row) => row.evidence_id);
  if (params.citation_mode === "hint_direct") {
    const direct = positive.filter((row) => row.hint_direct).slice(0, 4);
    return (direct.length ? direct : positive.slice(0, 1)).map((row) => row.evidence_id);
  }
  if (params.citation_mode === "count_prior") {
    const top = positive[0];
    const count = top.score > 0.74 ? 1 : top.score > 0.52 ? 2 : 3;
    return positive.slice(0, count).map((row) => row.evidence_id);
  }
  const topScore = positive[0].score;
  return positive.filter((row) => row.score >= Math.max(0.16, topScore - 0.16)).slice(0, 4).map((row) => row.evidence_id);
}

function bestSentence(questionTokens, text) {
  const sentences = splitSentences(text);
  const best = sentences
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: overlapScore(questionTokens, sentence) }))
    .sort((left, right) => right.score - left.score)[0];
  return best?.sentence ?? cleanSentence(text);
}

function overlapScore(questionTokens, text) {
  const tokens = contentTokens(text);
  if (!tokens.length || !questionTokens.size) return 0;
  const overlap = tokens.filter((token) => questionTokens.has(token)).length;
  return overlap / questionTokens.size + overlap / tokens.length;
}

function numericOverlap(leftText, rightText) {
  const left = new Set(String(leftText ?? "").match(/\d+(?:\.\d+)?/g) ?? []);
  if (!left.size) return 0;
  const right = new Set(String(rightText ?? "").match(/\d+(?:\.\d+)?/g) ?? []);
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / left.size;
}

function abstain(question, score) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `The train-selected citation selector support score ${score.toFixed(3)} did not clear the calibrated threshold for: ${question}`,
      question_target: question || "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The selector did not find enough calibrated evidence support in the compact evidence pack.",
  };
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

function parsePromptHints(messages) {
  const users = (messages ?? []).filter((message) => message.role === "user");
  const content = users.at(-1)?.content ?? "";
  const match = content.match(/top_evidence=([^\n]+)/);
  const hints = new Map();
  if (!match) return hints;
  for (const part of match[1].split(";")) {
    const fields = part.trim().split(":");
    const id = fields[0]?.trim();
    if (!id) continue;
    hints.set(id, {
      overlap: Number(fields.find((field) => field.startsWith("overlap="))?.split("=")[1] ?? 0) || 0,
      direct: fields.find((field) => field.startsWith("direct="))?.split("=")[1] === "yes",
    });
  }
  return hints;
}

function summarizePredictions(rows) {
  const grounded = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: grounded.length,
    abstain: rows.length - grounded.length,
    mean_citations_when_grounded: mean(grounded.map((row) => row.prediction.citations.length)),
  };
}

function summarizeTargets(rows) {
  const grounded = rows.filter((row) => row.target.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    grounded_answer: grounded.length,
    abstain: rows.length - grounded.length,
    mean_citations_when_grounded: mean(grounded.map((row) => normalizeCitations(row.target.citations).length)),
  };
}

function decisionFor(metrics) {
  const rateValue = metrics.overall_contract_correct_rate;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_as_current_best_scaffold: rateValue >= 47 / 64,
    run_prime_student_next: false,
    reason: rateValue >= 47 / 64
      ? "The selector reaches the prior structured-group non-review baseline; keep it as the local acceptance floor before any student run."
      : "The selector remains below the structured-group baseline; citation selection still needs a stronger verifier or a different model class before Prime spend.",
    next_step: rateValue >= 47 / 64
      ? "Audit remaining misses and decide whether a bounded student run can beat this floor."
      : "Stop shallow lexical citation selectors and move to a stronger learned verifier or bounded model run with explicit acceptance criteria.",
  };
}

function statusFor(metrics) {
  if (metrics.overall_contract_correct_rate >= 47 / 64) return "nonreview_citation_selector_matches_structured_group";
  if (metrics.overall_contract_correct_rate >= 37 / 64) return "nonreview_citation_selector_matches_or_beats_d439";
  return "nonreview_citation_selector_below_d439";
}

function renderReport(result) {
  return `# Non-Review Citation Selector Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

This zero-spend smoke trains a deterministic citation selector on D437 train rows, selects on validation rows, and evaluates on the fresh non-review split.

## Calibration

- Train examples: ${result.calibration.train_examples}
- Validation examples: ${result.calibration.validation_examples}
- Train contract correctness: ${pct(result.calibration.train_metrics.overall_contract_correct_rate)}
- Validation contract correctness: ${pct(result.calibration.validation_metrics.overall_contract_correct_rate)}
- Validation citation-set exact: ${pct(result.calibration.validation_metrics.citation_set_exact_rate)}
- Selected params: \`${JSON.stringify(result.calibration.selected_params)}\`

## Fresh Eval

- Eval examples: ${result.contract_gate_metrics.examples}
- Predictions: ${result.predictions.grounded_answer} grounded, ${result.predictions.abstain} abstain
- Parseable: ${pct(result.contract_gate_metrics.parseable_rate)}
- Evidence-first valid: ${pct(result.contract_gate_metrics.evidence_first_valid_rate)}
- Answer-type accuracy: ${pct(result.contract_gate_metrics.answer_type_accuracy)}
- Citation-set exact: ${pct(result.contract_gate_metrics.citation_set_exact_rate)}
- Overall contract correct: ${pct(result.contract_gate_metrics.overall_contract_correct_rate)}

## Baselines

- D439 cheap scaffold: ${pct(result.baseline_comparison.cheap_scaffold_d439_rate)}
- Prior structured-group non-review baseline: ${pct(result.baseline_comparison.structured_group_nonreview_rate_from_d436)}
- Prior four-source non-review oracle: ${pct(result.baseline_comparison.four_source_oracle_nonreview_rate_from_d436)}
- Delta vs D439: ${pct(result.baseline_comparison.delta_vs_d439)}
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

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 8);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 340);
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
