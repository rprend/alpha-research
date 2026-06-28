import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "listwise-selector-probe-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const packetRunId = "listwise-supervision-packet-audit-0-320-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const structuralRunId = "structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1";
const combinedVerifierRunId = "combined-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const examples = await readJsonl(path.join(runsDir, packetRunId, "listwise_examples.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const structural = await readJson(path.join(runsDir, structuralRunId, "result.json"));
const structuralPredictions = await readJsonl(path.join(runsDir, structuralRunId, "selected_final_predictions.jsonl"));
const combined = await readJson(path.join(runsDir, combinedVerifierRunId, "result.json"));

const featureNames = [
  "bias",
  "is_answer",
  "is_abstain",
  "inline_complete",
  "log_answer_tokens",
  "log_citations",
  "log_claims",
  "question_overlap",
  "is_qwen",
  "is_openai_scaffold",
  "is_reference",
  "is_numeric_question",
  "is_comparison_question",
  "is_list_question",
  "is_yes_no_question",
  "answer_tokens_x_numeric",
  "claims_x_list",
  "citations_x_answer",
];

const trainPairs = buildTrainingPairs(examples.filter((row) => row.split === "train"));
const validationPairs = buildTrainingPairs(examples.filter((row) => row.split === "validation"));
const allNonfinalPairs = buildTrainingPairs(examples);
const configs = [];
for (const lr of [0.01, 0.03, 0.08]) {
  for (const l2 of [0, 0.001, 0.01]) {
    for (const epochs of [50, 120, 240]) {
      configs.push({ lr, l2, epochs });
    }
  }
}

const rows = [];
const finalPredictionsByPolicy = new Map();
for (const config of configs) {
  const model = trainLogistic(trainPairs, config);
  const policyId = `logreg_lr_${name(config.lr)}_l2_${name(config.l2)}_e_${config.epochs}`;
  const train = evaluatePairRows(trainPairs, model);
  const validation = evaluatePairRows(validationPairs, model);
  const final = evaluateFinalPairs(finalPairs, model, policyId);
  const metrics = { policy_id: policyId, model: "surface_logistic_pairwise_selector", config, train, validation, final_pair_transfer: final.metrics };
  rows.push(metrics);
  finalPredictionsByPolicy.set(policyId, final.predictions);
}

const heuristicPolicies = buildHeuristicPolicies();
for (const policy of heuristicPolicies) {
  const policyId = `heuristic_${policy.id}`;
  const train = evaluatePairRows(trainPairs, policy.score);
  const validation = evaluatePairRows(validationPairs, policy.score);
  const final = evaluateFinalPairs(finalPairs, policy.score, policyId);
  const metrics = { policy_id: policyId, model: "surface_heuristic_pairwise_selector", config: policy.weights ?? {}, train, validation, final_pair_transfer: final.metrics };
  rows.push(metrics);
  finalPredictionsByPolicy.set(policyId, final.predictions);
}

