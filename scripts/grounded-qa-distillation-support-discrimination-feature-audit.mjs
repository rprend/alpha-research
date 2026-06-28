import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "support-discrimination-feature-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const packetRunId = "high-score-unsupported-packet-audit-0-320-to-321-389-2026-06-28-v1";
const integrationRunId = "listwise-selector-integration-final-window-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const packetRows = await readJsonl(path.join(runsDir, packetRunId, "packet_rows.jsonl"));
const finalRows = await readJsonl(path.join(runsDir, integrationRunId, "rows_with_listwise_scores.jsonl"));
const trainPairs = packetRows.filter((row) => row.split === "train");
const validationPairs = packetRows.filter((row) => row.split === "validation");
const finalPairs = buildFinalPairs(finalRows);

const featureNames = [
  "bias",
  "is_answer",
  "is_abstain",
  "listwise_score",
  "log_answer_tokens",
  "log_citations",
  "log_claims",
  "question_overlap",
  "citation_density",
  "claim_density",
  "numeric_token_count",
  "comparative_token_count",
  "is_qwen",
  "is_openai",
  "answer_x_overlap",
  "claims_x_citations",
];

const policies = [];
for (const lr of [0.005, 0.01, 0.03, 0.08]) {
  for (const l2 of [0, 0.001, 0.01, 0.05]) {
    for (const epochs of [80, 160, 320]) {
      const model = trainLogistic(trainPairs, { lr, l2, epochs });
      const policyId = `logreg_lr_${name(lr)}_l2_${name(l2)}_e_${epochs}`;
      policies.push({
        policy_id: policyId,
        model: "support_discrimination_logistic_pairwise",
        config: { lr, l2, epochs },
        weights: Object.fromEntries(featureNames.map((feature, index) => [feature, model.weights[index]])),
        train: evaluatePairs(trainPairs, model.score),
        validation: evaluatePairs(validationPairs, model.score),
        final_analog_reporting: evaluatePairs(finalPairs, model.score),
      });
    }
  }
}

for (const heuristic of heuristicPolicies()) {
  policies.push({
    policy_id: `heuristic_${heuristic.id}`,
    model: "support_discrimination_surface_heuristic",
    config: heuristic.config,
    weights: null,
    train: evaluatePairs(trainPairs, heuristic.score),
    validation: evaluatePairs(validationPairs, heuristic.score),
    final_analog_reporting: evaluatePairs(finalPairs, heuristic.score),
  });
}

