import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "adjudicated-support-selector-probe-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const labelRunId = "high-score-support-label-batch-run-gpt4o-mini-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const labelRun = await readJson(path.join(runsDir, labelRunId, "result.json"));
const rows = await readJsonl(path.join(runsDir, labelRunId, "adjudications.jsonl"));
const requestRows = await readJsonl(path.join(runsDir, labelRunId, "requests.jsonl"));
const requestById = new Map(requestRows.map((row) => [row.request_id, row]));
const primary = rows.filter((row) => !row.skipped && row.metadata?.duplicate_calibration !== true);
const calibration = rows.filter((row) => !row.skipped && row.metadata?.duplicate_calibration === true);
const nonfinal = primary.filter((row) => row.metadata?.source === "nonfinal_high_score_packet");
const final = primary.filter((row) => row.metadata?.source === "final_analog_validation_only");
const nonfinalUsable = nonfinal.filter((row) => row.judgment?.preferred_candidate === "chosen" && row.judgment?.rejected_answer_supported === false);
const finalUsable = final.filter((row) => row.judgment?.preferred_candidate === "chosen" && row.judgment?.rejected_answer_supported === false);
const split = splitByExample(nonfinalUsable, 0.7);

const featureNames = [
  "bias",
  "is_answer",
  "log_answer_tokens",
  "log_citations",
  "log_claims",
  "question_overlap",
  "citation_density",
  "claim_density",
  "numeric_token_count",
  "comparative_token_count",
  "is_openai_family",
  "inline_complete",
  "answer_x_overlap",
  "claims_x_citations",
];

const policies = [];
for (const lr of [0.005, 0.01, 0.03, 0.08]) {
  for (const l2 of [0, 0.001, 0.01, 0.05]) {
    for (const epochs of [80, 160, 320]) {
      const model = trainLogistic(split.train, { lr, l2, epochs });
      const policyId = `logreg_lr_${name(lr)}_l2_${name(l2)}_e_${epochs}`;
      policies.push({
        policy_id: policyId,
        model: "adjudicated_support_logistic_pairwise",
        config: { lr, l2, epochs },
        weights: Object.fromEntries(featureNames.map((feature, index) => [feature, model.weights[index]])),
        nonfinal_train: evaluatePairs(split.train, model.score),
        nonfinal_validation: evaluatePairs(split.validation, model.score),
        final_reporting: evaluatePairs(finalUsable, model.score),
      });
    }
  }
}
for (const heuristic of heuristicPolicies()) {
  policies.push({
    policy_id: `heuristic_${heuristic.id}`,
    model: "adjudicated_support_surface_heuristic",
    config: heuristic.config,
    weights: null,
    nonfinal_train: evaluatePairs(split.train, heuristic.score),
    nonfinal_validation: evaluatePairs(split.validation, heuristic.score),
    final_reporting: evaluatePairs(finalUsable, heuristic.score),
  });
}

const selected = selectByNonfinalValidation(policies);
const finalPredictions = predictPairs(finalUsable, scorerForPolicy(selected));
const nonfinalValidationPredictions = predictPairs(split.validation, scorerForPolicy(selected));
const calibrationSummary = summarizeCalibration(primary, calibration);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "adjudicated_support_selector_probe",
  status: statusFor(selected, calibrationSummary),
  label_run_id: labelRunId,
  purpose: "Train/select a zero-cost support selector only from non-final paid adjudications, then report transfer on final-window adjudications without using them for model selection.",
  data: {
    primary_labels: primary.length,
    nonfinal_primary_labels: nonfinal.length,
    final_primary_labels_reporting_only: final.length,
    nonfinal_usable_chosen_over_unsupported: nonfinalUsable.length,
    final_usable_chosen_over_unsupported_reporting_only: finalUsable.length,
    nonfinal_train_pairs: split.train.length,
    nonfinal_validation_pairs: split.validation.length,
    policies_evaluated: policies.length,
  },
  calibration: calibrationSummary,
  selected_by_nonfinal_validation: selected,
  comparison: {
    selected_nonfinal_validation_accuracy: selected.nonfinal_validation.accuracy,
    selected_final_reporting_accuracy: selected.final_reporting.accuracy,
    final_reporting_above_random: selected.final_reporting.accuracy - 0.5,
  },
  decision: decisionFromResult(selected, calibrationSummary, split, finalUsable),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_transfer: true,
    selected_policy_source: "nonfinal_adjudicated_support_labels_only",
    duplicate_calibration_final_rows_used_for_training: false,
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    label_run_cost_usd: labelRun.run_cost_usd,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Zero-call selector probe over already-ledgered adjudications.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    nonfinal_validation_predictions_jsonl: rel(path.join(outputDir, "nonfinal_validation_predictions.jsonl")),
    final_reporting_predictions_jsonl: rel(path.join(outputDir, "final_reporting_predictions.jsonl")),
    feature_names_json: rel(path.join(outputDir, "feature_names.json")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policies);
