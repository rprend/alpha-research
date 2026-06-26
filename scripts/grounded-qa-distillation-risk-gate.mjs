import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const labelPrefix = args["label-prefix"] ?? "teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1";
const supportContrastRunId = args["support-contrast-run"];
const sourceRunId = args["source-run"];
if (!sourceRunId) throw new Error("Missing --source-run=<run-id>.");
const evalOffset = numberArg(args["eval-offset"], 160, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 80);
const thresholdArg = args.threshold === "auto" ? "auto" : numericArg(args.threshold, Number.NaN);
const minAcceptedCoverage = numericArg(args["min-accepted-coverage"], 0.70);
const runId = args["run-id"] ?? `risk-gate-${labelPrefix}-${evalOffset}-${evalOffset + evalLimit}-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const { trainRows, validationRows, labelSourceDescription } = supportContrastRunId
  ? await loadSupportContrastRows(supportContrastRunId)
  : await loadExportRows(labelPrefix);
if (trainRows.length < 10) throw new Error("Need at least 10 answered train labels for risk gate.");

const featureNames = featureVector(trainRows[0].prediction, trainRows[0].input).names;
const trainExamples = trainRows.map((row) => ({
  example_id: row.example_id,
  x: featureVector(row.prediction, row.input).values,
  y: row.y,
  label_status: row.label_status,
}));
const model = trainLogistic(trainExamples, { iterations: 3000, learningRate: 0.08, l2: 0.03 });
const validationExamples = validationRows.map((row) => ({
  example_id: row.example_id,
  x: featureVector(row.prediction, row.input).values,
  y: row.y,
  label_status: row.label_status,
}));
const threshold = thresholdArg === "auto"
  ? tuneThreshold(validationExamples.length ? validationExamples : trainExamples, model, minAcceptedCoverage)
  : (Number.isFinite(thresholdArg) ? thresholdArg : 0.5);

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const evalRows = references.slice(evalOffset, evalOffset + evalLimit);
const referenceById = new Map(evalRows.map((row) => [row.example_id, row]));
const sourceRows = (await readJsonl(path.join(runDir, sourceRunId, "predictions.jsonl")))
  .filter((row) => !row.skipped)
  .filter((row) => referenceById.has(row.example_id));

const predictions = sourceRows.map((row) => {
  const reference = referenceById.get(row.example_id);
  const sourcePrediction = normalizePrediction(row.prediction ?? {});
  const supportScore = sourcePrediction.answer_type === "grounded_answer"
    ? predict(model, featureVector(sourcePrediction, reference.input).values)
    : 1;
  const gateFired = sourcePrediction.answer_type === "grounded_answer" && supportScore < threshold;
  const prediction = gateFired ? abstainPrediction(supportScore, threshold) : sourcePrediction;
  return {
    example_id: row.example_id,
    source_run_id: sourceRunId,
    prediction,
    source_prediction: sourcePrediction,
    cost_usd: 0,
    metadata: {
      scaffold: "zero_call_support_risk_gate",
      support_score: supportScore,
      threshold,
      gate_fired: gateFired,
    },
    scores: scorePrediction(reference, prediction),
  };
});

const selectedTrainRows = trainExamples.map((row) => {
  const score = predict(model, row.x);
  return { ...row, support_score: score, accepted_by_gate: score >= threshold };
});
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  label_prefix: labelPrefix,
  support_contrast_run_id: supportContrastRunId ?? null,
  label_source_description: labelSourceDescription,
  source_run_id: sourceRunId,
  eval_offset: evalOffset,
  eval_examples: evalRows.length,
  source_predictions_seen: sourceRows.length,
  risk_gate: {
    type: "zero_call_logistic_support_gate",
    target: "answered teacher label accepted by strict GPT-4o judge",
    feature_names: featureNames,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    bias: model.bias,
    train_loss: model.loss,
    threshold,
    min_accepted_coverage: minAcceptedCoverage,
  },
  cost: {
    llm_calls: 0,
    run_cost_usd: 0,
    note: "Risk gate trains on existing exported labels and makes no model calls at inference.",
  },
  train_metrics: summarizeTrain(selectedTrainRows),
  validation_metrics: validationExamples.length ? summarizeTrain(validationExamples.map((row) => {
    const score = predict(model, row.x);
    return { ...row, support_score: score, accepted_by_gate: score >= threshold };
  })) : null,
  eval_metrics: summarizePredictions(predictions),
  inherited_judge_metrics: await summarizeInheritedJudge({
    runId,
    sourceRunId,
    predictionRows: predictions,
    evalRows,
  }),
  gate_summary: {
    answered_before: sourceRows.filter((row) => normalizePrediction(row.prediction ?? {}).answer_type === "grounded_answer").length,
    answered_after: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    gate_fired: predictions.filter((row) => row.metadata.gate_fired).length,
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), selectedTrainRows);
if (validationExamples.length) {
  await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationExamples.map((row) => {
    const score = predict(model, row.x);
    return { ...row, support_score: score, accepted_by_gate: score >= threshold };
  }));
}
await fs.writeFile(path.join(outputDir, "risk-gate-model.json"), `${JSON.stringify(result.risk_gate, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  train_metrics: result.train_metrics,
  validation_metrics: result.validation_metrics,
  eval_metrics: result.eval_metrics,
  inherited_judge_metrics: result.inherited_judge_metrics,
  gate_summary: result.gate_summary,
}, null, 2));

