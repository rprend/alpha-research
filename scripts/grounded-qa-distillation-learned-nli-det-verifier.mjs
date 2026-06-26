import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "learned-verifier-nli-det-features-160-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);
const nliThreshold = Number(args["nli-threshold"] ?? 0.0065);

const comparativeTerms = [
  "best", "better", "worse", "worst", "outperform", "outperformed", "outperforms",
  "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer",
  "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased",
  "reduce", "reduced", "prefer", "preference", "highest", "lowest",
];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];

const windows = [
  {
    label: "161-240",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    judgeRun: "openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1",
    nliScores: "nli-det-guard-retrospective-160-240-v1/nli-scores.jsonl",
  },
  {
    label: "241-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    judgeRun: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    nliScores: "pretrained-nli-verifier-combined-labels-240-389-v1/nli-scores.jsonl",
  },
  {
    label: "321-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRun: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    nliScores: "pretrained-nli-verifier-combined-labels-240-389-v1/nli-scores.jsonl",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const windowRows = [];
for (const window of windows) {
  const predictions = await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl"));
  const judgments = keyed(await readJsonl(path.join(runDir, window.judgeRun, "judgments.jsonl")));
  const nliRows = keyed(await readJsonl(path.join(runDir, window.nliScores)));
  const rows = predictions.map((predictionRow) => buildRow(window, predictionRow, references.get(predictionRow.example_id), judgments.get(predictionRow.example_id), nliRows));
  windowRows.push({ ...window, rows });
}

const allRows = windowRows.flatMap((window) => window.rows);
const featureNames = featureVector(allRows.find((row) => row.answer_type === "grounded_answer")).names;
const folds = [];
const learnedPredictions = [];

for (const evalWindow of windowRows) {
  const trainRows = windowRows.filter((window) => window.label !== evalWindow.label).flatMap((window) => window.rows);
  const answeredTrain = trainRows.filter((row) => row.answer_type === "grounded_answer");
  const trainExamples = answeredTrain.map((row) => ({
    x: featureVector(row).values,
    y: row.strong_keep ? 1 : 0,
  }));
  const scaler = fitScaler(trainExamples.map((example) => example.x));
  const model = trainLogistic(trainExamples.map((example) => ({ ...example, x: scale(example.x, scaler) })), {
    iterations: 3600,
    learningRate: 0.06,
    l2: 0.025,
  });
  model.scaler = scaler;
  const threshold = tuneThreshold(trainRows, model);
  const predictions = evalWindow.rows.map((row) => predictionFor(row, "learned_nli_det_verifier", learnedSuppresses(row, model, threshold), { model, threshold }));
  learnedPredictions.push(...predictions);
  folds.push({
    eval_window: evalWindow.label,
    train_windows: windowRows.filter((window) => window.label !== evalWindow.label).map((window) => window.label),
    train_answered: answeredTrain.length,
    threshold,
    train_metrics: summarize(trainRows.map((row) => predictionFor(row, "learned_nli_det_verifier", learnedSuppresses(row, model, threshold), { model, threshold }))),
    eval_metrics: summarize(predictions),
    model: {
      feature_names: featureNames,
      weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
      bias: model.bias,
      train_loss: model.loss,
    },
  });
}

const policies = [
  { id: "balanced_gate", label: "Balanced support-risk gate", predictions: allRows.map((row) => predictionFor(row, "balanced_gate", false)) },
  { id: "deterministic_guard", label: "Deterministic claim-entailment guard", predictions: allRows.map((row) => predictionFor(row, "deterministic_guard", row.answer_type === "grounded_answer" && row.det_fires)) },
  { id: "pretrained_nli_fixed", label: "Pretrained NLI fixed threshold", predictions: allRows.map((row) => predictionFor(row, "pretrained_nli_fixed", row.answer_type === "grounded_answer" && row.nli_entailment_min < nliThreshold)) },
  { id: "nli_or_det_guard_fixed", label: "NLI OR deterministic guard", predictions: allRows.map((row) => predictionFor(row, "nli_or_det_guard_fixed", row.answer_type === "grounded_answer" && (row.det_fires || row.nli_entailment_min < nliThreshold))) },
  { id: "learned_nli_det_verifier", label: "Leave-window-out learned NLI+det verifier", predictions: learnedPredictions },
];

const baselineMetrics = summarize(policies.find((policy) => policy.id === "balanced_gate").predictions);
const policyResults = policies.map((policy) => {
  const metrics = summarize(policy.predictions);
  return { id: policy.id, label: policy.label, metrics, delta_vs_balanced: delta(metrics, baselineMetrics) };
});
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  scope: "leave-window-out local verifier over already judged balanced-gate outputs on extended_temporal_future_holdout examples 161-389",
  llm_calls: 0,
  run_cost_usd: 0,
  method: {
    type: "zero_call_leave_window_out_logistic_verifier",
    target: "whether an answered balanced-gate output is supported under existing GPT-4o judgments",
    feature_names: featureNames,
    threshold_tuning: "maximize training support-oracle correctness, tie-break by answered count then answer support",
    nli_threshold: nliThreshold,
    nli_scores: [...new Set(windows.map((window) => window.nliScores))],
  },
  policies: policyResults,
  folds,
  fired_examples: learnedPredictions
    .filter((row) => row.metadata.gate_fired)
    .map((row) => ({
      example_id: row.example_id,
      window: row.window,
      source_supported: row.inherited_judgment.source_answer_supported,
      interpretation: row.inherited_judgment.interpretation,
      learned_keep_score: row.metadata.learned_keep_score,
      nli_entailment_min: row.metadata.nli_entailment_min,
      det_fires: row.metadata.det_fires,
      det_reasons: row.metadata.det_reasons,
      answer_preview: compact(row.source_prediction.answer, 180),
    })),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), policies.flatMap((policy) => policy.predictions.map((row) => ({ ...row, policy: policy.id }))));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  policies: policyResults,
}, null, 2));

