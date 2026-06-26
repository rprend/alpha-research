import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "learned-entailment-gate-cross-window-240-389-v1";
const split = args.split ?? "extended_temporal_future_holdout";
const outputDir = path.join(runDir, runId);
const reportPath = path.join(reportDir, `${runId}.md`);
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "improvement", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "prefer", "preference", "highest", "lowest"];
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];

const windows = [
  {
    label: "241-320",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    label: "321-389",
    gateRun: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    gateJudge: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = keyed(await readJsonl(path.join(dataDir, `${split}.jsonl`)));
const windowRows = [];
for (const window of windows) {
  const predictions = await readJsonl(path.join(runDir, window.gateRun, "predictions.jsonl"));
  const judgments = keyed(await readJsonl(path.join(runDir, window.gateJudge, "judgments.jsonl")));
  const rows = predictions.map((predictionRow) => buildRow(window, predictionRow, references.get(predictionRow.example_id), judgments.get(predictionRow.example_id)))
    .filter(Boolean);
  windowRows.push({ ...window, rows });
}

const featureNames = featureVector(windowRows[0].rows.find((row) => row.answer_type === "grounded_answer")).names;
const folds = [];
const allPredictions = [];
for (const evalWindow of windowRows) {
  const trainRows = windowRows.filter((window) => window.label !== evalWindow.label).flatMap((window) => window.rows);
  const answeredTrain = trainRows.filter((row) => row.answer_type === "grounded_answer");
  const trainExamples = answeredTrain.map((row) => ({
    example_id: row.example_id,
    x: featureVector(row).values,
    y: row.answer_supported ? 1 : 0,
  }));
  const model = trainLogistic(trainExamples, { iterations: 2600, learningRate: 0.08, l2: 0.035 });
  const threshold = tuneThreshold(answeredTrain, model);
  const predictions = evalWindow.rows.map((row) => applyGate(row, model, threshold, evalWindow.label));
  allPredictions.push(...predictions);
  folds.push({
    train_windows: windowRows.filter((window) => window.label !== evalWindow.label).map((window) => window.label),
    eval_window: evalWindow.label,
    threshold,
    train_answered: answeredTrain.length,
    train_metrics: summarizePolicy(answeredTrain.map((row) => applyGate(row, model, threshold, "train"))),
    eval_metrics: summarizePolicy(predictions),
    model: {
      feature_names: featureNames,
      weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
      bias: model.bias,
      train_loss: model.loss,
    },
  });
}

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  scope: "balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389",
  llm_calls: 0,
  run_cost_usd: 0,
  method: {
    type: "zero_call_cross_window_logistic_claim_entailment_gate",
    target: "answered balanced-gate prediction is fully supported by existing GPT-4o judgment",
    feature_names: featureNames,
    threshold_tuning: "maximize train support-oracle correctness, tie-break by answer coverage then answer support",
  },
  folds,
  aggregate_metrics: summarizePolicy(allPredictions),
  baseline_metrics: summarizePolicy(windowRows.flatMap((window) => window.rows.map((row) => baselinePrediction(row, window.label)))),
};
result.deltas = delta(result.aggregate_metrics, result.baseline_metrics);

await writeJsonl(path.join(outputDir, "predictions.jsonl"), allPredictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
await fs.writeFile(reportPath, renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  summary_report: path.relative(rootDir, reportPath),
  aggregate_metrics: result.aggregate_metrics,
  baseline_metrics: result.baseline_metrics,
  deltas: result.deltas,
}, null, 2));

