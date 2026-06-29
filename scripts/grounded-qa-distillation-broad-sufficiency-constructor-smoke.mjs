import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "broad-sufficiency-constructor-smoke-frontier-repaired-v1";
const launchPacketRunId = args["launch-packet-run-id"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationPacketRunId = args["validation-packet-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const headroomRunId = args["headroom-run-id"] ?? "broad-sufficiency-headroom-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your over under through between among all three two one".split(" "));

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(runsDir, launchPacketRunId, "dataset", "sft_train.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const headroomRows = await readJsonl(path.join(runsDir, headroomRunId, "rows.jsonl"));
const targetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));
const headroomById = new Map(headroomRows.map((row) => [row.example_id, row]));

const trainTune = trainRows.slice(0, 160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target }));
const trainHeldout = trainRows.slice(160).map((row) => ({ example_id: row.example_id, input: row.input, target: row.target }));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: targetById.get(row.example_id),
}));
const calibration = calibrate(trainTune, trainHeldout);
const predictions = validationPrompts.map((prompt) => predictPrompt(prompt, calibration.params));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);

const gateRunId = `${runId}-contract-gate`;
const gate = await runContractGate(gateRunId, predictionsPath);
const scoredRows = await readJsonl(path.join(runsDir, gateRunId, "scored_predictions.jsonl"));
const constructorRows = scoredRows.map((row) => {
  const headroom = headroomById.get(row.example_id);
  return {
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    constructor_answer_type: row.prediction_answer_type,
    constructor_contract_correct: row.contract_correct,
    constructor_answer_type_correct: row.answer_type_correct,
    constructor_citation_set_exact: row.citation_set_exact,
    existing_pool_irrecoverable: Boolean(headroom?.irrecoverable_in_pool),
    existing_pool_recoverable_by_rerouting: Boolean(headroom?.recoverable_by_rerouting),
    adds_new_correct_candidate: Boolean(headroom?.irrecoverable_in_pool && row.contract_correct),
    tags: tagsFor(row, headroom),
  };
});