async function loadExportRows(prefix) {
  const acceptedRows = (await readJsonl(path.join(exportDir, `${prefix}.sft.jsonl`)))
    .map((row) => ({ ...row, prediction: row.teacher_output, y: 1, label_status: "accepted" }));
  const rejectedRows = (await readJsonl(path.join(exportDir, `${prefix}.rejected.jsonl`)))
    .map((row) => ({ ...row, prediction: row.teacher_output, y: 0, label_status: "rejected" }));
  return {
    trainRows: [...acceptedRows, ...rejectedRows].filter((row) => row.prediction?.answer_type === "grounded_answer"),
    validationRows: [],
    labelSourceDescription: "raw accepted/rejected export labels",
  };
}

async function loadSupportContrastRows(prepRunId) {
  const prepDir = path.join(runDir, prepRunId);
  const sftTrain = (await readJsonl(path.join(prepDir, "sft_train.jsonl")))
    .map((row) => ({ ...row, prediction: row.target, y: 1, label_status: "accepted" }));
  const sftValidation = (await readJsonl(path.join(prepDir, "sft_validation.jsonl")))
    .map((row) => ({ ...row, prediction: row.target, y: 1, label_status: "accepted" }));
  const preferenceTrain = (await readJsonl(path.join(prepDir, "preference_train.jsonl")))
    .map((row) => ({ ...row, prediction: row.rejected, y: 0, label_status: "rejected" }));
  const preferenceValidation = (await readJsonl(path.join(prepDir, "preference_validation.jsonl")))
    .map((row) => ({ ...row, prediction: row.rejected, y: 0, label_status: "rejected" }));
  return {
    trainRows: [...sftTrain, ...preferenceTrain].filter((row) => row.prediction?.answer_type === "grounded_answer"),
    validationRows: [...sftValidation, ...preferenceValidation].filter((row) => row.prediction?.answer_type === "grounded_answer"),
    labelSourceDescription: "support-contrast prep train split with threshold tuned on prep validation split",
  };
}

