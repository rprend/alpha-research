import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "local-verifier-from-combined-labels-240-389-v1";
const labelPrefix = args["label-prefix"] ?? "teacher-combined-mini-det-guard-future-holdout-240-389-v1";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "prefer", "preference", "highest", "lowest"];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = (await readJsonl(path.join(exportDir, `${labelPrefix}.verifier.jsonl`))).map(buildRow);
const featureNames = featureVector(rows.find((row) => row.answer_type === "grounded_answer")).names;
const objectives = [
  {
    id: "strong_support_target",
    label: "Strong support target",
    description: "Train on GPT-4o-derived keep/suppress verifier labels.",
    target: (row) => row.strong_keep ? 1 : 0,
  },
  {
    id: "combined_policy_action",
    label: "Exported policy action",
    description: "Train to imitate the exported verifier teacher action.",
    target: (row) => row.combined_keep ? 1 : 0,
  },
];

const baselines = {
  balanced_gate: summarizePolicy(rows.map((row) => policyRow(row, {
    policy: "balanced_support_risk_gate",
    score: null,
    threshold: null,
    suppress: false,
  }))),
  combined_teacher: summarizePolicy(rows.map((row) => policyRow(row, {
    policy: "exported_verifier_teacher",
    score: null,
    threshold: null,
    suppress: row.answer_type === "grounded_answer" && !row.combined_keep,
  }))),
};

const objectiveResults = objectives.map(runObjective);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  label_prefix: labelPrefix,
  scope: "cross-window local verifier trained from exported verifier labels on extended_temporal_future_holdout",
  llm_calls: 0,
  run_cost_usd: 0,
  method: {
    type: "zero_call_cross_window_logistic_answer_support_verifier",
    feature_names: featureNames,
    deployment_action: "Only grounded answers can be suppressed. Existing abstentions are kept because this verifier cannot recover missing answers.",
    threshold_tuning: "Maximize train support-oracle correctness on grounded answers, tie-breaking by answer coverage and then answer support.",
  },
  data_summary: summarizeData(rows),
  baselines,
  objectives: objectiveResults,
};
result.best_objective = objectiveResults
  .map((objective) => ({
    id: objective.id,
    support_oracle_correct_rate: objective.aggregate.policy_metrics.support_oracle_correct_rate,
    support_oracle_correct: objective.aggregate.policy_metrics.support_oracle_correct,
    answered: objective.aggregate.policy_metrics.answered,
    suppressions: objective.aggregate.policy_metrics.gate_fired,
  }))
  .sort((a, b) => (
    b.support_oracle_correct_rate - a.support_oracle_correct_rate
    || b.answered - a.answered
    || a.suppressions - b.suppressions
  ))[0];

const predictionRows = objectiveResults.flatMap((objective) => objective.predictions);
await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictionRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(stripPredictions(result), null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  data_summary: result.data_summary,
  baselines: result.baselines,
  best_objective: result.best_objective,
  objective_summaries: objectiveResults.map((objective) => ({
    id: objective.id,
    aggregate: objective.aggregate,
  })),
}, null, 2));

function runObjective(objective) {
  const windows = [...new Set(rows.map((row) => row.window))].sort();
  const folds = [];
  const predictions = [];
  for (const evalWindow of windows) {
    const trainRows = rows.filter((row) => row.window !== evalWindow && row.answer_type === "grounded_answer");
    const evalRows = rows.filter((row) => row.window === evalWindow);
    const trainExamples = trainRows.map((row) => ({
      x: featureVector(row).values,
      y: objective.target(row),
    }));
    const model = trainLogistic(trainExamples, { iterations: 3200, learningRate: 0.065, l2: 0.04 });
    const threshold = tuneThreshold(trainRows, model, objective);
    const foldPredictions = evalRows.map((row) => applyModel(row, model, threshold, objective));
    predictions.push(...foldPredictions);
    folds.push({
      train_windows: windows.filter((window) => window !== evalWindow),
      eval_window: evalWindow,
      train_examples: trainRows.length,
      eval_examples: evalRows.length,
      threshold,
      train_classification: summarizeClassification(trainRows, model, threshold, objective),
      eval_classification: summarizeClassification(evalRows.filter((row) => row.answer_type === "grounded_answer"), model, threshold, objective),
      train_policy_metrics: summarizePolicy(trainRows.map((row) => applyModel(row, model, threshold, objective))),
      eval_policy_metrics: summarizePolicy(foldPredictions),
      model: {
        feature_names: featureNames,
        weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
        bias: model.bias,
        train_loss: model.loss,
      },
    });
  }
  return {
    id: objective.id,
    label: objective.label,
    description: objective.description,
    aggregate: {
      classification: summarizeClassification(rows.filter((row) => row.answer_type === "grounded_answer"), null, null, objective, predictions),
      policy_metrics: summarizePolicy(predictions),
      delta_vs_balanced_gate: delta(summarizePolicy(predictions), baselines.balanced_gate),
      delta_vs_combined_teacher: delta(summarizePolicy(predictions), baselines.combined_teacher),
    },
    folds,
    predictions,
  };
}

