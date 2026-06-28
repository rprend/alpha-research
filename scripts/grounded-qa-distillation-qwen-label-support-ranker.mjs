import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const supportLabelPacketRunId = args["support-label-packet"] ?? "qwen-nonfinal-support-label-packet-2026-06-28-v1";
const runId = args["run-id"] ?? "qwen-label-support-ranker-2026-06-28-v1";
const qwenTrainMaxSourceIndex = Number(args["qwen-train-max-source-index"] ?? 300);
const outputDir = path.join(runsDir, runId);

const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const negationTerms = ["not", "no", "never", "without", "neither", "nor", "cannot", "can't", "doesn't", "didn't", "isn't", "aren't"];
const stopwords = new Set([
  "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported",
]);
const featureNames = [
  "answer_cited_token_coverage",
  "answer_pack_token_coverage",
  "claim_min_cited_coverage",
  "claim_mean_cited_coverage",
  "claim_max_sentence_coverage_min",
  "claim_max_sentence_coverage_mean",
  "answer_sentence_coverage",
  "unsupported_answer_token_rate",
  "unsupported_claim_token_rate",
  "supported_number_rate",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "negation_mismatch_count",
  "question_answer_overlap",
  "question_cited_overlap",
  "answer_tokens",
  "citation_count",
  "claim_count",
  "inline_complete",
  "answer_is_short",
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const pairwiseDir = path.join(runsDir, pairwisePacketRunId);
const supportLabelDir = path.join(runsDir, supportLabelPacketRunId);
const trainPairs = await readJsonl(path.join(pairwiseDir, "train_pairwise.jsonl"));
const validationPairs = await readJsonl(path.join(pairwiseDir, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(pairwiseDir, "diagnostic_frontier_pairwise.jsonl"));
const supportLabels = await readJsonl(path.join(supportLabelDir, "support_labels.jsonl"));
const supportPacket = await readJson(path.join(supportLabelDir, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const pairwiseTrainExamples = trainPairs.flatMap((pair) => pointwiseExamplesFromPair(pair, "existing_pairwise_train"));
const qwenAnswerLabels = supportLabels
  .filter((row) => row.labels?.answer_type === "grounded_answer")
  .map((row) => pointwiseExampleFromSupportLabel(row));
const qwenTrainExamples = qwenAnswerLabels.filter((row) => row.source_index < qwenTrainMaxSourceIndex);
const qwenValidationExamples = qwenAnswerLabels.filter((row) => row.source_index >= qwenTrainMaxSourceIndex);
const trainExamples = [...pairwiseTrainExamples, ...qwenTrainExamples];

const scaler = fitScaler(trainExamples.map((row) => row.vector));
const model = trainPointwiseLogistic(trainExamples.map((row) => ({ ...row, vector: scaleVector(row.vector, scaler) })), {
  epochs: 360,
  learningRate: 0.08,
  l2: 0.03,
});

const trainEval = evaluatePointwise(trainExamples, model, scaler);
const qwenValidationEval = evaluatePointwise(qwenValidationExamples, model, scaler);
const validationPairEval = evaluatePairs(validationPairs, model, scaler);
const diagnosticPairEval = evaluatePairs(diagnosticPairs, model, scaler);
const diagnosticSelections = selectDiagnosticCandidates(diagnosticPairs, model, scaler);
const diagnosticSelectionMetrics = summarizeSelections(diagnosticSelections);
const status = deriveStatus(qwenValidationEval, validationPairEval, diagnosticSelectionMetrics);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_label_support_ranker",
  status,
  pairwise_packet_run_id: pairwisePacketRunId,
  support_label_packet_run_id: supportLabelPacketRunId,
  purpose: "Train a zero-cost support ranker from existing leakage-safe pairwise labels plus non-final Qwen GPT-4o support labels, then evaluate final-window Qwen frontier rows only as diagnostics.",
  feature_names: featureNames,
  training: {
    algorithm: "standardized_pointwise_logistic_regression",
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
    pairwise_train_pointwise_examples: pairwiseTrainExamples.length,
    qwen_train_examples: qwenTrainExamples.length,
    qwen_validation_examples: qwenValidationExamples.length,
    qwen_train_source_index_range: [Math.min(...qwenTrainExamples.map((row) => row.source_index)), Math.max(...qwenTrainExamples.map((row) => row.source_index))],
    qwen_validation_source_index_range: [Math.min(...qwenValidationExamples.map((row) => row.source_index)), Math.max(...qwenValidationExamples.map((row) => row.source_index))],
  },
  metrics: {
    train_pointwise: summarizePointwiseEval(trainEval),
    qwen_validation_pointwise: summarizePointwiseEval(qwenValidationEval),
    validation_pairwise: summarizePairEval(validationPairEval),
    final_diagnostic_pairwise: summarizePairEval(diagnosticPairEval),
    final_diagnostic_selection: diagnosticSelectionMetrics,
  },
  model: {
    intercept: model.intercept,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    qwen_support_label_source_index_min: supportPacket.leakage_guard?.source_index_min,
    qwen_support_label_source_index_max: supportPacket.leakage_guard?.source_index_max,
    qwen_validation_held_out_from_training: true,
  },
  decision: decisionFromMetrics(qwenValidationEval, validationPairEval, diagnosticSelectionMetrics),
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_openai_cost_usd: supportPacket.cost?.openai_cost_usd_inherited ?? 0,
    inherited_external_compute_cost_usd: supportPacket.cost?.external_compute_cost_usd_inherited ?? 0,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This ranker materialization trains locally from existing labels only; inherited label costs are recorded on the source support-label packet.",
  },
};

await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), trainEval.rows);
await writeJsonl(path.join(outputDir, "qwen_validation_predictions.jsonl"), qwenValidationEval.rows);
await writeJsonl(path.join(outputDir, "validation_pair_predictions.jsonl"), validationPairEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_pair_predictions.jsonl"), diagnosticPairEval.rows);
await writeJsonl(path.join(outputDir, "diagnostic_selections.jsonl"), diagnosticSelections);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);
console.log(JSON.stringify({ run_id: runId, status, metrics: result.metrics, decision: result.decision }, null, 2));