await writeJsonl(path.join(outputDir, "nonfinal_validation_predictions.jsonl"), nonfinalValidationPredictions);
await writeJsonl(path.join(outputDir, "final_reporting_predictions.jsonl"), finalPredictions);
await fs.writeFile(path.join(outputDir, "feature_names.json"), `${JSON.stringify(featureNames, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  data: result.data,
  calibration: result.calibration,
  selected_by_nonfinal_validation: result.selected_by_nonfinal_validation,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
}, null, 2));

function splitByExample(pairs, trainFraction) {
  const examples = [...new Set(pairs.map((row) => row.example_id))].sort();
  const trainCount = Math.max(1, Math.floor(examples.length * trainFraction));
  const trainExamples = new Set(examples.slice(0, trainCount));
  return {
    train: pairs.filter((row) => trainExamples.has(row.example_id)),
    validation: pairs.filter((row) => !trainExamples.has(row.example_id)),
  };
}

function trainLogistic(pairs, config) {
  const weights = Array(featureNames.length).fill(0);
  const expanded = pairs.flatMap((pair) => [
    { x: diffFeatures(pair, "chosen", "rejected"), y: 1 },
    { x: diffFeatures(pair, "rejected", "chosen"), y: 0 },
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
    score: (candidate, question) => dot(weights, features(candidate, question)),
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

function selectByNonfinalValidation(rows) {
  return [...rows].sort((left, right) =>
    -left.nonfinal_validation.accuracy + right.nonfinal_validation.accuracy
    || -left.nonfinal_validation.mean_margin + right.nonfinal_validation.mean_margin
    || -left.nonfinal_train.accuracy + right.nonfinal_train.accuracy
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
    const chosen = pairCandidate(pair, "chosen");
    const rejected = pairCandidate(pair, "rejected");
    const question = pair.question;
    const chosenScore = scorer(chosen, question);
    const rejectedScore = scorer(rejected, question);
    return {
      request_id: pair.request_id,
      example_id: pair.example_id,
      chosen_id: chosen.candidate_id,
      rejected_id: rejected.candidate_id,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      margin: chosenScore - rejectedScore,
      predicted: chosenScore >= rejectedScore ? "chosen" : "rejected",
      expected: "chosen",
      correct: chosenScore >= rejectedScore,
      failure_mode: pair.judgment?.rejected_failure_mode,
    };
  });
}

function scorerForPolicy(policy) {
  if (policy.model === "adjudicated_support_surface_heuristic") {
    return heuristicPolicies().find((heuristic) => `heuristic_${heuristic.id}` === policy.policy_id).score;
  }
  const weights = featureNames.map((feature) => Number(policy.weights?.[feature] ?? 0));
  return (candidate, question) => dot(weights, features(candidate, question));
}

function diffFeatures(pair, leftKey, rightKey) {
  const lf = features(pairCandidate(pair, leftKey), pair.question);
  const rf = features(pairCandidate(pair, rightKey), pair.question);
  return lf.map((value, index) => value - rf[index]);
}

function pairCandidate(pair, key) {
  const request = requestById.get(pair.request_id);
  if (!request) throw new Error(`Missing request for ${pair.request_id}.`);
  return request.input[`candidate_${key}`];
}

function features(candidate, question) {
  const answer = String(candidate.answer ?? "");
  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  const answerTokens = Number(candidate.answer_tokens ?? contentTokens(answer).length);
  const claimCount = Number(candidate.claim_count ?? candidate.claim_table?.length ?? 0);
  const questionOverlap = Number(candidate.question_overlap ?? tokenOverlap(question, answer));
  const logAnswerTokens = Math.log1p(answerTokens);
  const logCitations = Math.log1p(citations.length);
  const logClaims = Math.log1p(claimCount);
  return [
    1,
    candidate.answer_type === "grounded_answer" ? 1 : 0,
    logAnswerTokens,
    logCitations,
    logClaims,
    questionOverlap,
    citationDensity({ citations, answer_tokens: answerTokens }),
    claimDensity({ claim_count: claimCount, answer_tokens: answerTokens }),
    numericTokenCount(answer),
    comparativeTokenCount(answer),
    String(candidate.family ?? "").includes("openai") ? 1 : 0,
    candidate.inline_complete === true ? 1 : 0,
    (candidate.answer_type === "grounded_answer" ? 1 : 0) * questionOverlap,
    logClaims * logCitations,
  ];
}

function summarizeCalibration(primaryRows, calibrationRows) {
  const primaryById = new Map(primaryRows.map((row) => [row.request_id, row]));
  const pairs = calibrationRows.map((row) => {
    const original = primaryById.get(primaryRequestIdForCalibration(row.request_id));
    return {
      calibration_request_id: row.request_id,
      source: row.metadata?.source,
      original_request_id: original?.request_id ?? null,
      exact_match: Boolean(original) && sameJudgment(original.judgment, row.judgment),
      support_match: Boolean(original) && original.judgment?.rejected_answer_supported === row.judgment?.rejected_answer_supported,
      preference_match: Boolean(original) && original.judgment?.preferred_candidate === row.judgment?.preferred_candidate,
    };
  });
  const nonfinalPairs = pairs.filter((row) => row.source === "nonfinal_high_score_packet");
  const finalPairs = pairs.filter((row) => row.source === "final_analog_validation_only");
  return {
    pairs: pairs.length,
    exact_matches: pairs.filter((row) => row.exact_match).length,
    support_matches: pairs.filter((row) => row.support_match).length,
    preference_matches: pairs.filter((row) => row.preference_match).length,
    nonfinal_exact_matches: nonfinalPairs.filter((row) => row.exact_match).length,
    nonfinal_pairs: nonfinalPairs.length,
    final_exact_matches: finalPairs.filter((row) => row.exact_match).length,
    final_pairs: finalPairs.length,
    details: pairs,
  };
}

function primaryRequestIdForCalibration(requestId) {
  const nonfinal = String(requestId).match(/^hs-support-nonfinal-calibration-(\d+)$/);
  if (nonfinal) return `hs-support-nonfinal-primary-${nonfinal[1]}`;
  const final = String(requestId).match(/^hs-support-final-calibration-(\d+)$/);
  if (final) return `hs-support-final-validation-${final[1]}`;
  return requestId;
}

function sameJudgment(left, right) {
  return left?.rejected_answer_supported === right?.rejected_answer_supported
    && left?.rejected_failure_mode === right?.rejected_failure_mode
    && left?.preferred_candidate === right?.preferred_candidate
    && left?.support_discriminator_hint === right?.support_discriminator_hint;
}

function statusFor(selected, calibrationSummary) {
  if (calibrationSummary.nonfinal_exact_matches < calibrationSummary.nonfinal_pairs) return "nonfinal_labels_unstable";
  if (selected.nonfinal_validation.accuracy >= 0.75 && selected.final_reporting.accuracy >= 0.65) return "adjudicated_support_selector_transfers";
  if (selected.nonfinal_validation.accuracy >= 0.75) return "adjudicated_support_selector_overfits_nonfinal";
  return "adjudicated_support_selector_not_sufficient";
}

function decisionFromResult(selected, calibrationSummary, split, finalUsableRows) {
  if (calibrationSummary.nonfinal_exact_matches < calibrationSummary.nonfinal_pairs) {
    return {
      integrate_selector_now: false,
      train_support_discriminator_next: false,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "The non-final duplicate labels are not stable enough for training.",
      next_step: "Audit label disagreements before any selector training.",
    };
  }
  if (selected.nonfinal_validation.accuracy >= 0.75 && selected.final_reporting.accuracy >= 0.65 && finalUsableRows.length >= 12) {
    return {
      integrate_selector_now: false,
      train_support_discriminator_next: true,
      buy_more_openai_labels_now: false,
      launch_gpu_now: false,
      reason: "A non-final-selected support selector transfers on reporting-only final adjudications, but it still needs an end-to-end scaffold integration audit before deployment.",
      next_step: "Integrate the selected selector as a candidate-ranking feature and rerun final-window system metrics without using final labels for model selection.",
    };
  }
  return {
    integrate_selector_now: false,
    train_support_discriminator_next: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    reason: `The selected policy does not meet transfer thresholds: non-final validation ${selected.nonfinal_validation.accuracy.toFixed(3)}, final reporting ${selected.final_reporting.accuracy.toFixed(3)}, train pairs ${split.train.length}.`,
    next_step: "Use the adjudications to build a narrower overclaim/citation-mismatch packet rather than spending GPU now.",
  };
}

function renderReport(result) {
  const selected = result.selected_by_nonfinal_validation;
  return `# Adjudicated Support Selector Probe

Generated: ${result.generated_at}

Status: \`${result.status}\`

This probe makes no API calls and launches no compute. It selects policies only on non-final adjudicated labels; final-window adjudications are reporting-only.

## Data

- Non-final usable train pairs: ${result.data.nonfinal_train_pairs}
- Non-final usable validation pairs: ${result.data.nonfinal_validation_pairs}
- Final reporting pairs: ${result.data.final_usable_chosen_over_unsupported_reporting_only}
- Policies evaluated: ${result.data.policies_evaluated}
- Non-final duplicate exact agreement: ${result.calibration.nonfinal_exact_matches}/${result.calibration.nonfinal_pairs}
- Final duplicate exact agreement: ${result.calibration.final_exact_matches}/${result.calibration.final_pairs}

## Selected Policy

- Policy: \`${selected.policy_id}\`
- Non-final validation accuracy: ${pct(selected.nonfinal_validation.accuracy)}
- Final reporting accuracy: ${pct(selected.final_reporting.accuracy)}
- Final reporting mean margin: ${selected.final_reporting.mean_margin.toFixed(3)}

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Train support discriminator next: ${result.decision.train_support_discriminator_next ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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