const selected = selectByValidation(policies);
const diagnosticBestFinal = [...policies].sort((left, right) =>
  -left.final_analog_reporting.accuracy + right.final_analog_reporting.accuracy
  || -left.validation.accuracy + right.validation.accuracy
  || left.policy_id.localeCompare(right.policy_id)
)[0];
const selectedFinalPredictions = predictPairs(finalPairs, scorerForPolicy(selected));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_discrimination_feature_audit",
  status: statusFor(selected),
  purpose: "Test whether deployable surface features can distinguish supported alternatives from high-scoring unsupported direct answers.",
  source_runs: {
    high_score_unsupported_packet_audit: packetRunId,
    listwise_selector_integration: integrationRunId,
  },
  data: {
    train_pairs: trainPairs.length,
    validation_pairs: validationPairs.length,
    final_analog_pairs: finalPairs.length,
    final_analog_examples: new Set(finalPairs.map((row) => row.example_id)).size,
    feature_count: featureNames.length,
    policies_evaluated: policies.length,
  },
  selected_by_validation: selected,
  diagnostic_best_final_policy: diagnosticBestFinal,
  comparison: {
    selected_validation_accuracy: selected.validation.accuracy,
    selected_final_analog_accuracy: selected.final_analog_reporting.accuracy,
    selected_final_analog_margin: selected.final_analog_reporting.mean_margin,
    selected_final_above_random: selected.final_analog_reporting.accuracy - 0.5,
    diagnostic_best_final_above_selected: diagnosticBestFinal.final_analog_reporting.accuracy - selected.final_analog_reporting.accuracy,
  },
  decision: decisionFromResult(selected),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "nonfinal_high_score_unsupported_validation_only",
    deployable_feature_policy: "surface answer/citation/question/family/listwise-score features only; unsupported labels are targets, not inference features",
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
    note: "Zero-call support-discrimination audit over existing hard-negative packet.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    selected_final_predictions_jsonl: rel(path.join(outputDir, "selected_final_predictions.jsonl")),
    feature_names_json: rel(path.join(outputDir, "feature_names.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies);
await writeJsonl(path.join(outputDir, "selected_final_predictions.jsonl"), selectedFinalPredictions);
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
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function trainLogistic(pairs, config) {
  const weights = Array(featureNames.length).fill(0);
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

function heuristicPolicies() {
  return [
    {
      id: "shorter_supported_shape",
      config: { length_penalty: 0.25, citation_bonus: 0.2, overlap_bonus: 0.5 },
      score: (candidate) => Number(candidate.question_overlap ?? 0) * 0.5 + Math.log1p(candidate.citations?.length ?? 0) * 0.2 - Math.log1p(Number(candidate.answer_tokens ?? 0)) * 0.25,
    },
    {
      id: "claim_density_penalty",
      config: { claim_density_penalty: 0.8, overlap_bonus: 0.4 },
      score: (candidate) => Number(candidate.question_overlap ?? 0) * 0.4 - claimDensity(candidate) * 0.8,
    },
    {
      id: "numeric_comparative_penalty",
      config: { numeric_penalty: 0.15, comparative_penalty: 0.35, overlap_bonus: 0.4 },
      score: (candidate) => Number(candidate.question_overlap ?? 0) * 0.4 - numericTokenCount(candidate.answer) * 0.15 - comparativeTokenCount(candidate.answer) * 0.35,
    },
  ];
}

function selectByValidation(rows) {
  return [...rows].sort((left, right) =>
    -left.validation.accuracy + right.validation.accuracy
    || -left.validation.mean_margin + right.validation.mean_margin
    || -left.train.accuracy + right.train.accuracy
    || left.policy_id.localeCompare(right.policy_id)
  )[0];
}

function evaluatePairs(pairs, scorer) {
  const predictions = predictPairs(pairs, scorer);
  const correct = predictions.filter((row) => row.correct).length;
  return {
    pairs: predictions.length,
    correct,
    errors: predictions.length - correct,
    accuracy: ratio(correct, predictions.length),
    mean_margin: mean(predictions.map((row) => row.margin)),
  };
}

function predictPairs(pairs, scorer) {
  return pairs.map((pair) => {
    const chosenScore = scoreWith(scorer, pair.chosen, pair.question, pair.question_type);
    const rejectedScore = scoreWith(scorer, pair.rejected, pair.question, pair.question_type);
    return {
      pair_id: pair.row_id ?? pair.pair_id,
      example_id: pair.example_id,
      chosen_id: pair.chosen.candidate_id,
      rejected_id: pair.rejected.candidate_id,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
      predicted: chosenScore >= rejectedScore ? "chosen" : "rejected",
      expected: "chosen",
      correct: chosenScore >= rejectedScore,
    };
  });
}

function scorerForPolicy(policy) {
  if (policy.model === "support_discrimination_surface_heuristic") {
    return heuristicPolicies().find((heuristic) => `heuristic_${heuristic.id}` === policy.policy_id).score;
  }
  const weights = featureNames.map((feature) => Number(policy.weights?.[feature] ?? 0));
  return (candidate, question, questionType) => dot(weights, features(candidate, question, questionType));
}

function scoreWith(scorer, candidate, question, questionType) {
  if (typeof scorer === "function") return scorer(candidate, question, questionType);
  return scorer.score(candidate, question, questionType);
}

function buildFinalPairs(rows) {
  const out = [];
  for (const row of rows) {
    const positives = row.candidates
      .filter((candidate) => candidate.supported_answer || candidate.supported_abstention)
      .map((candidate) => finalCandidate(candidate, row.question));
    const negatives = row.candidates
      .filter((candidate) => candidate.prediction?.answer_type === "grounded_answer")
      .filter((candidate) => Number(candidate.listwise_selector?.score ?? -Infinity) >= 1.4)
      .filter((candidate) => candidate.supported_answer !== true)
      .map((candidate) => finalCandidate(candidate, row.question));
    for (const rejected of negatives) {
      for (const chosen of positives) {
        out.push({
          pair_id: `${row.example_id}:${chosen.candidate_id}:over:${rejected.candidate_id}`,
          example_id: row.example_id,
          question: row.question,
          question_type: inferQuestionType(row.question),
          chosen,
          rejected,
        });
      }
    }
  }
  return out;
}

function finalCandidate(candidate, question) {
  const prediction = candidate.prediction ?? {};
  const answer = String(prediction.answer ?? "");
  const citations = Array.isArray(prediction.citations) ? prediction.citations : [];
  const claims = Array.isArray(prediction.claim_table) ? prediction.claim_table : [];
  return {
    candidate_id: candidate.id,
    family: candidate.family,
    answer_type: prediction.answer_type,
    answer,
    citations,
    claim_count: claims.length,
    answer_tokens: contentTokens(answer).length,
    inline_complete: candidate.contract?.answer_citation_complete === true,
    question_overlap: tokenOverlap(question, answer),
    listwise_score: Number(candidate.listwise_selector?.score ?? 0),
  };
}

function diffFeatures(left, right, question, questionType) {
  const lf = features(left, question, questionType);
  const rf = features(right, question, questionType);
  return lf.map((value, index) => value - rf[index]);
}

function features(candidate, question, questionType) {
  const answerType = candidate.answer_type;
  const answer = String(candidate.answer ?? "");
  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  const answerTokens = Number(candidate.answer_tokens ?? contentTokens(answer).length);
  const claimCount = Number(candidate.claim_count ?? 0);
  const questionOverlap = Number(candidate.question_overlap ?? tokenOverlap(question, answer));
  const isAnswer = answerType === "grounded_answer" ? 1 : 0;
  const isAbstain = answerType === "abstain" ? 1 : 0;
  const logAnswerTokens = Math.log1p(answerTokens);
  const logCitations = Math.log1p(citations.length);
  const logClaims = Math.log1p(claimCount);
  return [
    1,
    isAnswer,
    isAbstain,
    Number(candidate.listwise_score ?? 0),
    logAnswerTokens,
    logCitations,
    logClaims,
    questionOverlap,
    citationDensity({ citations, answer_tokens: answerTokens }),
    claimDensity({ claim_count: claimCount, answer_tokens: answerTokens }),
    numericTokenCount(answer),
    comparativeTokenCount(answer),
    String(candidate.family ?? "").startsWith("qwen") ? 1 : 0,
    String(candidate.family ?? "").includes("openai") ? 1 : 0,
    isAnswer * questionOverlap,
    logClaims * logCitations,
  ];
}

function statusFor(selected) {
  if (selected.validation.accuracy >= 0.75 && selected.final_analog_reporting.accuracy >= 0.65) return "support_discrimination_signal_transfers";
  if (selected.validation.accuracy >= 0.75) return "support_discrimination_signal_overfits_nonfinal";
  return "support_discrimination_signal_not_sufficient";
}

function decisionFromResult(selected) {
  if (statusFor(selected) === "support_discrimination_signal_transfers") {
    return {
      integrate_support_discriminator_next: true,
      buy_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The non-final-selected support discriminator transfers above the final analog threshold, so the next zero-call step is an end-to-end selector integration audit.",
    };
  }
  return {
    integrate_support_discriminator_next: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    reason: "The deployable surface features do not transfer strongly enough on final analog hard negatives to justify scaffold integration or new GPU spend.",
  };
}

function renderReport(result) {
  const selected = result.selected_by_validation;
  return `# Support-Discrimination Feature Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no API calls and launches no compute.

## Data

- Train pairs: ${result.data.train_pairs}
- Validation pairs: ${result.data.validation_pairs}
- Final analog pairs: ${result.data.final_analog_pairs}
- Policies evaluated: ${result.data.policies_evaluated}

## Selected Policy

- Policy: \`${selected.policy_id}\`
- Validation accuracy: ${pct(selected.validation.accuracy)}
- Final analog accuracy: ${pct(selected.final_analog_reporting.accuracy)}
- Final analog mean margin: ${selected.final_analog_reporting.mean_margin.toFixed(3)}

## Decision

- Integrate support discriminator next: ${result.decision.integrate_support_discriminator_next ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

function inferQuestionType(question) {
  const q = String(question ?? "").toLowerCase();
  if (/^(is|are|was|were|does|do|did|can|could|has|have|had)\b/.test(q)) return "yes_no";
  if (/\b(how many|number|percentage|percent|score|rate)\b/.test(q)) return "numeric";
  if (/\b(compare|better|worse|higher|lower|versus|vs)\b/.test(q)) return "comparison";
  if (/\b(which|what)\b/.test(q)) return "factoid";
  return "method_or_explanation";
}

function citationDensity(candidate) {
  return ratio((candidate.citations ?? []).length, Math.max(1, Number(candidate.answer_tokens ?? 0)));
}

function claimDensity(candidate) {
  return ratio(Number(candidate.claim_count ?? 0), Math.max(1, Number(candidate.answer_tokens ?? 0)));
}

function numericTokenCount(text) {
  return (String(text ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
}

function comparativeTokenCount(text) {
  return (String(text ?? "").toLowerCase().match(/\b(more|less|better|worse|higher|lower|best|worst|larger|smaller|improve|outperform|underperform|significant|significantly)\b/g) ?? []).length;
}

function contentTokens(text) {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function tokenOverlap(question, answer) {
  const questionTokens = new Set(contentTokens(question).filter((token) => token.length > 2));
  const answerTokens = new Set(contentTokens(answer).filter((token) => token.length > 2));
  if (!questionTokens.size) return 0;
  let hits = 0;
  for (const token of questionTokens) {
    if (answerTokens.has(token)) hits += 1;
  }
  return hits / questionTokens.size;
}

function dot(weights, xs) {
  return weights.reduce((sum, weight, index) => sum + weight * xs[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function name(value) {
  return String(value).replace(".", "p");
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