function pointwiseExamplesFromPair(pair, source) {
  return [
    pointwiseExampleFromCandidate({
      exampleId: pair.example_id,
      source,
      input: pair.input,
      candidate: pair.chosen,
      label: 1,
      trainingUse: pair.training_use,
      sourceIndex: null,
    }),
    pointwiseExampleFromCandidate({
      exampleId: pair.example_id,
      source,
      input: pair.input,
      candidate: pair.rejected,
      label: 0,
      trainingUse: pair.training_use,
      sourceIndex: null,
    }),
  ];
}

function pointwiseExampleFromSupportLabel(row) {
  return pointwiseExampleFromCandidate({
    exampleId: row.example_id,
    source: "qwen_nonfinal_support_label",
    input: {
      question: row.question,
      compact_retrieved_evidence_pack: row.evidence_pack,
    },
    candidate: row.candidate,
    label: row.labels.supported_answer ? 1 : 0,
    trainingUse: row.training_use,
    sourceIndex: Number(row.source_index),
  });
}

function pointwiseExampleFromCandidate({ exampleId, source, input, candidate, label, trainingUse, sourceIndex }) {
  const features = entailmentFeatures(input, candidate);
  return {
    example_id: exampleId,
    source,
    training_use: trainingUse,
    source_index: sourceIndex,
    candidate_id: candidate.id ?? candidate.prediction_run_id ?? source,
    family: candidate.family ?? "qwen_nonfinal",
    label,
    answer: candidate.answer,
    citations: candidate.citations ?? [],
    vector: featureNames.map((name) => features[name] ?? 0),
    features,
  };
}

