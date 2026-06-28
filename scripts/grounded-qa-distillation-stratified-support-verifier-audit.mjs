import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "stratified-support-verifier-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const balancedRunId = "balanced-support-verifier-packet-2026-06-28-v1";

const featureNames = [
  "log_answer_tokens",
  "log_claim_count",
  "log_citation_count",
  "inline_citation_complete",
  "answer_question_overlap",
  "answer_evidence_overlap",
  "claim_answer_overlap",
  "same_citation_shape_score",
  "abstention_phrase",
  "jsonish_answer",
  "qwen_family",
  "openai_family",
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const balanced = await readJson(path.join(runsDir, balancedRunId, "result.json"));
const trainPairs = await readJsonl(path.join(runsDir, balancedRunId, "train_pairs.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, balancedRunId, "validation_pairs.jsonl"));
const finalDiagnosticPairs = await readJsonl(path.join(runsDir, "support-ranker-pairwise-packet-expanded-2026-06-28-v1", "diagnostic_frontier_pairwise.jsonl"));

const trainExamples = trainPairs.map(pairToExample);
const validationExamples = validationPairs.map(pairToExample);
const broadTrain = trainExamples.filter((row) => row.source_type === "broad_preservation_train");
const targetedTrain = trainExamples.filter((row) => row.source_type === "targeted_hard_negative_train");
const broadValidation = validationExamples.filter((row) => row.source_type === "broad_preservation_validation");
const targetedValidation = validationExamples.filter((row) => row.source_type === "targeted_hard_negative_validation");

const broadModel = trainModel(broadTrain, { epochs: 900, learningRate: 0.08, l2: 0.08 });
const targetedModel = trainModel(targetedTrain, { epochs: 900, learningRate: 0.08, l2: 0.08 });

const policies = [
  evaluatePolicy("broad_only", broadModel, () => broadModel, validationExamples, finalDiagnosticPairs),
  evaluatePolicy("targeted_only", targetedModel, () => targetedModel, validationExamples, finalDiagnosticPairs),
  evaluatePolicy("source_stratified", broadModel, (row) => row.source_type?.startsWith("targeted_") ? targetedModel : broadModel, validationExamples, finalDiagnosticPairs),
];
const selectedPolicy = selectPolicy(policies);
const conflictRows = buildConflictRows(policies);
const status = deriveStatus(selectedPolicy);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "stratified_support_verifier_audit",
  status,
  purpose: "Test whether the D360 validation conflict can be resolved by stratifying broad-preservation and targeted-hard-negative support-verifier objectives.",
  source_runs: {
    balanced_packet: balancedRunId,
  },
  packet: {
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
    broad_train_pairs: broadTrain.length,
    targeted_train_pairs: targetedTrain.length,
    broad_validation_pairs: broadValidation.length,
    targeted_validation_pairs: targetedValidation.length,
    final_diagnostic_pairs: finalDiagnosticPairs.length,
  },
  inherited_balanced_metrics: balanced.metrics,
  policies: Object.fromEntries(policies.map((row) => [row.policy_id, summarizePolicy(row)])),
  selected_policy: summarizePolicy(selectedPolicy),
  model_weights: {
    broad_only: weightsObject(broadModel),
    targeted_only: weightsObject(targetedModel),
  },
  decision: decisionFromStatus(status, selectedPolicy),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    selected_policy_rule: "Choose by validation pairwise accuracy only; final diagnostics are reporting-only.",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit reads existing judged artifacts only.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    conflict_rows_jsonl: rel(path.join(outputDir, "conflict_rows.jsonl")),
    selected_final_selections_jsonl: rel(path.join(outputDir, "selected_final_selections.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies.map((row) => summarizePolicy(row)));
await writeJsonl(path.join(outputDir, "conflict_rows.jsonl"), conflictRows);
await writeJsonl(path.join(outputDir, "selected_final_selections.jsonl"), selectedPolicy.final_selection.selections);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status,
  policies: result.policies,
  selected_policy: result.selected_policy,
  decision: result.decision,
}, null, 2));

function pairToExample(pair) {
  const chosenFeatures = candidateFeatures(pair.input, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair.input, pair.rejected);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_type: pair.source_type,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function trainModel(rows, options) {
  const scaler = fitScaler(rows.map((row) => row.delta));
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 60);
    for (const row of rows) {
      const x = scaleVector(row.delta, scaler);
      const margin = dot(weights, x);
      const gradientScale = -sigmoid(-margin);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, scaler, epochs, learningRate, l2 };
}

function evaluatePolicy(policyId, selectionModel, validationModelForRow, validationRows, finalPairs) {
  const validationPredictions = validationRows.map((row) => {
    const model = validationModelForRow(row);
    const margin = scoreDelta(row.delta, model);
    return {
      policy_id: policyId,
      source_type: row.source_type,
      pair_id: row.pair_id,
      example_id: row.example_id,
      margin,
      correct: margin >= 0,
    };
  });
  const finalSelection = evaluateFinalSelection(finalPairs, selectionModel);
  return {
    policy_id: policyId,
    validation: summarizePredictions(validationPredictions),
    broad_validation: summarizePredictions(validationPredictions.filter((row) => row.source_type === "broad_preservation_validation")),
    targeted_validation: summarizePredictions(validationPredictions.filter((row) => row.source_type === "targeted_hard_negative_validation")),
    final_selection: finalSelection,
    validation_predictions: validationPredictions,
  };
}

function evaluateFinalSelection(pairs, model) {
  const byExample = new Map();
  for (const pair of pairs) {
    const bucket = byExample.get(pair.example_id) ?? new Map();
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const existing = bucket.get(candidate.id);
      if (existing) {
        existing.supported_answer = existing.supported_answer || role === "chosen";
        continue;
      }
      const features = candidateFeatures(pair.input, candidate);
      bucket.set(candidate.id, {
        example_id: pair.example_id,
        candidate_id: candidate.id,
        family: candidate.family ?? "unknown",
        supported_answer: role === "chosen",
        score: scoreFeatures(features, model),
      });
    }
    byExample.set(pair.example_id, bucket);
  }
  const selections = [...byExample.entries()].map(([exampleId, bucket]) => {
    const ranked = [...bucket.values()].sort((left, right) => right.score - left.score || left.candidate_id.localeCompare(right.candidate_id));
    const selected = ranked[0];
    return {
      example_id: exampleId,
      selected_candidate_id: selected.candidate_id,
      selected_family: selected.family,
      selected_supported_answer: selected.supported_answer,
      selected_score: selected.score,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    selection_support_rate: rate(selections.filter((row) => row.selected_supported_answer).length, selections.length),
    examples_with_supported_candidate: selections.filter((row) => row.supported_candidate_count > 0).length,
    selections,
  };
}

function selectPolicy(policies) {
  return [...policies].sort((left, right) =>
    right.validation.accuracy - left.validation.accuracy
    || right.broad_validation.accuracy - left.broad_validation.accuracy
    || right.targeted_validation.accuracy - left.targeted_validation.accuracy
    || left.policy_id.localeCompare(right.policy_id)
  )[0];
}

function deriveStatus(selected) {
  if (selected.validation.accuracy >= 0.75 && selected.final_selection.selection_support_rate >= 0.75) return "stratified_support_verifier_promising";
  if (selected.validation.accuracy >= 0.75) return "stratified_support_verifier_validates_but_final_unclear";
  return "stratified_support_verifier_conflict_unresolved";
}

function decisionFromStatus(status, selected) {
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    train_verifier_on_gpu_next: false,
    reason: status === "stratified_support_verifier_promising"
      ? "The stratified objective clears validation and final diagnostic thresholds, but still needs an integration audit before any GPU run."
      : `The validation-selected ${selected.policy_id} policy reaches ${(selected.validation.accuracy * 100).toFixed(1)}% validation accuracy and ${(selected.final_selection.selection_support_rate * 100).toFixed(1)}% final diagnostic selection support, so the objective conflict is not resolved.`,
    next_step: status === "stratified_support_verifier_promising"
      ? "Run a no-spend integration audit against the mixed selector and preregister a GPU verifier run only if integration holds."
      : "Stop local feature-only verifier work for this slice; either construct stronger semantic labels for broad preservation or use the targeted packet as a diagnostic ablation rather than a selector.",
  };
}

function buildConflictRows(policies) {
  const rows = [];
  for (const policy of policies) {
    for (const prediction of policy.validation_predictions.filter((row) => !row.correct)) {
      rows.push({
        policy_id: policy.policy_id,
        source_type: prediction.source_type,
        pair_id: prediction.pair_id,
        example_id: prediction.example_id,
        margin: prediction.margin,
      });
    }
  }
  return rows;
}

function candidateFeatures(input, candidate) {
  const answer = String(candidate.answer ?? "");
  const claimText = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim.text ?? claim)).join(" ");
  const citations = candidate.citations ?? [];
  const answerTokens = contentTokens(answer);
  const claimTokens = contentTokens(claimText);
  const evidenceText = (input?.compact_retrieved_evidence_pack ?? [])
    .filter((item) => !citations.length || citations.includes(item.evidence_id))
    .map((item) => item.text)
    .join(" ");
  const questionTokens = new Set(contentTokens(input?.question ?? ""));
  const evidenceTokens = new Set(contentTokens(evidenceText || (input?.compact_retrieved_evidence_pack ?? []).map((item) => item.text).join(" ")));
  const answerSet = new Set(answerTokens);
  const claimSet = new Set(claimTokens);
  return {
    log_answer_tokens: Math.log1p(answerTokens.length),
    log_claim_count: Math.log1p((candidate.claim_table ?? []).length),
    log_citation_count: Math.log1p(citations.length),
    inline_citation_complete: citations.length && citations.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    answer_question_overlap: overlapRate(answerSet, questionTokens),
    answer_evidence_overlap: overlapRate(answerSet, evidenceTokens),
    claim_answer_overlap: overlapRate(claimSet, answerSet),
    same_citation_shape_score: shapeScore(candidate),
    abstention_phrase: /\b(insufficient|not reported|not enough|cannot determine|not specified|no evidence)\b/i.test(answer) ? 1 : 0,
    jsonish_answer: /^\s*[{[]/.test(answer) ? 1 : 0,
    qwen_family: /qwen/i.test(String(candidate.family ?? candidate.id ?? candidate.prediction_run_id ?? "")) ? 1 : 0,
    openai_family: /openai|mini|gpt/i.test(String(candidate.family ?? candidate.id ?? candidate.prediction_run_id ?? "")) ? 1 : 0,
  };
}

function shapeScore(candidate) {
  const tokens = contentTokens(candidate.answer);
  const claims = candidate.claim_table ?? [];
  const citations = candidate.citations ?? [];
  let score = 0;
  if (tokens.length > 0) score += 1;
  if (citations.length > 0) score += 1;
  if (citations.every((id) => String(candidate.answer ?? "").includes(`[${id}]`))) score += 1;
  if (claims.length > 0 && claims.length <= 2) score += 1;
  if (tokens.length <= 24) score += 1;
  if (tokens.length > 64) score -= 1;
  if (claims.length > 3) score -= 1;
  return score;
}

function summarizePolicy(policy) {
  return {
    policy_id: policy.policy_id,
    validation_accuracy: policy.validation.accuracy,
    validation_correct: policy.validation.correct,
    validation_pairs: policy.validation.pairs,
    broad_validation_accuracy: policy.broad_validation.accuracy,
    targeted_validation_accuracy: policy.targeted_validation.accuracy,
    final_selected_supported: policy.final_selection.selected_supported,
    final_examples: policy.final_selection.examples,
    final_selection_support_rate: policy.final_selection.selection_support_rate,
  };
}

function summarizePredictions(rows) {
  const correct = rows.filter((row) => row.correct).length;
  return { pairs: rows.length, correct, accuracy: rate(correct, rows.length), mean_margin: mean(rows.map((row) => row.margin)) };
}

function weightsObject(model) {
  return Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]]));
}

function fitScaler(vectors) {
  return featureNames.map((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    return { name, center, scale: Math.sqrt(variance) || 1 };
  });
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => (value - scaler[index].center) / scaler[index].scale);
}

function scoreDelta(delta, model) {
  return dot(model.weights, scaleVector(delta, model.scaler));
}

function scoreFeatures(features, model) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name]), model.scaler));
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function overlapRate(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / left.size;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function renderReport(result) {
  const rows = Object.values(result.policies)
    .map((row) => `| ${row.policy_id} | ${pct(row.validation_accuracy)} | ${pct(row.broad_validation_accuracy)} | ${pct(row.targeted_validation_accuracy)} | ${row.final_selected_supported}/${row.final_examples} |`)
    .join("\n");
  return `# Stratified Support Verifier Audit

This audit tests whether separate broad-preservation and targeted-hard-negative objectives resolve the D360 validation conflict.

| Policy | Validation | Broad validation | Targeted validation | Final diagnostic |
| --- | ---: | ---: | ---: | ---: |
${rows}

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
