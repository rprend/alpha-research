import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your".split(" "));

const headroomRunId = args["headroom-run-id"] ?? "repaired-candidate-pool-headroom-audit-frontier-validation-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "repaired-candidate-router-loo-audit-frontier-validation-v1";
const outputDir = path.join(runsDir, runId);

const systemIds = [
  "train_calibrated_scaffold",
  "constrained_qwen_hybrid",
  "repaired_qwen3b",
  "train_selected_constrained_policy",
  "learned_repaired_selector",
];
const sourceFiles = {
  train_calibrated_scaffold: path.join(runsDir, "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1", "predictions.jsonl"),
  constrained_qwen_hybrid: path.join(runsDir, "repaired-qwen3b-constrained-hybrid-audit-frontier-validation-v1", "selected_predictions.jsonl"),
  repaired_qwen3b: path.join(runsDir, "evidence-first-contract-repair-audit-frontier-repaired-qwen3b-validation-smoke-v1", "repaired_predictions.jsonl"),
  train_selected_constrained_policy: path.join(runsDir, "train-selected-constrained-policy-audit-frontier-repaired-v1", "validation_predictions.jsonl"),
  learned_repaired_selector: path.join(runsDir, "learned-repaired-selector-audit-frontier-repaired-v1", "validation_predictions.jsonl"),
};
const featureNames = [
  "bias",
  "system_train_calibrated_scaffold",
  "system_constrained_qwen_hybrid",
  "system_repaired_qwen3b",
  "system_train_selected_constrained_policy",
  "system_learned_repaired_selector",
  "predicts_answer",
  "predicts_abstain",
  "citation_count",
  "claim_count",
  "answer_token_length",
  "answer_has_inline_citation",
  "all_citations_in_answer",
  "evidence_first_supported_claim_count",
  "abstention_has_missing_support",
  "question_overlap",
  "cited_evidence_overlap",
  "answer_number_supported",
  "answer_has_number",
  "question_has_number",
  "counterfactual_prompt",
  "risky_question",
  "metadata_prior_contract_rate",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const headroom = await readJson(path.join(runsDir, headroomRunId, "result.json"));
const oracleRows = await readJsonl(path.join(runsDir, headroomRunId, "pool_oracle_rows.jsonl"));
const prompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const inputById = new Map(prompts.map((row) => [row.example_id, row.input]));
const predictionsBySystem = {};
for (const [systemId, file] of Object.entries(sourceFiles)) {
  predictionsBySystem[systemId] = new Map((await readJsonl(file)).map((row) => [row.example_id, row.prediction]));
}
const systemPriors = Object.fromEntries((headroom.systems ?? []).map((row) => [row.system_id, Number(row.contract_correct_rate ?? 0)]));

const candidateRows = [];
for (const row of oracleRows) {
  const input = inputById.get(row.example_id);
  for (const score of row.scores) {
    const prediction = predictionsBySystem[score.system_id]?.get(row.example_id);
    candidateRows.push({
      example_id: row.example_id,
      system_id: score.system_id,
      target_answer_type: row.target_answer_type,
      label_contract_correct: score.contract_correct ? 1 : 0,
      feature_values: candidateFeatures({ input, prediction, systemId: score.system_id, systemPriors }),
    });
  }
}

const selectedRows = [];
for (const heldout of oracleRows) {
  const train = candidateRows.filter((row) => row.example_id !== heldout.example_id);
  const test = candidateRows.filter((row) => row.example_id === heldout.example_id);
  const scaler = makeScaler(train.map((row) => row.feature_values));
  const model = trainLogistic(train, scaler, { epochs: 1000, learningRate: 0.06, l2: 0.01 });
  const scored = test.map((row) => ({
    ...row,
    predicted_probability: predictProb(model, scaler, row.feature_values),
  })).sort((left, right) => right.predicted_probability - left.predicted_probability || systemIds.indexOf(left.system_id) - systemIds.indexOf(right.system_id));
  const selected = scored[0];
  selectedRows.push({
    example_id: heldout.example_id,
    target_answer_type: heldout.target_answer_type,
    selected_system_id: selected.system_id,
    selected_contract_correct: Boolean(selected.label_contract_correct),
    selected_probability: selected.predicted_probability,
    oracle_contract_correct: heldout.oracle_contract_correct,
    correct_systems: heldout.correct_systems,
    candidates: scored.map((row) => ({
      system_id: row.system_id,
      predicted_probability: row.predicted_probability,
      contract_correct: Boolean(row.label_contract_correct),
    })),
  });
}

const metrics = summarizeSelections(selectedRows);
const selectedSystemCounts = countBy(selectedRows.map((row) => row.selected_system_id));
const missedOracleRows = selectedRows.filter((row) => row.oracle_contract_correct && !row.selected_contract_correct);
const recoveredVsBestSingle = metrics.contract_correct - 45;
const closedOracleGap = headroom.oracle?.oracle_contract_correct
  ? (metrics.contract_correct - 45) / (Number(headroom.oracle.oracle_contract_correct) - 45)
  : 0;

await writeJsonl(path.join(outputDir, "loo_selected_rows.jsonl"), selectedRows);
await writeJsonl(path.join(outputDir, "candidate_training_rows.jsonl"), candidateRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "repaired_candidate_router_loo_audit",
  status: statusFor(metrics, headroom),
  purpose: "Test whether local candidate features can recover diagnostic oracle headroom from the repaired-validation candidate pool under leave-one-example-out routing.",
  source_runs: {
    headroom_run_id: headroomRunId,
    validation_gate_run_id: validationGateRunId,
  },
  leakage_note: "This is a diagnostic leave-one-example-out audit over repaired-validation labels. It is not a valid held-out policy, cannot be promoted, and only informs whether routing features have enough signal to justify a leakage-safe selector on a fresh split.",
  training: {
    examples: oracleRows.length,
    candidate_rows: candidateRows.length,
    feature_names: featureNames,
    fold_policy: "leave_one_example_out_train_on_remaining_69_validation_examples",
    model: "local_logistic_candidate_correctness_router",
  },
  metrics,
  selected_system_counts: selectedSystemCounts,
  baseline_comparison: {
    best_single_system_contract_correct: 45,
    oracle_contract_correct: Number(headroom.oracle?.oracle_contract_correct),
    loo_router_contract_correct: metrics.contract_correct,
    delta_vs_best_single_system: recoveredVsBestSingle,
    remaining_gap_to_oracle: Number(headroom.oracle?.oracle_contract_correct) - metrics.contract_correct,
    oracle_gap_closed_fraction: closedOracleGap,
  },
  failure_analysis: {
    missed_oracle_rows: missedOracleRows.length,
    missed_oracle_example_ids: missedOracleRows.map((row) => row.example_id),
    all_systems_wrong_rows: Number(headroom.oracle?.all_systems_wrong),
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_policy: false,
    next_step: nextStepFor(metrics, headroom),
    reason: "The router is trained on validation labels, even with leave-one-example-out folds. It can justify building a leakage-safe verifier/router, but it cannot be reported as a final system.",
  },
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
    note: "This audit trains local logistic folds over existing predictions and labels only.",
  },
  artifacts: {
    loo_selected_rows_jsonl: rel(path.join(outputDir, "loo_selected_rows.jsonl")),
    candidate_training_rows_jsonl: rel(path.join(outputDir, "candidate_training_rows.jsonl")),
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
  metrics: result.metrics,
  selected_system_counts: result.selected_system_counts,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function candidateFeatures({ input, prediction, systemId, systemPriors }) {
  const answer = String(prediction?.answer ?? "");
  const citations = normalizeCitations(prediction?.citations);
  const claimTable = Array.isArray(prediction?.claim_table) ? prediction.claim_table : [];
  const citedText = citedEvidenceText(input, citations);
  const answerTokens = tokenList(answer);
  const questionTokens = tokenSet(input?.question);
  const citedTokens = tokenSet(citedText);
  const answerNumbers = numberSet(answer);
  const citedNumbers = numberSet(citedText);
  const allCitationsInAnswer = citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
  return [
    1,
    systemId === "train_calibrated_scaffold" ? 1 : 0,
    systemId === "constrained_qwen_hybrid" ? 1 : 0,
    systemId === "repaired_qwen3b" ? 1 : 0,
    systemId === "train_selected_constrained_policy" ? 1 : 0,
    systemId === "learned_repaired_selector" ? 1 : 0,
    prediction?.answer_type === "grounded_answer" ? 1 : 0,
    prediction?.answer_type === "abstain" ? 1 : 0,
    Math.min(1, citations.length / 4),
    Math.min(1, claimTable.length / 4),
    Math.min(1, answerTokens.length / 80),
    /\[E\d+\]/.test(answer) ? 1 : 0,
    allCitationsInAnswer ? 1 : 0,
    Math.min(1, (prediction?.evidence_first?.supported_claims?.length ?? 0) / 4),
    String(prediction?.evidence_first?.missing_support ?? prediction?.abstention_reason ?? "").length > 20 ? 1 : 0,
    questionTokens.size ? overlapCount(questionTokens, tokenSet(answer)) / questionTokens.size : 0,
    questionTokens.size ? overlapCount(questionTokens, citedTokens) / questionTokens.size : 0,
    answerNumbers.size > 0 && [...answerNumbers].every((number) => citedNumbers.has(number)) ? 1 : 0,
    answerNumbers.size > 0 ? 1 : 0,
    numberSet(input?.question).size > 0 ? 1 : 0,
    Boolean(input?.document_metadata?.counterfactual) ? 1 : 0,
    isRiskyQuestion(input?.question) ? 1 : 0,
    Number(systemPriors[systemId] ?? 0),
  ];
}

function summarizeSelections(rows) {
  const contractCorrect = rows.filter((row) => row.selected_contract_correct).length;
  const answered = rows.filter((row) => row.candidates.find((candidate) => candidate.system_id === row.selected_system_id)?.system_id && row.selected_system_id).length;
  const groundedTargets = rows.filter((row) => row.target_answer_type === "grounded_answer");
  const abstainTargets = rows.filter((row) => row.target_answer_type === "abstain");
  return {
    examples: rows.length,
    contract_correct: contractCorrect,
    contract_correct_rate: rate(contractCorrect, rows.length),
    selected_rows: answered,
    grounded_target_correct: groundedTargets.filter((row) => row.selected_contract_correct).length,
    grounded_target_correct_rate: rate(groundedTargets.filter((row) => row.selected_contract_correct).length, groundedTargets.length),
    abstain_target_correct: abstainTargets.filter((row) => row.selected_contract_correct).length,
    abstain_target_correct_rate: rate(abstainTargets.filter((row) => row.selected_contract_correct).length, abstainTargets.length),
  };
}

function trainLogistic(rows, scaler, options) {
  const dim = rows[0]?.feature_values.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.feature_values, scaler);
      const prediction = sigmoid(dot(weights, x) + intercept);
      const error = prediction - row.label_contract_correct;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) {
      weights[i] -= options.learningRate * ((grad[i] / n) + (options.l2 * weights[i]));
    }
  }
  return { weights, intercept };
}