const constructorCorrect = count(constructorRows, (row) => row.constructor_contract_correct);
const addsNewCorrect = count(constructorRows, (row) => row.adds_new_correct_candidate);
const headroomMetrics = {
  existing_router_contract_correct: count(headroomRows, (row) => row.selected_contract_correct),
  existing_pool_oracle_contract_correct: count(headroomRows, (row) => row.oracle_contract_correct),
  constructor_standalone_contract_correct: constructorCorrect,
  constructor_new_correct_candidates_for_pool_gaps: addsNewCorrect,
  augmented_pool_oracle_contract_correct: count(headroomRows, (row) => row.oracle_contract_correct) + addsNewCorrect,
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "broad_sufficiency_constructor_smoke",
  status: statusFor(headroomMetrics),
  purpose: "Evaluate a zero-call broad sufficiency-first constructor that creates new grounded candidates from compact evidence packs, then measure standalone contract correctness and added candidate-pool oracle headroom.",
  source_runs: {
    launch_packet: launchPacketRunId,
    validation_packet: validationPacketRunId,
    headroom_audit: headroomRunId,
    contract_gate: gateRunId,
  },
  leakage_note: "Thresholds are selected on repaired train-tune rows only. Validation targets are used only after prediction for reporting and contract scoring.",
  calibration,
  predictions: {
    examples: predictions.length,
    grounded_answer: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstain: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
  },
  contract_gate_metrics: gate.metrics,
  metrics: {
    examples: scoredRows.length,
    constructor_contract_correct: constructorCorrect,
    constructor_contract_correct_rate: rate(constructorCorrect, scoredRows.length),
    constructor_answer_type_correct: count(constructorRows, (row) => row.constructor_answer_type_correct),
    constructor_citation_set_exact: count(constructorRows, (row) => row.constructor_citation_set_exact),
    existing_pool_irrecoverable_rows: count(constructorRows, (row) => row.existing_pool_irrecoverable),
    constructor_correct_on_existing_pool_irrecoverable_rows: addsNewCorrect,
    headroom: headroomMetrics,
  },
  baseline_comparison: {
    abstention_prior_contract_correct: 39,
    train_calibrated_scaffold_contract_correct: 44,
    train_supervised_router_contract_correct: headroomMetrics.existing_router_contract_correct,
    existing_pool_oracle_contract_correct: headroomMetrics.existing_pool_oracle_contract_correct,
    augmented_pool_oracle_contract_correct: headroomMetrics.augmented_pool_oracle_contract_correct,
    constructor_minus_router: constructorCorrect - headroomMetrics.existing_router_contract_correct,
    constructor_minus_train_calibrated_scaffold: constructorCorrect - 44,
    augmented_oracle_minus_existing_oracle: headroomMetrics.augmented_pool_oracle_contract_correct - headroomMetrics.existing_pool_oracle_contract_correct,
    augmented_oracle_minus_router: headroomMetrics.augmented_pool_oracle_contract_correct - headroomMetrics.existing_router_contract_correct,
  },
  row_tag_counts: countBy(constructorRows.flatMap((row) => row.tags)),
  decision: decisionFor(headroomMetrics),
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
    note: "This constructor uses local deterministic evidence scoring and the local contract gate only.",
  },
  artifacts: {
    predictions_jsonl: rel(predictionsPath),
    rows_jsonl: rel(path.join(outputDir, "rows.jsonl")),
    contract_gate_result_json: rel(path.join(runsDir, gateRunId, "result.json")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "rows.jsonl"), constructorRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  calibration: result.calibration,
  predictions: result.predictions,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function calibrate(trainTune, trainHeldout) {
  const candidates = [];
  for (const threshold of [0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.45, 0.5]) {
    for (const riskyThreshold of [0.2, 0.3, 0.4, 0.5, 0.65, 0.8]) {
      for (const citationScoreFraction of [0.55, 0.7, 0.85, 0.95, 1.01]) {
        for (const maxCitations of [1, 2, 3, 4, 5]) {
          const params = { threshold, risky_threshold: riskyThreshold, citation_score_fraction: citationScoreFraction, max_citations: maxCitations };
          const train = scoreRows(trainTune, params);
          const targetAnswerCount = train.target_grounded_answer;
          const objective = train.contract_correct - Math.abs(train.grounded_answer_predictions - targetAnswerCount) * 0.5;
          candidates.push({ params, train, objective });
        }
      }
    }
  }
  candidates.sort((left, right) => right.objective - left.objective || right.train.contract_correct - left.train.contract_correct);
  const selected = candidates[0];
  return {
    selected_by: "train_tune_contract_correct_with_answer_coverage_regularizer",
    train_tune_examples: trainTune.length,
    train_heldout_examples: trainHeldout.length,
    params: selected.params,
    train_tune: selected.train,
    train_heldout: scoreRows(trainHeldout, selected.params),
  };
}

function scoreRows(rows, params) {
  const scored = rows.map((row) => scorePrediction(simplePrediction(row.input, params), row.target));
  return {
    examples: rows.length,
    contract_correct: count(scored, (row) => row.contract_correct),
    contract_correct_rate: rate(count(scored, (row) => row.contract_correct), rows.length),
    answer_type_correct: count(scored, (row) => row.answer_type_correct),
    citation_set_exact: count(scored, (row) => row.citation_set_exact),
    target_grounded_answer: count(rows, (row) => row.target.answer_type === "grounded_answer"),
    grounded_answer_predictions: count(scored, (row) => row.prediction_answer_type === "grounded_answer"),
  };
}

function predictPrompt(prompt, params) {
  const prediction = fullPrediction(prompt.input, params);
  return {
    example_id: prompt.example_id,
    prediction,
    raw_output: JSON.stringify(prediction),
    metadata: {
      scaffold: "broad_sufficiency_constructor",
      params,
      no_model_weights_or_llm_calls: true,
    },
  };
}

function fullPrediction(input, params) {
  const simple = simplePrediction(input, params);
  if (simple.answer_type === "abstain") return abstain(input.question, simple.reason);
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const claims = simple.citations.map((citation, index) => {
    const evidence = evidenceById.get(citation);
    const sentence = bestSentence(input.question, evidence);
    return {
      claim_id: `C${index + 1}`,
      claim: sentence,
      citations: [citation],
      support_status: "supported",
    };
  });
  return {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${claims.map((claim) => claim.claim).join(" ")} ${simple.citations.map((id) => `[${id}]`).join(" ")}`,
    citations: simple.citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
  };
}

function simplePrediction(input, params) {
  const ranked = rankEvidence(input.question, input.compact_retrieved_evidence_pack ?? []);
  const top = ranked[0]?.score ?? 0;
  const threshold = isRiskyQuestion(input.question) ? params.risky_threshold : params.threshold;
  if (top < threshold) {
    return { answer_type: "abstain", citations: [], reason: `Top evidence support score ${top.toFixed(3)} is below threshold ${threshold.toFixed(3)}.` };
  }
  const citations = ranked
    .filter((row, index) => index < params.max_citations && row.score >= params.threshold && row.score >= top * params.citation_score_fraction)
    .map((row) => row.evidence_id);
  if (!citations.length) return { answer_type: "abstain", citations: [], reason: "No evidence survived citation selection." };
  return { answer_type: "grounded_answer", citations };
}

function rankEvidence(question, evidencePack) {
  return evidencePack
    .map((evidence) => ({ evidence_id: evidence.evidence_id, score: evidenceScore(question, evidence) }))
    .sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id));
}

function evidenceScore(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const evidenceText = `${evidence.section ?? ""} ${evidence.text ?? ""}`;
  const evidenceTokens = contentTokens(evidenceText);
  if (!questionTokens.size || !evidenceTokens.length) return 0;
  let overlap = 0;
  for (const token of evidenceTokens) if (questionTokens.has(token)) overlap += 1;
  const uniqueOverlap = new Set(evidenceTokens.filter((token) => questionTokens.has(token))).size;
  let score = uniqueOverlap / questionTokens.size + overlap / evidenceTokens.length;
  if (evidenceTokens.some((token) => /\d/.test(token)) && [...questionTokens].some((token) => /\d/.test(token))) score += 0.08;
  const lowerQuestion = String(question ?? "").toLowerCase();
  const lowerEvidence = evidenceText.toLowerCase();
  if (/dataset|data/.test(lowerQuestion) && /dataset|data|corpus|benchmark/.test(lowerEvidence)) score += 0.15;
  if (/baseline|compared|models|architectures|system/.test(lowerQuestion) && /baseline|compare|model|architecture|lstm|bert|cnn|dynet|matchlstm/.test(lowerEvidence)) score += 0.15;
  if (/measured|evaluated|score|metric/.test(lowerQuestion) && /evaluat|metric|score|likert|perplexity|ppl/.test(lowerEvidence)) score += 0.15;
  return score;
}

function bestSentence(question, evidence) {
  const questionTokens = new Set(contentTokens(question));
  const sentences = splitSentences(evidence?.text ?? "");
  const selected = sentences
    .map((sentence) => ({ sentence: cleanSentence(sentence), score: sentenceOverlap(questionTokens, sentence) }))
    .sort((left, right) => right.score - left.score)[0];
  return selected?.sentence || cleanSentence(evidence?.text ?? "");
}

function sentenceOverlap(questionTokens, sentence) {
  const tokens = contentTokens(sentence);
  if (!tokens.length) return 0;
  return tokens.filter((token) => questionTokens.has(token)).length / tokens.length;
}

function abstain(question, missingSupport) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: missingSupport,
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The local constructor did not find direct enough support in the compact evidence pack.",
  };
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction.answer_type === target.answer_type;
  const citationSetExact = prediction.answer_type === "abstain"
    ? prediction.citations.length === 0
    : setEqual(new Set(prediction.citations), new Set(target.citations ?? []));
  return {
    prediction_answer_type: prediction.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

async function runContractGate(gateRunId, predictionsPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join("scripts", "grounded-qa-distillation-evidence-first-contract-preflight.mjs"),
      `--packet-run-id=${validationPacketRunId}`,
      `--prediction-file=${path.relative(rootDir, predictionsPath)}`,
      `--run-id=${gateRunId}`,
    ], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Contract gate failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, gateRunId, "result.json"));
}

function tagsFor(row, headroom) {
  const tags = [];
  if (row.contract_correct) tags.push("constructor_contract_correct");
  if (headroom?.irrecoverable_in_pool && row.contract_correct) tags.push("adds_new_correct_candidate");
  if (headroom?.irrecoverable_in_pool && !row.contract_correct) tags.push("still_candidate_construction_gap");
  if (row.target_answer_type === "abstain" && row.prediction_answer_type === "grounded_answer") tags.push("over_answered_insufficient_evidence");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "abstain") tags.push("false_abstention");
  if (row.target_answer_type === "grounded_answer" && row.prediction_answer_type === "grounded_answer" && !row.citation_set_exact) tags.push("citation_selection_error");
  return tags;
}

function statusFor(metrics) {
  if (metrics.augmented_pool_oracle_contract_correct > metrics.existing_pool_oracle_contract_correct && metrics.constructor_standalone_contract_correct < metrics.existing_router_contract_correct) {
    return "constructor_adds_candidate_headroom_but_not_standalone_policy";
  }
  if (metrics.constructor_standalone_contract_correct >= metrics.existing_router_contract_correct) return "constructor_matches_or_beats_router";
  return "constructor_negative";
}

function decisionFor(metrics) {
  const addsHeadroom = metrics.augmented_pool_oracle_contract_correct > metrics.existing_pool_oracle_contract_correct;
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_constructor_as_policy: metrics.constructor_standalone_contract_correct >= metrics.existing_router_contract_correct,
    keep_as_candidate_generator: addsHeadroom,
    next_step: addsHeadroom
      ? "Train or tune a leakage-safe router that can choose among the existing three systems plus this constructor, then test whether it captures the added oracle headroom without validation-label leakage."
      : "Reject this constructor family and move to a stronger teacher/backend for candidate construction.",
    reason: addsHeadroom
      ? `The constructor is weaker standalone (${metrics.constructor_standalone_contract_correct}/70) than the router (${metrics.existing_router_contract_correct}/70), but it adds ${metrics.constructor_new_correct_candidates_for_pool_gaps} correct candidates on rows the existing pool could not solve.`
      : "The constructor neither beats the router nor adds candidate-pool headroom.",
  };
}

function isRiskyQuestion(question) {
  return /\b(by how much|amount|percentage|percent|which specific|state-of-the-art|language from|improvement)\b/i.test(question ?? "");
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 5);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function contentTokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function renderReport(result) {
  return `# Broad Sufficiency Constructor Smoke

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | ${result.baseline_comparison.abstention_prior_contract_correct} / ${result.metrics.examples} | ${pct(result.baseline_comparison.abstention_prior_contract_correct / result.metrics.examples)} |
| Train-calibrated scaffold | ${result.baseline_comparison.train_calibrated_scaffold_contract_correct} / ${result.metrics.examples} | ${pct(result.baseline_comparison.train_calibrated_scaffold_contract_correct / result.metrics.examples)} |
| Current router | ${result.baseline_comparison.train_supervised_router_contract_correct} / ${result.metrics.examples} | ${pct(result.baseline_comparison.train_supervised_router_contract_correct / result.metrics.examples)} |
| Constructor standalone | ${result.metrics.constructor_contract_correct} / ${result.metrics.examples} | ${pct(result.metrics.constructor_contract_correct_rate)} |
| Existing pool oracle | ${result.baseline_comparison.existing_pool_oracle_contract_correct} / ${result.metrics.examples} | ${pct(result.baseline_comparison.existing_pool_oracle_contract_correct / result.metrics.examples)} |
| Augmented pool oracle | ${result.baseline_comparison.augmented_pool_oracle_contract_correct} / ${result.metrics.examples} | ${pct(result.baseline_comparison.augmented_pool_oracle_contract_correct / result.metrics.examples)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote constructor as policy: ${result.decision.promote_constructor_as_policy ? "yes" : "no"}
- Keep as candidate generator: ${result.decision.keep_as_candidate_generator ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