function entailmentFeatures(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const citedText = citedIds.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = (input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" ");
  const answer = String(candidate.answer ?? "");
  const answerTokens = contentTokens(answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const claims = (candidate.claim_table ?? []).map((claim) => `${claim.claim ?? ""} ${claim.support ?? ""} ${claim.evidence ?? ""}`);
  const claimTokens = claims.map((claim) => contentTokens(claim));
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const claimMaxSentenceCoverage = claimTokens.map((tokens) => maxCoverage(tokens, citedSentences));
  const claimCoverages = claimTokens.map((tokens) => tokenCoverage(tokens, citedTokens));
  const unsupportedAnswerTokens = unsupportedContentTokens(answerTokens, citedTokens, questionTokens);
  const unsupportedClaimTokens = unsupportedContentTokens(claimTokens.flat(), citedTokens, questionTokens);
  const answerNumbers = numberTokens(answer);
  const supportedNumbers = answerNumbers.filter((number) => citedText.toLowerCase().includes(number.toLowerCase()));
  return {
    answer_cited_token_coverage: tokenCoverage(answerTokens, citedTokens),
    answer_pack_token_coverage: tokenCoverage(answerTokens, packTokens),
    claim_min_cited_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_mean_cited_coverage: mean(claimCoverages),
    claim_max_sentence_coverage_min: claimMaxSentenceCoverage.length ? Math.min(...claimMaxSentenceCoverage) : 0,
    claim_max_sentence_coverage_mean: mean(claimMaxSentenceCoverage),
    answer_sentence_coverage: maxCoverage(answerTokens, citedSentences),
    unsupported_answer_token_rate: answerTokens.length ? unsupportedAnswerTokens.length / answerTokens.length : 0,
    unsupported_claim_token_rate: claimTokens.flat().length ? unsupportedClaimTokens.length / claimTokens.flat().length : 0,
    supported_number_rate: answerNumbers.length ? supportedNumbers.length / answerNumbers.length : 1,
    unsupported_number_count: answerNumbers.length - supportedNumbers.length,
    unsupported_comparative_count: unsupportedComparatives(answer, citedText),
    negation_mismatch_count: negationMismatch(answer, citedText),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    answer_tokens: answerTokens.length,
    citation_count: citedIds.length,
    claim_count: candidate.claim_table?.length ?? 0,
    inline_complete: citedIds.length > 0 && citedIds.every((id) => answer.includes(`[${id}]`)) ? 1 : 0,
    answer_is_short: answerTokens.length <= 3 ? 1 : 0,
  };
}

function trainPointwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  let intercept = 0;
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 35);
    for (const row of rows) {
      const predicted = sigmoid(intercept + dot(weights, row.vector));
      const error = predicted - row.label;
      intercept -= rate * error;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (error * row.vector[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, intercept, epochs, learningRate, l2 };
}

function evaluatePointwise(rows, model, scaler) {
  const predictions = rows.map((row) => {
    const score = scoreVector(row.vector, model, scaler);
    const probability = sigmoid(score);
    const predicted = probability >= 0.5 ? 1 : 0;
    return {
      example_id: row.example_id,
      source: row.source,
      candidate_id: row.candidate_id,
      family: row.family,
      label: row.label,
      predicted_label: predicted,
      correct: predicted === row.label,
      score,
      probability,
      training_use: row.training_use,
      source_index: row.source_index,
    };
  });
  return {
    examples: rows.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rows.length ? predictions.filter((row) => row.correct).length / rows.length : 0,
    positive_labels: rows.filter((row) => row.label === 1).length,
    predicted_positive: predictions.filter((row) => row.predicted_label === 1).length,
    rows: predictions,
  };
}

function evaluatePairs(pairs, model, scaler) {
  const predictions = pairs.map((pair) => {
    const chosenScore = scoreCandidate(pair.input, pair.chosen, model, scaler);
    const rejectedScore = scoreCandidate(pair.input, pair.rejected, model, scaler);
    const margin = chosenScore - rejectedScore;
    const predicted = margin >= 0 ? "chosen" : "rejected";
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      split: pair.split,
      window: pair.window,
      predicted_preferred: predicted,
      correct: predicted === "chosen",
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
      training_use: pair.training_use,
    };
  });
  return {
    pairs: pairs.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: pairs.length ? predictions.filter((row) => row.correct).length / pairs.length : 0,
    mean_margin: mean(predictions.map((row) => row.margin)),
    rows: predictions,
  };
}