function buildRow(window, predictionRow, reference, judgmentRow, nliRows) {
  if (!reference || !judgmentRow) throw new Error(`Missing reference or judgment for ${predictionRow.example_id}`);
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const answerType = prediction.answer_type;
  const strongKeep = answerType === "grounded_answer" ? isSupportedAnswer(judgmentRow.judgment) : isCorrectAbstention(judgmentRow.judgment);
  const nli = answerType === "grounded_answer" ? nliRows.get(predictionRow.example_id)?.nli : null;
  if (answerType === "grounded_answer" && !nli) {
    throw new Error(`Missing cached NLI score for ${predictionRow.example_id}. Run the source NLI scorer first; this script intentionally does not rescore.`);
  }
  const evidenceById = new Map((reference.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const detGuard = inspectClaimEntailment(prediction, reference.input, citedText);
  return {
    example_id: predictionRow.example_id,
    window: window.label,
    prediction,
    answer_type: answerType,
    strong_keep: strongKeep,
    strong_verdict: judgmentRow.judgment?.verdict ?? null,
    baseline_correct: strongKeep,
    support_score: Number(predictionRow.metadata?.support_score ?? 0),
    nli_entailment_min: Number(nli?.entailment_min ?? 1),
    nli_entailment_mean: Number(nli?.entailment_mean ?? 1),
    nli_contradiction_max: Number(nli?.contradiction_max ?? 0),
    det_fires: answerType === "grounded_answer" && detGuard.fire,
    det_reasons: detGuard.reasons,
    local_scores: scorePrediction(reference, prediction),
    text: {
      question: reference.input.question,
      answer: prediction.answer,
      cited: citedText,
      pack: reference.input.compact_retrieved_evidence_pack.map((evidence) => evidence.text).join(" "),
      claim_table: prediction.claim_table ?? [],
    },
  };
}

function learnedSuppresses(row, model, threshold) {
  return row.answer_type === "grounded_answer" && predict(model, scale(featureVector(row).values, model.scaler)) < threshold;
}

function predictionFor(row, policy, suppress, learned = null) {
  const learnedScore = learned?.model && row.answer_type === "grounded_answer"
    ? predict(learned.model, scale(featureVector(row).values, learned.model.scaler))
    : null;
  const prediction = suppress ? abstainPrediction(policy, learnedScore, learned?.threshold) : row.prediction;
  return {
    example_id: row.example_id,
    window: row.window,
    prediction,
    source_prediction: row.prediction,
    metadata: {
      scaffold: policy,
      gate_fired: suppress,
      learned_keep_score: learnedScore,
      threshold: learned?.threshold ?? null,
      upstream_support_score: row.support_score,
      nli_entailment_min: row.nli_entailment_min,
      nli_entailment_mean: row.nli_entailment_mean,
      nli_contradiction_max: row.nli_contradiction_max,
      fixed_nli_fires: row.answer_type === "grounded_answer" && row.nli_entailment_min < nliThreshold,
      det_fires: row.det_fires,
      det_reasons: row.det_reasons,
    },
    labels: {
      strong_keep: row.strong_keep,
      strong_verdict: row.strong_verdict,
    },
    inherited_judgment: {
      source_answer_supported: row.answer_type === "grounded_answer" ? row.strong_keep : null,
      source_baseline_correct: row.baseline_correct,
      support_oracle_correct: suppress ? !row.strong_keep : row.strong_keep,
      interpretation: suppress
        ? (row.strong_keep ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
    scores: scoreFromLocal(row.local_scores, prediction),
  };
}

function tuneThreshold(trainRows, model) {
  const answered = trainRows.filter((row) => row.answer_type === "grounded_answer");
  const scores = answered.map((row) => predict(model, scale(featureVector(row).values, model.scaler)));
  const candidates = [...new Set([0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, ...scores])].sort((a, b) => a - b);
  let best = null;
  for (const threshold of candidates) {
    const metrics = summarize(trainRows.map((row) => predictionFor(row, "learned_nli_det_verifier", learnedSuppresses(row, model, threshold), { model, threshold })));
    if (!best || better(metrics, best.metrics)) best = { threshold, metrics };
  }
  return best.threshold;
}

function better(left, right) {
  if (left.support_oracle_correct !== right.support_oracle_correct) return left.support_oracle_correct > right.support_oracle_correct;
  if (left.answered !== right.answered) return left.answered > right.answered;
  return left.answer_support_rate > right.answer_support_rate;
}

function featureVector(row) {
  const answerTokens = contentTokens(row.text.answer);
  const citedTokens = contentTokens(row.text.cited);
  const packTokens = contentTokens(row.text.pack);
  const questionTokens = contentTokens(row.text.question);
  const claimTexts = row.text.claim_table.map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""}`);
  const claimCoverages = claimTexts.map((claim) => tokenCoverage(contentTokens(claim), citedTokens));
  const answerNumbers = numberTokens(row.text.answer).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(row.text.cited).map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number)).length;
  const answerComparatives = matchedTerms(row.text.answer, comparativeTerms);
  const citedComparatives = new Set(matchedTerms(row.text.cited, comparativeTerms));
  const unsupportedComparatives = answerComparatives.filter((term) => !citedComparatives.has(term)).length;
  const answerQuantifiers = matchedTerms(row.text.answer, quantifierTerms);
  const citedQuantifiers = new Set(matchedTerms(row.text.cited, quantifierTerms));
  const unsupportedQuantifiers = answerQuantifiers.filter((term) => !citedQuantifiers.has(term)).length;
  const detReasons = new Set(row.det_reasons ?? []);
  const names = [
    "upstream_support_score",
    "nli_entailment_min",
    "nli_entailment_mean",
    "nli_contradiction_max",
    "fixed_nli_below_threshold",
    "det_fires",
    "det_unsupported_number",
    "det_unsupported_comparative",
    "det_unsupported_quantifier",
    "answer_cited_token_coverage",
    "answer_pack_token_coverage",
    "claim_min_cited_coverage",
    "claim_mean_cited_coverage",
    "numeric_supported_rate",
    "unsupported_number_count",
    "unsupported_comparative_count",
    "unsupported_quantifier_count",
    "question_cited_overlap",
    "answer_token_count",
    "citation_count",
    "claim_count",
    "support_x_nli_min",
  ];
  const values = [
    row.support_score,
    row.nli_entailment_min,
    row.nli_entailment_mean,
    row.nli_contradiction_max,
    row.nli_entailment_min < nliThreshold ? 1 : 0,
    row.det_fires ? 1 : 0,
    detReasons.has("unsupported_number") ? 1 : 0,
    detReasons.has("unsupported_comparative_or_superlative") ? 1 : 0,
    detReasons.has("unsupported_quantifier") ? 1 : 0,
    tokenCoverage(answerTokens, citedTokens),
    tokenCoverage(answerTokens, packTokens),
    claimCoverages.length ? Math.min(...claimCoverages) : 0,
    mean(claimCoverages),
    answerNumbers.length ? (answerNumbers.length - unsupportedNumbers) / answerNumbers.length : 1,
    Math.log1p(unsupportedNumbers),
    Math.log1p(unsupportedComparatives),
    Math.log1p(unsupportedQuantifiers),
    tokenCoverage(questionTokens, citedTokens),
    Math.log1p(answerTokens.length),
    Math.log1p(row.prediction.citations.length),
    Math.log1p(row.text.claim_table.length),
    row.support_score * row.nli_entailment_min,
  ];
  return { names, values };
}

function inspectClaimEntailment(prediction, input, citedText) {
  if (prediction.answer_type !== "grounded_answer") return { fire: false, reasons: [] };
  const answerText = [
    prediction.answer,
    ...(prediction.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const strippedAnswer = stripCitations(answerText);
  const citedComparable = normalizeComparableText(citedText);
  const questionComparable = normalizeComparableText(input.question ?? "");
  const answerNumbers = [...new Set(numberTokens(strippedAnswer).map(normalizeNumber))];
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question ?? "").map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number));
  const answerTerms = matchedTerms(strippedAnswer, comparativeTerms);
  const citedTerms = matchedTerms(citedText, comparativeTerms);
  const unsupportedTerms = answerTerms.filter((term) => !citedTerms.includes(term) && !citedComparable.includes(term) && !questionComparable.includes(term));
  const quantifierAnswerTerms = matchedTerms(strippedAnswer, quantifierTerms);
  const quantifierCitedTerms = matchedTerms(citedText, quantifierTerms);
  const unsupportedQuantifiers = quantifierAnswerTerms.filter((term) => !quantifierCitedTerms.includes(term) && !questionComparable.includes(term));
  const reasons = [];
  if (unsupportedNumbers.length) reasons.push("unsupported_number");
  if (unsupportedTerms.length) reasons.push("unsupported_comparative_or_superlative");
  if (unsupportedQuantifiers.length) reasons.push("unsupported_quantifier");
  return { fire: reasons.length > 0, reasons };
}

function fitScaler(rows) {
  const means = rows[0].map((_, index) => mean(rows.map((row) => row[index])));
  const stds = rows[0].map((_, index) => {
    const variance = mean(rows.map((row) => (row[index] - means[index]) ** 2));
    return Math.sqrt(variance) || 1;
  });
  return { means, stds };
}

function scale(values, scaler) {
  return values.map((value, index) => (value - scaler.means[index]) / scaler.stds[index]);
}

function trainLogistic(examples, options) {
  const weights = Array(examples[0].x.length).fill(0);
  let bias = 0;
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const grad = Array(weights.length).fill(0);
    let biasGrad = 0;
    for (const example of examples) {
      const predicted = sigmoid(dot(weights, example.x) + bias);
      const error = predicted - example.y;
      for (let index = 0; index < weights.length; index += 1) grad[index] += error * example.x[index];
      biasGrad += error;
    }
    for (let index = 0; index < weights.length; index += 1) {
      grad[index] = grad[index] / examples.length + options.l2 * weights[index];
      weights[index] -= options.learningRate * grad[index];
    }
    bias -= options.learningRate * (biasGrad / examples.length);
  }
  return { weights, bias, loss: logisticLoss(examples, weights, bias, options.l2) };
}

function logisticLoss(examples, weights, bias, l2) {
  const eps = 1e-8;
  return mean(examples.map((example) => {
    const predicted = Math.min(1 - eps, Math.max(eps, sigmoid(dot(weights, example.x) + bias)));
    return -(example.y * Math.log(predicted) + (1 - example.y) * Math.log(1 - predicted));
  })) + l2 * weights.reduce((total, value) => total + value * value, 0) / 2;
}

function predict(model, values) {
  return sigmoid(dot(model.weights, values) + model.bias);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function summarize(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const correct = predictions.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.inherited_judgment.source_answer_supported);
  const suppressions = predictions.filter((row) => row.metadata.gate_fired);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: ratio(answered.length, predictions.length),
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: ratio(correct.length, predictions.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    answer_type_accuracy: mean(predictions.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(predictions.map((row) => row.scores.citation_precision)),
    citation_recall: mean(predictions.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(predictions.map((row) => row.scores.answer_token_f1)),
    inline_citation_rate: mean(predictions.map((row) => row.scores.inline_citation_rate)),
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
  };
}

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    support_oracle_correct_delta: left.support_oracle_correct - right.support_oracle_correct,
    support_oracle_correct_rate_delta: left.support_oracle_correct_rate - right.support_oracle_correct_rate,
    answer_support_rate_delta: left.answer_support_rate - right.answer_support_rate,
    citation_recall_delta: left.citation_recall - right.citation_recall,
    answer_token_f1_delta: left.answer_token_f1 - right.answer_token_f1,
    gate_fired_delta: left.gate_fired - right.gate_fired,
  };
}

function renderReport(result) {
  const policyRows = result.policies.map((policy) => (
    `| ${policy.label} | ${policy.metrics.support_oracle_correct} / ${policy.metrics.examples} (${pct(policy.metrics.support_oracle_correct_rate)}) | ${policy.metrics.answered} | ${pct(policy.metrics.answer_support_rate)} | ${pct(policy.metrics.citation_recall)} | ${pct(policy.metrics.answer_token_f1)} | ${policy.metrics.gate_fired} | ${policy.metrics.suppressed_unsupported} | ${policy.metrics.harmful_suppressed_supported} | ${signed(policy.delta_vs_balanced.support_oracle_correct_delta)} | ${signedPct(policy.delta_vs_balanced.support_oracle_correct_rate_delta)} |`
  )).join("\n");
  const foldRows = result.folds.map((fold) => (
    `| ${fold.eval_window} | ${fold.train_windows.join(", ")} | ${fold.threshold.toFixed(3)} | ${fold.eval_metrics.support_oracle_correct} / ${fold.eval_metrics.examples} (${pct(fold.eval_metrics.support_oracle_correct_rate)}) | ${fold.eval_metrics.answered} | ${pct(fold.eval_metrics.answer_support_rate)} | ${fold.eval_metrics.gate_fired} | ${fold.eval_metrics.suppressed_unsupported} | ${fold.eval_metrics.harmful_suppressed_supported} |`
  )).join("\n");
  const firedRows = result.fired_examples.map((row) => (
    `| \`${row.example_id}\` | ${row.window} | ${row.source_supported ? "supported" : "unsupported"} | ${row.interpretation} | ${row.learned_keep_score.toFixed(3)} | ${row.nli_entailment_min.toFixed(3)} | ${row.det_fires ? "yes" : "no"} | ${row.det_reasons.join(", ") || ""} | ${escapeCell(row.answer_preview)} |`
  )).join("\n");
  return `# Learned NLI And Deterministic Verifier

Scope: ${result.scope}

This run makes no OpenAI calls and no new model calls. It consumes cached NLI scores from prior verifier runs and recomputes deterministic citation-support features locally.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Citation recall | Answer F1 | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRows}

## Leave-Window-Out Folds

| Eval window | Train windows | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${foldRows}

## Learned Suppressions

| Example | Window | Source label | Interpretation | Keep score | NLI min | Deterministic | Reasons | Answer preview |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
${firedRows}

## Interpretation

The learned verifier is a candidate only if it improves aggregate support-oracle correctness over the balanced gate and does not rely on one fragile window. Fixed NLI and deterministic-guard baselines are included to separate genuine learned transfer from a simple threshold rule.
`;
}

function abstainPrediction(policy, score, threshold) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{ claim: "A local verifier rejected the generated answer as insufficiently supported.", support: policy, citations: [] }],
    abstention_reason: score == null || threshold == null
      ? `Suppressed by ${policy}.`
      : `Learned keep score ${score.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
  };
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : [...new Set(citations)],
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = (prediction.citations ?? []).filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
    answer_type_correct: prediction.answer_type === reference.output.answer_type,
    citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
    citation_recall: referenceCitations.size
      ? prediction.citations.filter((id) => referenceCitations.has(id)).length / referenceCitations.size
      : null,
    answer_token_f1: answerable ? (!abstained ? tokenF1(prediction.answer, stripCitations(reference.output.answer)) : 0) : null,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function scoreFromLocal(sourceScores, prediction) {
  if (prediction.answer_type === "grounded_answer") return sourceScores;
  return {
    answer_type_correct: false,
    citation_precision: null,
    citation_recall: 0,
    answer_token_f1: 0,
    inline_citation_rate: null,
  };
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function isCorrectAbstention(judgment) {
  return ["correct_abstention", "abstention_supported"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.abstention_supported === true;
}

function tokenF1(prediction, reference) {
  const predicted = contentTokens(stripCitations(prediction));
  const gold = contentTokens(reference);
  if (!predicted.length && !gold.length) return 1;
  if (!predicted.length || !gold.length) return 0;
  const goldCounts = counts(gold);
  let overlap = 0;
  for (const token of predicted) {
    const count = goldCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      goldCounts.set(token, count - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / predicted.length;
  const recall = overlap / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function tokenCoverage(targetTokens, sourceTokens) {
  if (!targetTokens.length) return 0;
  const source = new Set(sourceTokens);
  return targetTokens.filter((token) => source.has(token)).length / targetTokens.length;
}

function matchedTerms(value, terms) {
  const text = ` ${String(value).toLowerCase()} `;
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text));
}

function normalizeComparableText(value) {
  return String(value).toLowerCase().replace(/[-–—]/g, " ");
}

function normalizeNumber(value) {
  const lower = String(value).toLowerCase().replaceAll(",", "");
  const suffix = lower.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (!suffix) return lower;
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  return String(Number(suffix[1]) * multipliers[suffix[2]]);
}

function numberTokens(value) {
  const text = String(value);
  return [...text.matchAll(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi)]
    .filter((match) => {
      const index = match.index ?? 0;
      const before = text[index - 1] ?? "";
      const beforeBefore = text[index - 2] ?? "";
      const after = text[index + match[0].length] ?? "";
      if (before === "-" && /[A-Za-z]/.test(beforeBefore)) return false;
      if (/^\d+$/.test(match[0]) && [";", ")", "."].includes(after) && (index === 0 || /[\s([{]/.test(before))) return false;
      return true;
    })
    .map((match) => match[0]);
}

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function signedPct(value) {
  const rendered = `${(Number(value) * 100).toFixed(1)}pp`;
  return value > 0 ? `+${rendered}` : rendered;
}

function compact(value, length) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
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