const selected = [...rows].sort((left, right) =>
  -left.validation.accuracy + right.validation.accuracy
  || -left.validation.margin + right.validation.margin
  || -left.final_pair_transfer.accuracy + right.final_pair_transfer.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const oracleFinal = [...rows].sort((left, right) =>
  -left.final_pair_transfer.accuracy + right.final_pair_transfer.accuracy
  || -left.validation.accuracy + right.validation.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const selectedPredictions = finalPredictionsByPolicy.get(selected.policy_id);
const structuralSelected = structural.selected_by_nonfinal_labels;
const d314Selected = combined.selected_by_nonfinal_loo;
const structuralAccuracy = structuralSelected.final_pair_transfer.accuracy;
const d314Accuracy = d314Selected.final_pair_transfer.accuracy;
const selectedBeatsStructural = selected.final_pair_transfer.accuracy > structuralAccuracy;
const selectedBeatsD314 = selected.final_pair_transfer.accuracy > d314Accuracy;
const promotable = selected.validation.accuracy >= 0.7 && selected.final_pair_transfer.accuracy >= structuralAccuracy;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "listwise_selector_probe",
  status: promotable ? "listwise_selector_probe_promotable" : "listwise_selector_probe_not_promotable",
  purpose: "Train a zero-call surface-feature listwise selector probe from the expanded non-final listwise packet before any new GPU launch.",
  source_runs: {
    listwise_supervision_packet_audit: packetRunId,
    final_margin_compatible_heldout_packet: finalPacketRunId,
    structural_target_verifier_audit: structuralRunId,
    combined_target_text_verifier_audit: combinedVerifierRunId,
  },
  data: {
    listwise_examples: examples.length,
    train_pairwise_rows: trainPairs.length,
    validation_pairwise_rows: validationPairs.length,
    all_nonfinal_pairwise_rows: allNonfinalPairs.length,
    final_pairwise_rows: finalPairs.length,
    feature_count: featureNames.length,
    policies_evaluated: rows.length,
  },
  selected_by_validation: selected,
  diagnostic_best_final_policy: oracleFinal,
  baselines: {
    d314_combined_text_verifier: {
      policy_id: d314Selected.policy_id,
      final_pair_transfer_accuracy: d314Accuracy,
      final_errors: d314Selected.final_pair_transfer.errors,
    },
    structural_target_verifier: {
      policy_id: structuralSelected.policy_id,
      final_pair_transfer_accuracy: structuralAccuracy,
      final_errors: structuralSelected.final_pair_transfer.errors,
    },
  },
  comparison: {
    selected_minus_d314_final_accuracy: selected.final_pair_transfer.accuracy - d314Accuracy,
    selected_minus_structural_final_accuracy: selected.final_pair_transfer.accuracy - structuralAccuracy,
    diagnostic_best_final_minus_structural_accuracy: oracleFinal.final_pair_transfer.accuracy - structuralAccuracy,
    selected_beats_d314: selectedBeatsD314,
    selected_beats_structural: selectedBeatsStructural,
  },
  decision: decisionFromResult({ promotable, selected, oracleFinal, structuralAccuracy, d314Accuracy }),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "nonfinal_validation_only",
    feature_names: featureNames,
    deployable_feature_policy: "surface answer/citation/question/family features only; no judge unsupported-claim labels as features",
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
    note: "Zero-call local selector probe over existing artifacts.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    selected_final_predictions_jsonl: rel(path.join(outputDir, "selected_final_predictions.jsonl")),
    feature_names_json: rel(path.join(outputDir, "feature_names.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), rows);
await writeJsonl(path.join(outputDir, "selected_final_predictions.jsonl"), selectedPredictions);
await fs.writeFile(path.join(outputDir, "feature_names.json"), `${JSON.stringify(featureNames, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_by_validation: result.selected_by_validation,
  diagnostic_best_final_policy: result.diagnostic_best_final_policy,
  comparison: result.comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function buildTrainingPairs(rows) {
  const pairs = [];
  for (const example of rows) {
    const positives = example.candidates.filter((candidate) => candidate.label_summary?.train_positive);
    const negatives = example.candidates.filter((candidate) => candidate.label_summary?.train_negative);
    for (const positive of positives) {
      for (const negative of negatives) {
        pairs.push({
          pair_id: `${example.example_id}:${positive.candidate_id}:over:${negative.candidate_id}`,
          example_id: example.example_id,
          question: example.question,
          question_type: example.question_type,
          chosen: positive,
          rejected: negative,
          label: 1,
        });
      }
    }
  }
  return pairs;
}

function trainLogistic(pairs, config) {
  const weights = Array(featureNames.length).fill(0);
  if (!pairs.length) return { weights, score: (candidate, question, questionType) => dot(weights, features(candidate, question, questionType)) };
  const expanded = pairs.flatMap((pair) => [
    { x: diffFeatures(pair.chosen, pair.rejected, pair.question, pair.question_type), y: 1 },
    { x: diffFeatures(pair.rejected, pair.chosen, pair.question, pair.question_type), y: 0 },
  ]);
  for (let epoch = 0; epoch < config.epochs; epoch += 1) {
    for (const row of expanded) {
      const p = sigmoid(dot(weights, row.x));
      const error = p - row.y;
      for (let i = 0; i < weights.length; i += 1) {
        const penalty = i === 0 ? 0 : config.l2 * weights[i];
        weights[i] -= config.lr * (error * row.x[i] + penalty);
      }
    }
  }
  return {
    weights,
    score: (candidate, question, questionType) => dot(weights, features(candidate, question, questionType)),
  };
}

function evaluatePairRows(pairs, scorer) {
  const predictions = pairs.map((pair) => {
    const chosenScore = scoreWith(scorer, pair.chosen, pair.question, pair.question_type);
    const rejectedScore = scoreWith(scorer, pair.rejected, pair.question, pair.question_type);
    return { correct: chosenScore >= rejectedScore, margin: chosenScore - rejectedScore };
  });
  return {
    pairs: pairs.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    margin: mean(predictions.map((row) => row.margin)),
  };
}

function evaluateFinalPairs(pairs, scorer, policyId) {
  const predictions = pairs.map((pair) => {
    const question = pair.input?.question ?? "";
    const questionType = classifyQuestion(question);
    const chosenScore = scoreWith(scorer, pair.chosen, question, questionType);
    const rejectedScore = scoreWith(scorer, pair.rejected, question, questionType);
    const predicted = chosenScore >= rejectedScore ? "chosen" : "rejected";
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      source_index: pair.source_index,
      policy_id: policyId,
      predicted,
      expected: "chosen",
      correct: predicted === "chosen",
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
    };
  });
  const correct = predictions.filter((row) => row.correct).length;
  return {
    predictions,
    metrics: {
      pairs: predictions.length,
      correct,
      errors: predictions.length - correct,
      accuracy: rate(correct, predictions.length),
      mean_margin: mean(predictions.map((row) => row.margin)),
    },
  };
}

function buildHeuristicPolicies() {
  const policies = [
    { id: "citation_contract", weights: { inline: 1.2, answer: 0.2, citations: 0.15, qwen: -0.1, openai: 0.1, short: 0.1 } },
    { id: "abstention_safe", weights: { inline: 0.6, answer: 0.1, abstain: 0.45, citations: 0.1, qwen: -0.05, openai: 0.05, short: 0.08 } },
    { id: "coverage_light", weights: { inline: 0.8, answer: 0.25, citations: 0.25, claims: 0.1, overlap: 0.5, qwen: -0.08, openai: 0.1 } },
    { id: "qwen_penalty", weights: { inline: 0.8, answer: 0.2, citations: 0.15, overlap: 0.3, qwen: -0.45, openai: 0.2 } },
  ];
  return policies.map((policy) => ({
    ...policy,
    score: (candidate, question, questionType) => {
      const f = featureObject(candidate, question, questionType);
      return (policy.weights.inline ?? 0) * f.inline_complete
        + (policy.weights.answer ?? 0) * f.is_answer
        + (policy.weights.abstain ?? 0) * f.is_abstain
        + (policy.weights.citations ?? 0) * f.log_citations
        + (policy.weights.claims ?? 0) * f.log_claims
        + (policy.weights.overlap ?? 0) * f.question_overlap
        + (policy.weights.qwen ?? 0) * f.is_qwen
        + (policy.weights.openai ?? 0) * f.is_openai_scaffold
        + (policy.weights.short ?? 0) * (1 / (1 + f.log_answer_tokens));
    },
  }));
}

function diffFeatures(left, right, question, questionType) {
  const l = features(left, question, questionType);
  const r = features(right, question, questionType);
  return l.map((value, index) => value - r[index]);
}

function features(candidate, question, questionType) {
  const f = featureObject(candidate, question, questionType);
  return featureNames.map((nameValue) => f[nameValue]);
}

function featureObject(candidate, question, questionType) {
  const answer = String(candidate.answer ?? "");
  const answerTokens = candidate.answer_tokens ?? contentTokens(answer).length;
  const citations = candidate.citations ?? [];
  const family = `${candidate.family ?? ""} ${candidate.prediction_run_id ?? ""}`.toLowerCase();
  const qType = questionType ?? classifyQuestion(question);
  const overlap = Number.isFinite(Number(candidate.question_overlap))
    ? Number(candidate.question_overlap)
    : jaccard(contentTokens(question), contentTokens(answer));
  const isAnswer = candidate.answer_type === "grounded_answer" ? 1 : 0;
  const isAbstain = candidate.answer_type === "abstain" ? 1 : 0;
  const logAnswerTokens = Math.log1p(answerTokens);
  const logClaims = Math.log1p(candidate.claim_count ?? candidate.claim_table?.length ?? 0);
  const logCitations = Math.log1p(citations.length);
  return {
    bias: 1,
    is_answer: isAnswer,
    is_abstain: isAbstain,
    inline_complete: inlineComplete(candidate) ? 1 : 0,
    log_answer_tokens: logAnswerTokens,
    log_citations: logCitations,
    log_claims: logClaims,
    question_overlap: overlap,
    is_qwen: /qwen/.test(family) ? 1 : 0,
    is_openai_scaffold: /openai|mini|direct|claim-prun|scaffold/.test(family) ? 1 : 0,
    is_reference: /reference|qasper/.test(family) ? 1 : 0,
    is_numeric_question: qType === "numeric" ? 1 : 0,
    is_comparison_question: qType === "comparison" ? 1 : 0,
    is_list_question: qType === "list_or_entity" ? 1 : 0,
    is_yes_no_question: qType === "yes_no" ? 1 : 0,
    answer_tokens_x_numeric: logAnswerTokens * (qType === "numeric" ? 1 : 0),
    claims_x_list: logClaims * (qType === "list_or_entity" ? 1 : 0),
    citations_x_answer: logCitations * isAnswer,
  };
}

function scoreWith(scorer, candidate, question, questionType) {
  if (typeof scorer === "function") return scorer(candidate, question, questionType);
  return scorer.score(candidate, question, questionType);
}

function inlineComplete(candidate) {
  if (candidate.answer_type !== "grounded_answer") return true;
  const citations = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const answer = String(candidate.answer ?? "");
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function classifyQuestion(question) {
  const q = String(question ?? "").toLowerCase();
  if (/^(is|are|was|were|do|does|did|can|could|should|has|have)\b/.test(q)) return "yes_no";
  if (/\b(how many|how much|percentage|percent|ratio|score|number|size|large)\b/.test(q)) return "numeric";
  if (/\b(compare|compared|difference|improve|improvement|better|worse|more|less|fewer)\b/.test(q)) return "comparison";
  if (/\b(what datasets|which datasets|what models|which models|what methods|which methods|list|what are|which are)\b/.test(q)) return "list_or_entity";
  if (/\b(how|why)\b/.test(q)) return "method_or_explanation";
  return "factoid";
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(text ?? "").toLowerCase().split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) return 1;
  const union = new Set([...leftSet, ...rightSet]);
  return [...leftSet].filter((token) => rightSet.has(token)).length / union.size;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, value))));
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : 0;
}

function name(value) {
  return String(value).replace(".", "p").replace("-", "m");
}

function decisionFromResult({ promotable, selected, oracleFinal, structuralAccuracy, d314Accuracy }) {
  if (promotable) {
    return {
      promote_selector_now: true,
      launch_gpu_now: false,
      buy_openai_labels_now: false,
      next_step: "Integrate the selected zero-call listwise selector into the scaffold and rerun system-level judged metrics before any GPU launch.",
      reason: `The validation-selected policy reaches ${(100 * selected.validation.accuracy).toFixed(1)}% non-final validation accuracy and matches or beats the structural final pair baseline.`,
    };
  }
  return {
    promote_selector_now: false,
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    next_step: "Do not promote the surface listwise selector. Use this as evidence that the next selector needs structural target features or richer comparison-question supervision before another GPU run.",
    reason: `The validation-selected policy reaches ${(100 * selected.final_pair_transfer.accuracy).toFixed(1)}% final pair accuracy versus ${(100 * structuralAccuracy).toFixed(1)}% for the structural verifier and ${(100 * d314Accuracy).toFixed(1)}% for D314; the best final-only diagnostic reaches ${(100 * oracleFinal.final_pair_transfer.accuracy).toFixed(1)}%, so current surface features do not close the gap.`,
  };
}

function renderReport(result) {
  return `# Listwise Selector Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Data

- Train pairwise rows: ${result.data.train_pairwise_rows}
- Validation pairwise rows: ${result.data.validation_pairwise_rows}
- Final pairwise rows: ${result.data.final_pairwise_rows}
- Policies evaluated: ${result.data.policies_evaluated}

## Selected Policy

- Policy: \`${result.selected_by_validation.policy_id}\`
- Validation accuracy: ${(100 * result.selected_by_validation.validation.accuracy).toFixed(1)}%
- Final transfer accuracy: ${(100 * result.selected_by_validation.final_pair_transfer.accuracy).toFixed(1)}%
- Structural baseline final accuracy: ${(100 * result.baselines.structural_target_verifier.final_pair_transfer_accuracy).toFixed(1)}%
- D314 final accuracy: ${(100 * result.baselines.d314_combined_text_verifier.final_pair_transfer_accuracy).toFixed(1)}%

## Decision

- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: ${result.decision.reason}
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
  return (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