function buildRow(row) {
  const candidate = normalizePrediction(row.input.candidate_answer ?? {});
  const evidenceById = new Map((row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = candidate.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  return {
    example_id: row.example_id,
    window: row.metadata.window,
    question: row.input.question,
    evidence_pack: row.input.compact_retrieved_evidence_pack ?? [],
    candidate,
    answer_type: candidate.answer_type,
    cited_text: citedText,
    pack_text: (row.input.compact_retrieved_evidence_pack ?? []).map((evidence) => evidence.text).join(" "),
    support_score: Number(row.metadata.support_score ?? 0),
    strong_keep: row.output.label === "keep",
    combined_keep: (row.output.policy_action ?? row.output.combined_policy_action) === "keep",
    strong_verdict: row.metadata.strong_verdict,
    mini_verdict: row.metadata.mini_verdict,
    mini_negative: row.output.mini_negative === true,
    deterministic_guard_negative: row.output.deterministic_guard_negative === true,
  };
}

function featureVector(row) {
  const answerText = [
    row.candidate.answer,
    ...(row.candidate.claim_table ?? []).flatMap((claim) => [claim.claim, claim.support]),
  ].filter(Boolean).join(" ");
  const answerTokens = contentTokens(answerText);
  const citedTokens = contentTokens(row.cited_text);
  const packTokens = contentTokens(row.pack_text);
  const questionTokens = contentTokens(row.question);
  const claimTexts = (row.candidate.claim_table ?? []).map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""}`);
  const claimCoverages = claimTexts.map((claim) => tokenCoverage(contentTokens(claim), citedTokens));
  const answerNumbers = numberTokens(answerText).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(row.cited_text).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(row.question).map(normalizeNumber));
  const unsupportedNumbers = answerNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number)).length;
  const answerComparatives = matchedTerms(answerText, comparativeTerms);
  const citedComparatives = new Set(matchedTerms(row.cited_text, comparativeTerms));
  const questionComparatives = new Set(matchedTerms(row.question, comparativeTerms));
  const unsupportedComparatives = answerComparatives.filter((term) => !citedComparatives.has(term) && !questionComparatives.has(term)).length;
  const answerQuantifiers = matchedTerms(answerText, quantifierTerms);
  const citedQuantifiers = new Set(matchedTerms(row.cited_text, quantifierTerms));
  const questionQuantifiers = new Set(matchedTerms(row.question, quantifierTerms));
  const unsupportedQuantifiers = answerQuantifiers.filter((term) => !citedQuantifiers.has(term) && !questionQuantifiers.has(term)).length;
  const localDeterministicGuard = row.answer_type === "grounded_answer" && (unsupportedNumbers > 0 || unsupportedComparatives > 0 || unsupportedQuantifiers > 0);
  const names = [
    "upstream_support_score",
    "answer_cited_token_coverage",
    "answer_pack_token_coverage",
    "claim_min_cited_coverage",
    "claim_mean_cited_coverage",
    "numeric_supported_rate",
    "unsupported_number_count",
    "unsupported_comparative_count",
    "unsupported_quantifier_count",
    "local_deterministic_guard",
    "question_cited_overlap",
    "answer_token_count",
    "citation_count",
    "claim_count",
  ];
  const values = [
    row.support_score,
    tokenCoverage(answerTokens, citedTokens),
    tokenCoverage(answerTokens, packTokens),
    claimCoverages.length ? Math.min(...claimCoverages) : 0,
    mean(claimCoverages),
    answerNumbers.length ? (answerNumbers.length - unsupportedNumbers) / answerNumbers.length : 1,
    Math.log1p(unsupportedNumbers),
    Math.log1p(unsupportedComparatives),
    Math.log1p(unsupportedQuantifiers),
    localDeterministicGuard ? 1 : 0,
    tokenCoverage(questionTokens, citedTokens),
    Math.log1p(answerTokens.length),
    Math.log1p(row.candidate.citations.length),
    Math.log1p((row.candidate.claim_table ?? []).length),
  ];
  return { names, values };
}

function tuneThreshold(trainRows, model, objective) {
  const scores = trainRows.map((row) => predict(model, featureVector(row).values));
  const candidates = [...new Set([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, ...scores])].sort((a, b) => a - b);
  let best = null;
  for (const threshold of candidates) {
    const metrics = summarizePolicy(trainRows.map((row) => applyModel(row, model, threshold, objective)));
    if (!best || better(metrics, best.metrics)) best = { threshold, metrics };
  }
  return best.threshold;
}

function better(left, right) {
  if (Math.abs(left.support_oracle_correct_rate - right.support_oracle_correct_rate) > 1e-12) {
    return left.support_oracle_correct_rate > right.support_oracle_correct_rate;
  }
  if (left.answered !== right.answered) return left.answered > right.answered;
  return left.answer_support_rate > right.answer_support_rate;
}

function applyModel(row, model, threshold, objective) {
  if (row.answer_type !== "grounded_answer") {
    return policyRow(row, {
      policy: objective.id,
      score: null,
      threshold,
      suppress: false,
    });
  }
  const score = predict(model, featureVector(row).values);
  return policyRow(row, {
    policy: objective.id,
    score,
    threshold,
    suppress: score < threshold,
  });
}

function policyRow(row, decision) {
  const suppress = row.answer_type === "grounded_answer" && decision.suppress;
  const supportOracleCorrect = suppress ? !row.strong_keep : row.strong_keep;
  return {
    example_id: row.example_id,
    window: row.window,
    objective: decision.policy,
    prediction: suppress ? abstainPrediction(decision.policy, decision.score, decision.threshold) : row.candidate,
    source_prediction: row.candidate,
    metadata: {
      scaffold: decision.policy,
      verifier_score: decision.score,
      threshold: decision.threshold,
      gate_fired: suppress,
      upstream_support_score: row.support_score,
    },
    labels: {
      strong_keep: row.strong_keep,
      combined_keep: row.combined_keep,
      strong_verdict: row.strong_verdict,
      mini_verdict: row.mini_verdict,
      mini_negative: row.mini_negative,
      deterministic_guard_negative: row.deterministic_guard_negative,
    },
    inherited_judgment: {
      support_oracle_correct: supportOracleCorrect,
      interpretation: suppress
        ? (row.strong_keep ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
  };
}

function abstainPrediction(policy, score, threshold) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{
      claim: "A local verifier rejected the generated answer as insufficiently supported.",
      support: policy,
      citations: [],
    }],
    abstention_reason: score == null
      ? "Local verifier suppressed the generated answer."
      : `Local verifier score ${score.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
  };
}

function summarizePolicy(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const correct = predictions.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.labels.strong_keep);
  const suppressions = predictions.filter((row) => row.metadata.gate_fired);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: predictions.length ? answered.length / predictions.length : 0,
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: predictions.length ? correct.length / predictions.length : 0,
    answer_support_rate: answered.length ? supportedAnswers.length / answered.length : 0,
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
  };
}