function selectDiagnosticCandidates(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
      const key = `${pair.example_id}:${candidate.id}`;
      if (byExample.get(pair.example_id).has(key)) continue;
      byExample.get(pair.example_id).set(key, {
        example_id: pair.example_id,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(pair.input, candidate, model, scaler),
      });
    }
  }
  return [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function scoreCandidate(input, candidate, model, scaler) {
  const features = entailmentFeatures(input, candidate);
  return scoreVector(featureNames.map((name) => features[name] ?? 0), model, scaler);
}

function scoreVector(vector, model, scaler) {
  return model.intercept + dot(model.weights, scaleVector(vector, scaler));
}

function fitScaler(vectors) {
  const meanByName = {};
  const stdByName = {};
  for (const [index, name] of featureNames.entries()) {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    meanByName[name] = center;
    stdByName[name] = Math.sqrt(variance) || 1;
  }
  return { mean: meanByName, std: stdByName };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => {
    const name = featureNames[index];
    return (value - Number(scaler.mean[name] ?? 0)) / Number(scaler.std[name] || 1);
  });
}

function summarizePointwiseEval(evalResult) {
  return {
    examples: evalResult.examples,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    positive_labels: evalResult.positive_labels,
    predicted_positive: evalResult.predicted_positive,
  };
}

function summarizePairEval(evalResult) {
  return {
    pairs: evalResult.pairs,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    mean_margin: evalResult.mean_margin,
  };
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rows.length ? selectedSupported / rows.length : 0,
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function deriveStatus(qwenValidationEval, validationPairEval, diagnosticSelectionMetrics) {
  if (qwenValidationEval.accuracy >= 0.7 && validationPairEval.accuracy >= 0.6 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) {
    return "qwen_label_ranker_promising_for_selector_integration";
  }
  if (diagnosticSelectionMetrics.selection_support_rate > 0.625) return "qwen_label_ranker_improves_final_diagnostic_but_not_ready";
  return "qwen_label_ranker_not_reliable";
}

function decisionFromMetrics(qwenValidationEval, validationPairEval, diagnosticSelectionMetrics) {
  if (qwenValidationEval.accuracy >= 0.7 && validationPairEval.accuracy >= 0.6 && diagnosticSelectionMetrics.selection_support_rate >= 0.7) {
    return {
      integrate_selector_now: true,
      launch_gpu_now: false,
      reason: "Non-final Qwen support labels improve enough on held-out Qwen labels, cross-window validation pairs, and final diagnostic selection to justify a selector integration audit.",
      next_step: "Integrate the ranker into the calibrated hybrid selector as a zero-cost diagnostic and test answer-rate/support tradeoffs.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    reason: "The Qwen-label ranker still does not clear all held-out validation and final diagnostic thresholds.",
    next_step: "Inspect misses and either add more non-final Qwen support labels or train a stronger verifier before another generator run.",
  };
}

function maxCoverage(tokens, sentenceTokens) {
  if (!tokens.length || !sentenceTokens.length) return 0;
  return Math.max(...sentenceTokens.map((sentence) => tokenCoverage(tokens, sentence)));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function contentTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+|\n+/).filter((sentence) => sentence.trim());
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
}

function unsupportedComparatives(answer, citedText) {
  const support = String(citedText ?? "").toLowerCase();
  return comparativeTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term) && !support.includes(term)).length;
}

function negationMismatch(answer, citedText) {
  const answerNegations = negationTerms.filter((term) => String(answer ?? "").toLowerCase().includes(term)).length;
  const evidenceNegations = negationTerms.filter((term) => String(citedText ?? "").toLowerCase().includes(term)).length;
  return Math.abs(answerNegations - evidenceNegations);
}

function renderReport(result) {
  return `# Qwen Label Support Ranker

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no compute. It trains from existing leakage-safe labels and keeps final-window Qwen frontier rows diagnostic-only.

| Split | Rows/pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pointwise | ${result.metrics.train_pointwise.examples} | ${result.metrics.train_pointwise.correct} | ${formatPct(result.metrics.train_pointwise.accuracy)} |
| Qwen non-final validation pointwise | ${result.metrics.qwen_validation_pointwise.examples} | ${result.metrics.qwen_validation_pointwise.correct} | ${formatPct(result.metrics.qwen_validation_pointwise.accuracy)} |
| Existing validation pairwise | ${result.metrics.validation_pairwise.pairs} | ${result.metrics.validation_pairwise.correct} | ${formatPct(result.metrics.validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${formatPct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Final diagnostic selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${formatPct(result.metrics.final_diagnostic_selection.selection_support_rate)} |

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPct(value) {
  return `${(100 * value).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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