function abstainPrediction(score, threshold) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "support_risk_gate", citations: [] }],
    abstention_reason: `Support-risk score ${score.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
  };
}

async function summarizeInheritedJudge({ sourceRunId, predictionRows, evalRows }) {
  const judgeRunId = `openai-judge-gpt4o-${sourceRunId}`;
  const judgePath = path.join(runDir, judgeRunId, "judgments.jsonl");
  let judgments = [];
  try {
    judgments = await readJsonl(judgePath);
  } catch {
    return {
      judge_run_id: judgeRunId,
      available: false,
      note: "No inherited gpt-4o judgment run was found for the source predictions.",
    };
  }
  const judgmentsById = new Map(judgments.map((row) => [row.example_id, row.judgment]));
  const referenceById = new Map(evalRows.map((row) => [row.example_id, row]));
  let retainedAnswered = 0;
  let retainedSupported = 0;
  let abstained = 0;
  let abstentionSupported = 0;
  let usefulSuppressions = 0;
  let harmfulSuppressions = 0;
  let sourceSupportedAnswers = 0;
  let sourceUnsupportedAnswers = 0;
  for (const row of predictionRows) {
    const judgment = judgmentsById.get(row.example_id);
    const sourceWasAnswered = row.source_prediction?.answer_type === "grounded_answer";
    const sourceWasSupported = isSupportedAnswer(judgment);
    const reference = referenceById.get(row.example_id);
    if (sourceWasAnswered && sourceWasSupported) sourceSupportedAnswers += 1;
    if (sourceWasAnswered && !sourceWasSupported) sourceUnsupportedAnswers += 1;
    if (row.prediction.answer_type === "grounded_answer") {
      retainedAnswered += 1;
      if (sourceWasSupported) retainedSupported += 1;
    } else {
      abstained += 1;
      const abstentionIsSupported = reference?.output?.answer_type === "abstain";
      if (abstentionIsSupported) abstentionSupported += 1;
      if (sourceWasAnswered && !sourceWasSupported) usefulSuppressions += 1;
      if (sourceWasAnswered && sourceWasSupported) harmfulSuppressions += 1;
    }
  }
  return {
    judge_run_id: judgeRunId,
    available: true,
    answered_predictions: retainedAnswered,
    answer_support_rate: ratio(retainedSupported, retainedAnswered),
    abstained_predictions: abstained,
    abstention_support_rate: ratio(abstentionSupported, abstained),
    inherited_overall_correct_rate: ratio(retainedSupported + abstentionSupported, predictionRows.length),
    source_supported_answers: sourceSupportedAnswers,
    source_unsupported_answers: sourceUnsupportedAnswers,
    useful_suppressions: usefulSuppressions,
    harmful_suppressions: harmfulSuppressions,
    note: "Retained answers inherit the source gpt-4o judgment; new abstentions are counted supported only when the reference row is an abstention row.",
  };
}

function isSupportedAnswer(judgment) {
  return ["supported", "correct"].includes(String(judgment?.verdict ?? "").toLowerCase())
    || judgment?.all_claims_supported === true;
}

function tuneThreshold(rows, model, coverageFloor) {
  const acceptedScores = rows.filter((row) => row.y === 1).map((row) => predict(model, row.x)).sort((a, b) => a - b);
  if (!acceptedScores.length) return 0.5;
  const minAccepted = Math.max(1, Math.ceil(acceptedScores.length * coverageFloor));
  const maxRejected = acceptedScores.length - minAccepted;
  const floorThreshold = acceptedScores[Math.min(maxRejected, acceptedScores.length - 1)];
  const candidates = [...new Set([
    0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
    floorThreshold,
  ])].sort((a, b) => a - b);
  let best = null;
  for (const threshold of candidates) {
    const metrics = summarizeTrain(rows.map((row) => ({
      ...row,
      support_score: predict(model, row.x),
      accepted_by_gate: predict(model, row.x) >= threshold,
    })));
    if (metrics.accepted_recall < coverageFloor) continue;
    if (!best || gateBetter(metrics, best.metrics)) best = { threshold, metrics };
  }
  return best?.threshold ?? floorThreshold;
}

function gateBetter(left, right) {
  if (Math.abs(left.precision - right.precision) > 1e-12) return left.precision > right.precision;
  if (Math.abs(left.f1 - right.f1) > 1e-12) return left.f1 > right.f1;
  return left.accepted_recall > right.accepted_recall;
}

function featureVector(prediction, input) {
  const evidencePack = input?.compact_retrieved_evidence_pack ?? [];
  const evidenceById = new Map(evidencePack.map((evidence) => [evidence.evidence_id, evidence]));
  const citations = prediction.citations ?? [];
  const citedEvidence = citations.map((id) => evidenceById.get(id)).filter(Boolean);
  const citedText = citedEvidence.map((evidence) => evidence.text).join(" ");
  const packText = evidencePack.map((evidence) => evidence.text).join(" ");
  const answerTokens = contentTokens(prediction.answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input?.question ?? "");
  const claimTexts = (prediction.claim_table ?? []).map((claim) => claim.claim ?? "");
  const claimCoverages = claimTexts.map((claim) => tokenCoverage(contentTokens(claim), citedTokens));
  const numbers = numberTokens(prediction.answer);
  const citedNumbers = new Set(numberTokens(citedText));
  const citationRanks = citedEvidence.map((evidence) => Number(evidence.retrieval_rank)).filter(Number.isFinite);
  const names = [
    "citation_count",
    "claim_count",
    "answer_token_count",
    "valid_citation_rate",
    "mean_inverse_citation_rank",
    "answer_cited_token_coverage",
    "answer_pack_token_coverage",
    "claim_min_cited_coverage",
    "claim_mean_cited_coverage",
    "numeric_supported_rate",
    "question_cited_overlap",
    "question_pack_max_overlap",
    "citation_marker_density",
  ];
  const values = [
    Math.log1p(citations.length),
    Math.log1p(claimTexts.length),
    Math.log1p(answerTokens.length),
    citations.length ? citedEvidence.length / citations.length : 0,
    citationRanks.length ? mean(citationRanks.map((rank) => 1 / Math.max(1, rank))) : 0,
    tokenCoverage(answerTokens, citedTokens),
    tokenCoverage(answerTokens, packTokens),
    claimCoverages.length ? Math.min(...claimCoverages) : 0,
    mean(claimCoverages),
    numbers.length ? numbers.filter((number) => citedNumbers.has(number)).length / numbers.length : 1,
    tokenCoverage(questionTokens, citedTokens),
    evidencePack.length ? Math.max(...evidencePack.map((evidence) => tokenCoverage(questionTokens, contentTokens(evidence.text)))) : 0,
    Math.min(1, citations.length / Math.max(1, answerTokens.length)),
  ];
  return { names, values };
}

function trainLogistic(examples, options) {
  const weights = Array(examples[0].x.length).fill(0);
  let bias = 0;
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const grad = Array(weights.length).fill(0);
    let biasGrad = 0;
    for (const example of examples) {
      const prediction = sigmoid(dot(weights, example.x) + bias);
      const error = prediction - example.y;
      for (let index = 0; index < weights.length; index += 1) grad[index] += error * example.x[index];
      biasGrad += error;
    }
    for (let index = 0; index < weights.length; index += 1) {
      grad[index] = grad[index] / examples.length + options.l2 * weights[index];
      weights[index] -= options.learningRate * grad[index];
    }
    bias -= options.learningRate * (biasGrad / examples.length);
  }
  return {
    weights,
    bias,
    loss: logisticLoss(examples, weights, bias, options.l2),
  };
}

function logisticLoss(examples, weights, bias, l2) {
  const eps = 1e-8;
  const nll = mean(examples.map((example) => {
    const prediction = Math.min(1 - eps, Math.max(eps, sigmoid(dot(weights, example.x) + bias)));
    return -(example.y * Math.log(prediction) + (1 - example.y) * Math.log(1 - prediction));
  }));
  return nll + l2 * sum(weights.map((value) => value * value)) / 2;
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

function summarizeTrain(rows) {
  const truePositives = rows.filter((row) => row.y === 1 && row.accepted_by_gate).length;
  const falsePositives = rows.filter((row) => row.y === 0 && row.accepted_by_gate).length;
  const falseNegatives = rows.filter((row) => row.y === 1 && !row.accepted_by_gate).length;
  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, truePositives + falseNegatives);
  return {
    examples: rows.length,
    accepted_labels: rows.filter((row) => row.y === 1).length,
    rejected_labels: rows.filter((row) => row.y === 0).length,
    accepted_by_gate: rows.filter((row) => row.accepted_by_gate).length,
    rejected_by_gate: rows.filter((row) => !row.accepted_by_gate).length,
    precision,
    accepted_recall: recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
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
    abstention_correct: answerable ? !abstained : abstained,
    inline_citation_rate: prediction.answer_type === "grounded_answer"
      ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
      : null,
  };
}

function summarizePredictions(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
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

function numberTokens(value) {
  return String(value).match(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi) ?? [];
}

function tokenCoverage(targetTokens, sourceTokens) {
  if (!targetTokens.length) return 0;
  const source = new Set(sourceTokens);
  return targetTokens.filter((token) => source.has(token)).length / targetTokens.length;
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

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Grounded QA Risk Gate

## Setup

- Label packet: \`${result.label_prefix}\`
- Source run: \`${result.source_run_id}\`
- Eval split: \`${result.split}\`
- Eval window: ${result.eval_offset}-${result.eval_offset + result.eval_examples}
- LLM calls: ${result.cost.llm_calls}
- Run cost: $${result.cost.run_cost_usd.toFixed(7)}

The risk gate trains on accepted/rejected answered labels from the strict export and applies a local support-risk threshold to cheap source predictions.

## Train Gate

| Split | Examples | Accepted labels | Rejected labels | Accepted by gate | Precision | Accepted recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.train_metrics.examples} | ${result.train_metrics.accepted_labels} | ${result.train_metrics.rejected_labels} | ${result.train_metrics.accepted_by_gate} | ${pct(result.train_metrics.precision)} | ${pct(result.train_metrics.accepted_recall)} | ${pct(result.train_metrics.f1)} |
${result.validation_metrics ? `| Validation | ${result.validation_metrics.examples} | ${result.validation_metrics.accepted_labels} | ${result.validation_metrics.rejected_labels} | ${result.validation_metrics.accepted_by_gate} | ${pct(result.validation_metrics.precision)} | ${pct(result.validation_metrics.accepted_recall)} | ${pct(result.validation_metrics.f1)} |` : ""}

## Eval Result

| Examples | Answered before | Answered after | Gate fired | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.eval_metrics.examples} | ${result.gate_summary.answered_before} | ${result.gate_summary.answered_after} | ${result.gate_summary.gate_fired} | ${pct(result.eval_metrics.answer_type_accuracy)} | ${pct(result.eval_metrics.citation_precision)} | ${pct(result.eval_metrics.citation_recall)} | ${pct(result.eval_metrics.answer_token_f1)} | ${pct(result.eval_metrics.inline_citation_rate)} |

${result.inherited_judge_metrics?.available ? `## Inherited Judge Result

| Answered | Answer support | Abstained | Abstention support | Inherited overall correct | Useful suppressions | Harmful suppressions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.inherited_judge_metrics.answered_predictions} | ${pct(result.inherited_judge_metrics.answer_support_rate)} | ${result.inherited_judge_metrics.abstained_predictions} | ${pct(result.inherited_judge_metrics.abstention_support_rate)} | ${pct(result.inherited_judge_metrics.inherited_overall_correct_rate)} | ${result.inherited_judge_metrics.useful_suppressions} | ${result.inherited_judge_metrics.harmful_suppressions} |
` : ""}

This is a zero-call amortization experiment. It must be judged independently before claiming support preservation.
`;
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function numericArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
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