function summarizeClassification(evalRows, model, threshold, objective, precomputedPredictions = null) {
  const rowsForClassification = evalRows.filter((row) => row.answer_type === "grounded_answer");
  const classified = precomputedPredictions
    ? precomputedPredictions.filter((row) => row.source_prediction.answer_type === "grounded_answer").map((prediction) => ({
      predicted_keep: !prediction.metadata.gate_fired,
      actual_keep: objective.id === "strong_support_target" ? prediction.labels.strong_keep : prediction.labels.combined_keep,
    }))
    : rowsForClassification.map((row) => {
      const score = predict(model, featureVector(row).values);
      return {
        predicted_keep: score >= threshold,
        actual_keep: Boolean(objective.target(row)),
      };
    });
  const tp = classified.filter((row) => row.predicted_keep && row.actual_keep).length;
  const tn = classified.filter((row) => !row.predicted_keep && !row.actual_keep).length;
  const fp = classified.filter((row) => row.predicted_keep && !row.actual_keep).length;
  const fn = classified.filter((row) => !row.predicted_keep && row.actual_keep).length;
  return {
    examples: classified.length,
    accuracy: classified.length ? (tp + tn) / classified.length : 0,
    keep_precision: tp + fp ? tp / (tp + fp) : 0,
    keep_recall: tp + fn ? tp / (tp + fn) : 0,
    suppress_precision: tn + fn ? tn / (tn + fn) : 0,
    suppress_recall: tn + fp ? tn / (tn + fp) : 0,
    true_keep: tp,
    true_suppress: tn,
    false_keep: fp,
    false_suppress: fn,
  };
}