function predictProb(model, scaler, features) {
  return sigmoid(dot(model.weights, scale(features, scaler)) + model.intercept);
}

function makeScaler(rows) {
  const dim = rows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of rows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, rows.length);
  for (const row of rows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, rows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function statusFor(metrics, headroom) {
  const bestSingle = 45;
  const oracle = Number(headroom.oracle?.oracle_contract_correct ?? bestSingle);
  if (metrics.contract_correct > bestSingle && metrics.contract_correct < oracle) return "loo_router_recovers_some_oracle_headroom";
  if (metrics.contract_correct >= oracle) return "loo_router_matches_oracle_diagnostic";
  return "loo_router_does_not_beat_best_single_system";
}

function nextStepFor(metrics, headroom) {
  const bestSingle = 45;
  if (metrics.contract_correct > bestSingle) {
    return "Build a leakage-safe router/verifier using non-validation supervision or a fresh split; do not spend on Prime until it beats the validation baseline without validation-label training.";
  }
  if (Number(headroom.oracle?.oracle_contract_correct ?? 0) > bestSingle) {
    return "The pool has oracle headroom but these local router features cannot recover it; try a stronger verifier class such as pretrained NLI/cross-encoder or fresh teacher-derived router labels.";
  }
  return "Prioritize candidate construction because router headroom is not recoverable from the current pool.";
}

function citedEvidenceText(input, citations) {
  const wanted = new Set(citations);
  return (input?.compact_retrieved_evidence_pack ?? [])
    .filter((evidence) => wanted.has(evidence.evidence_id))
    .map((evidence) => `${evidence.section ?? ""} ${evidence.text ?? ""}`)
    .join(" ");
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function overlapCount(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
}

function isRiskyQuestion(question) {
  return /\b(percentage|percent|how many|how much|statistically significant|which are three|compare|difference|ratio|previous|state.of.the.art|fewer|more)\b/i.test(question ?? "");
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Repaired Candidate Router LOO Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This is a diagnostic leave-one-example-out router over repaired-validation labels. It is not a deployable policy.

## Metrics

| System | Contract Correct |
| --- | ---: |
| Best single existing system | ${result.baseline_comparison.best_single_system_contract_correct}/70 |
| LOO router | ${result.metrics.contract_correct}/70 (${pct(result.metrics.contract_correct_rate)}) |
| Candidate-pool oracle | ${result.baseline_comparison.oracle_contract_correct}/70 |

## Router Behavior

- Selected systems: ${Object.entries(result.selected_system_counts).map(([key, value]) => `${key}=${value}`).join(", ")}
- Delta vs best single system: ${result.baseline_comparison.delta_vs_best_single_system}
- Remaining gap to oracle: ${result.baseline_comparison.remaining_gap_to_oracle}
- Oracle gap closed: ${pct(result.baseline_comparison.oracle_gap_closed_fraction)}
- Missed oracle rows: ${result.failure_analysis.missed_oracle_rows}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as policy: ${result.decision.promote_as_policy ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
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
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