function buildRow(window, predictionRow, reference, judgmentRow) {
  if (!reference || !judgmentRow) return null;
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const answerSupported = prediction.answer_type === "grounded_answer" ? isSupportedAnswer(judgmentRow.judgment) : false;
  const abstentionSupported = prediction.answer_type === "abstain" ? isCorrectAbstention(judgmentRow.judgment) : false;
  const evidenceById = new Map((reference.input.compact_retrieved_evidence_pack ?? []).map((evidence) => [evidence.evidence_id, evidence]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  return {
    example_id: predictionRow.example_id,
    window: window.label,
    prediction,
    answer_type: prediction.answer_type,
    support_score: predictionRow.metadata?.support_score ?? null,
    upstream_gate_fired: Boolean(predictionRow.metadata?.gate_fired),
    answer_supported: answerSupported,
    abstention_supported: abstentionSupported,
    baseline_correct: prediction.answer_type === "grounded_answer" ? answerSupported : abstentionSupported,
    local_scores: scorePrediction(reference, prediction),
    text: {
      question: reference.input.question,
      answer: prediction.answer,
      cited: citedText,
      pack: reference.input.compact_retrieved_evidence_pack.map((evidence) => evidence.text).join(" "),
      claim_table: prediction.claim_table ?? [],
    },
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    judgment: judgmentRow.judgment,
  };
}

function applyGate(row, model, threshold, evalWindow) {
  if (row.answer_type !== "grounded_answer") return baselinePrediction(row, evalWindow, null, threshold);
  const entailmentScore = predict(model, featureVector(row).values);
  const gateFired = entailmentScore < threshold;
  const prediction = gateFired ? abstainPrediction(entailmentScore, threshold) : row.prediction;
  const oracleCorrect = gateFired ? !row.answer_supported : row.answer_supported;
  return {
    example_id: row.example_id,
    window: evalWindow,
    prediction,
    source_prediction: row.prediction,
    metadata: {
      scaffold: "zero_call_learned_claim_entailment_gate",
      entailment_score: entailmentScore,
      threshold,
      gate_fired: gateFired,
      upstream_support_score: row.support_score,
    },
    inherited_judgment: {
      source_verdict: row.judgment?.verdict ?? null,
      source_answer_supported: row.answer_supported,
      source_baseline_correct: row.baseline_correct,
      support_oracle_correct: oracleCorrect,
      interpretation: gateFired
        ? (row.answer_supported ? "harmful_suppression_supported_answer" : "suppressed_unsupported_answer")
        : "unchanged",
    },
    scores: scoreFromLocal(row.local_scores, prediction),
  };
}

function baselinePrediction(row, evalWindow, entailmentScore = null, threshold = null) {
  return {
    example_id: row.example_id,
    window: evalWindow,
    prediction: row.prediction,
    source_prediction: row.prediction,
    metadata: {
      scaffold: "balanced_support_risk_gate_baseline",
      entailment_score: entailmentScore,
      threshold,
      gate_fired: false,
      upstream_support_score: row.support_score,
    },
    inherited_judgment: {
      source_verdict: row.judgment?.verdict ?? null,
      source_answer_supported: row.answer_supported,
      source_baseline_correct: row.baseline_correct,
      support_oracle_correct: row.baseline_correct,
      interpretation: "unchanged",
    },
    scores: row.local_scores,
  };
}

function tuneThreshold(rows, model) {
  const scores = rows.map((row) => predict(model, featureVector(row).values));
  const candidates = [...new Set([0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, ...scores])].sort((a, b) => a - b);
  let best = null;
  for (const threshold of candidates) {
    const metrics = summarizePolicy(rows.map((row) => applyGate(row, model, threshold, "train")));
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
    "question_cited_overlap",
    "answer_token_count",
    "citation_count",
    "claim_count",
  ];
  const values = [
    Number(row.support_score ?? 0),
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
  ];
  return { names, values };
}

function abstainPrediction(score, threshold) {
  return {
    answer_type: "abstain",
    answer: "The cited evidence does not provide enough support for the generated claim.",
    citations: [],
    claim_table: [{ claim: "Generated answer failed learned cited-evidence support checks.", support: "learned_claim_entailment_gate", citations: [] }],
    abstention_reason: `Learned claim-entailment score ${score.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
  };
}

function summarizePolicy(rows) {
  const answered = rows.filter((row) => row.prediction.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction.answer_type === "abstain");
  const correct = rows.filter((row) => row.inherited_judgment.support_oracle_correct);
  const supportedAnswers = answered.filter((row) => row.inherited_judgment.source_answer_supported);
  const suppressions = rows.filter((row) => row.metadata.gate_fired);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: rows.length ? answered.length / rows.length : 0,
    support_oracle_correct: correct.length,
    support_oracle_correct_rate: rows.length ? correct.length / rows.length : 0,
    answer_support_rate: answered.length ? supportedAnswers.length / answered.length : 0,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
    gate_fired: suppressions.length,
    suppressed_unsupported: suppressions.filter((row) => row.inherited_judgment.interpretation === "suppressed_unsupported_answer").length,
    harmful_suppressed_supported: suppressions.filter((row) => row.inherited_judgment.interpretation === "harmful_suppression_supported_answer").length,
  };
}

function renderReport(result) {
  const foldRows = result.folds.map((fold) => (
    `| ${fold.eval_window} | ${fold.train_windows.join(", ")} | ${fold.threshold.toFixed(3)} | ${fold.eval_metrics.answered} | ${pct(fold.eval_metrics.support_oracle_correct_rate)} | ${pct(fold.eval_metrics.answer_support_rate)} | ${fold.eval_metrics.gate_fired} | ${fold.eval_metrics.suppressed_unsupported} | ${fold.eval_metrics.harmful_suppressed_supported} |`
  )).join("\n");
  return `# Learned Entailment Gate Cross-Window Evaluation

Scope: ${result.scope}

This run makes no LLM calls. It trains a local logistic claim-entailment gate on one already judged future window and evaluates on the other, then aggregates both directions.

| Policy | Answered | Answer rate | Support-oracle correct | Answer support | Citation recall | Answer F1 | Gate fired | Suppressed unsupported | Harmful suppressed supported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${policyRow("Balanced support-risk gate", result.baseline_metrics)}
${policyRow("Cross-window learned entailment gate", result.aggregate_metrics)}

## Delta vs Balanced Gate

- Answered examples: ${signed(result.deltas.answered_delta)}
- Support-oracle correctness: ${signedPct(result.deltas.support_oracle_correct_delta)}
- Answer support: ${signedPct(result.deltas.answer_support_delta)}
- Citation recall: ${signedPct(result.deltas.citation_recall_delta)}
- Answer F1: ${signedPct(result.deltas.answer_f1_delta)}

## Fold Details

| Eval window | Train windows | Threshold | Answered | Support-oracle correct | Answer support | Gate fired | Suppressed unsupported | Harmful suppressed supported |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${foldRows}

## Interpretation

The cross-window setup tests whether broader local entailment features transfer beyond the window used to fit them. A useful gate should suppress unsupported answers faster than supported answers while preserving more coverage than a blunt abstention rule.
`;
}

function policyRow(label, metrics) {
  return `| ${label} | ${metrics.answered} | ${pct(metrics.answer_rate)} | ${metrics.support_oracle_correct} / ${metrics.examples} (${pct(metrics.support_oracle_correct_rate)}) | ${pct(metrics.answer_support_rate)} | ${pct(metrics.citation_recall)} | ${pct(metrics.answer_token_f1)} | ${metrics.gate_fired} | ${metrics.suppressed_unsupported} | ${metrics.harmful_suppressed_supported} |`;
}

function delta(left, right) {
  return {
    answered_delta: left.answered - right.answered,
    support_oracle_correct_delta: left.support_oracle_correct_rate - right.support_oracle_correct_rate,
    answer_support_delta: left.answer_support_rate - right.answer_support_rate,
    citation_recall_delta: left.citation_recall - right.citation_recall,
    answer_f1_delta: left.answer_token_f1 - right.answer_token_f1,
  };
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

function keyed(rows) {
  return new Map(rows.map((row) => [row.example_id, row]));
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