function summarizeData(rows) {
  const answered = rows.filter((row) => row.answer_type === "grounded_answer");
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: rows.length - answered.length,
    strong_keep: rows.filter((row) => row.strong_keep).length,
    strong_suppress: rows.filter((row) => !row.strong_keep).length,
    answered_strong_keep: answered.filter((row) => row.strong_keep).length,
    answered_strong_suppress: answered.filter((row) => !row.strong_keep).length,
    combined_keep_actions: rows.filter((row) => row.combined_keep).length,
    combined_suppress_actions: rows.filter((row) => !row.combined_keep).length,
  };
}

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    support_oracle_correct_delta: left.support_oracle_correct - right.support_oracle_correct,
    support_oracle_correct_rate_delta: left.support_oracle_correct_rate - right.support_oracle_correct_rate,
    answer_support_rate_delta: left.answer_support_rate - right.answer_support_rate,
    gate_fired_delta: left.gate_fired - right.gate_fired,
  };
}

function renderReport(result) {
  const baselineRows = [
    policyReportRow("Balanced support-risk gate", result.baselines.balanced_gate),
    policyReportRow("Exported teacher action", result.baselines.combined_teacher),
  ].join("\n");
  const objectiveRows = result.objectives.map((objective) => (
    policyReportRow(objective.label, objective.aggregate.policy_metrics)
  )).join("\n");
  const foldRows = result.objectives.flatMap((objective) => objective.folds.map((fold) => (
    `| ${objective.label} | ${fold.eval_window} | ${fold.threshold.toFixed(3)} | ${fold.eval_policy_metrics.support_oracle_correct} / ${fold.eval_policy_metrics.examples} (${pct(fold.eval_policy_metrics.support_oracle_correct_rate)}) | ${fold.eval_policy_metrics.answered} | ${pct(fold.eval_policy_metrics.answer_support_rate)} | ${fold.eval_policy_metrics.gate_fired} | ${fold.eval_policy_metrics.suppressed_unsupported} | ${fold.eval_policy_metrics.harmful_suppressed_supported} | ${pct(fold.eval_classification.suppress_recall)} | ${pct(fold.eval_classification.suppress_precision)} |`
  ))).join("\n");
  const objectiveDetails = result.objectives.map((objective) => {
    const metrics = objective.aggregate;
    return `### ${objective.label}

${objective.description}

- Delta vs balanced gate: ${signed(metrics.delta_vs_balanced_gate.support_oracle_correct_delta)} support-oracle rows (${signedPct(metrics.delta_vs_balanced_gate.support_oracle_correct_rate_delta)}), ${signed(metrics.delta_vs_balanced_gate.answered_delta)} answered rows.
- Delta vs exported teacher: ${signed(metrics.delta_vs_combined_teacher.support_oracle_correct_delta)} support-oracle rows (${signedPct(metrics.delta_vs_combined_teacher.support_oracle_correct_rate_delta)}), ${signed(metrics.delta_vs_combined_teacher.answered_delta)} answered rows.
- Answered-row suppress classification: ${pct(metrics.classification.accuracy)} accuracy, ${pct(metrics.classification.suppress_recall)} suppress recall, ${pct(metrics.classification.suppress_precision)} suppress precision.`;
  }).join("\n\n");
  return `# Local Verifier From Exported Teacher Labels

Scope: ${result.scope}

This run makes no LLM calls. It trains a local logistic verifier on one future window and evaluates on the other, using the exported verifier labels from \`${result.label_prefix}\`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.data_summary.examples} | ${result.data_summary.answered} | ${result.data_summary.abstained} | ${result.data_summary.strong_keep} | ${result.data_summary.strong_suppress} | ${result.data_summary.answered_strong_keep} | ${result.data_summary.answered_strong_suppress} | ${result.data_summary.combined_suppress_actions} |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${baselineRows}
${objectiveRows}

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${foldRows}

## Objective Details

${objectiveDetails}

## Interpretation

The exported labels are useful as a training object, but this local logistic verifier does not recover the teacher's high-precision suppressions cross-window. A paper-grade amortized verifier likely needs a stronger model class over claim/evidence pairs, not another shallow lexical logistic gate.
`;
}

function policyReportRow(label, metrics) {
  return `| ${label} | ${metrics.support_oracle_correct} / ${metrics.examples} (${pct(metrics.support_oracle_correct_rate)}) | ${metrics.answered} | ${pct(metrics.answer_support_rate)} | ${metrics.gate_fired} | ${metrics.suppressed_unsupported} | ${metrics.harmful_suppressed_supported} |`;
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

function matchedTerms(value, terms) {
  const text = ` ${String(value).toLowerCase()} `;
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text));
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

function stripPredictions(result) {
  return {
    ...result,
    objectives: result.objectives.map(({ predictions, ...objective }) => objective),
  };
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
