import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const split = args.split ?? "validation";
const trainSplit = args["train-split"] ?? "train";
const thresholdGrid = (args.thresholds ?? args.threshold ?? "0,0.04,0.08,0.12")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
const learnedThresholdGrid = (args["learned-thresholds"] ?? "0.35,0.5,0.65")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
const sufficiencyThresholdGrid = (args["sufficiency-thresholds"] ?? "0.35,0.5,0.65")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
const runId = args["run-id"] ?? `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-${split}`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const examples = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const trainExamples = await readJsonl(path.join(dataDir, `${trainSplit}.jsonl`));
const learnedSelector = trainEvidenceSelector(trainExamples);
const sufficiencyCalibrator = trainSufficiencyCalibrator(trainExamples, learnedSelector);
const answerCompressor = trainAnswerCompressor(trainExamples);
const spanAnswerer = trainSpanAnswerer(trainExamples);
const systems = [
  evaluateSystem("retrieval_rank_1", examples, predictRankOne),
  ...thresholdGrid.map((threshold) => evaluateSystem(`lexical_overlap_t${formatThreshold(threshold)}`, examples, (example) => predictLexical(example, threshold))),
  evaluateSystem("learned_selector_top1", examples, (example) => predictLearned(example, learnedSelector, { topK: 1, threshold: 0 })),
  ...learnedThresholdGrid.map((threshold) => evaluateSystem(`learned_selector_top2_t${formatThreshold(threshold)}`, examples, (example) => predictLearned(example, learnedSelector, { topK: 2, threshold }))),
  ...sufficiencyThresholdGrid.map((threshold) => evaluateSystem(`suff_calibrated_top2_t${formatThreshold(threshold)}`, examples, (example) => predictSufficiencyCalibrated(example, learnedSelector, sufficiencyCalibrator, { topK: 2, threshold }))),
  ...sufficiencyThresholdGrid.map((threshold) => evaluateSystem(`suff_compressed_top2_t${formatThreshold(threshold)}`, examples, (example) => predictSufficiencyCalibrated(example, learnedSelector, sufficiencyCalibrator, { topK: 2, threshold, compressor: answerCompressor }))),
  ...sufficiencyThresholdGrid.map((threshold) => evaluateSystem(`suff_span_top2_t${formatThreshold(threshold)}`, examples, (example) => predictSufficiencyCalibrated(example, learnedSelector, sufficiencyCalibrator, { topK: 2, threshold, spanAnswerer }))),
];
const run = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  train_split: trainSplit,
  threshold_grid: thresholdGrid,
  learned_threshold_grid: learnedThresholdGrid,
  sufficiency_threshold_grid: sufficiencyThresholdGrid,
  learned_selector: {
    training_examples: trainExamples.length,
    train_split: trainSplit,
    feature_count: Object.keys(learnedSelector.weights).length,
    epochs: learnedSelector.epochs,
    learning_rate: learnedSelector.learningRate,
    training_accuracy: learnedSelector.trainingAccuracy,
    positive_candidates: learnedSelector.positiveCandidates,
    negative_candidates: learnedSelector.negativeCandidates,
  },
  sufficiency_calibrator: {
    training_examples: trainExamples.length,
    train_split: trainSplit,
    feature_count: Object.keys(sufficiencyCalibrator.weights).length,
    epochs: sufficiencyCalibrator.epochs,
    learning_rate: sufficiencyCalibrator.learningRate,
    training_accuracy: sufficiencyCalibrator.trainingAccuracy,
    positive_examples: sufficiencyCalibrator.positiveExamples,
    negative_examples: sufficiencyCalibrator.negativeExamples,
  },
  answer_compressor: {
    training_examples: trainExamples.length,
    train_split: trainSplit,
    vocabulary_size: Object.keys(answerCompressor.tokenStats).length,
    positive_tokens: answerCompressor.positiveTokens,
    negative_tokens: answerCompressor.negativeTokens,
  },
  span_answerer: {
    training_examples: trainExamples.length,
    train_split: trainSplit,
    candidate_count: spanAnswerer.candidateCount,
    positive_candidates: spanAnswerer.positiveCandidates,
    negative_candidates: spanAnswerer.negativeCandidates,
    training_accuracy: spanAnswerer.trainingAccuracy,
  },
  examples: examples.length,
  systems: systems.map(({ predictions, ...summary }) => summary),
};

for (const system of systems) {
  await writeJsonl(path.join(outputDir, `${system.system}.predictions.jsonl`), system.predictions);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(run, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "learned-selector-model.json"), `${JSON.stringify(learnedSelector, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "sufficiency-calibrator-model.json"), `${JSON.stringify(sufficiencyCalibrator, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "answer-compressor-model.json"), `${JSON.stringify(answerCompressor, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "span-answerer-model.json"), `${JSON.stringify(spanAnswerer, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(run));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  systems: run.systems,
}, null, 2));

function evaluateSystem(system, examples, predict) {
  const predictions = examples.map((example) => {
    const prediction = predict(example);
    const reference = normalizeReference(example);
    const predictedCitations = new Set(prediction.citations);
    const referenceCitations = new Set(reference.citations);
    const citedGold = prediction.citations.filter((id) => example.teacher_trace.evidence_roles[id] === "gold_evidence").length;
    const answerable = reference.answer_type !== "abstain";
    const abstained = prediction.answer_type === "abstain";
    return {
      example_id: example.example_id,
      system,
      prediction,
      reference,
      scores: {
        answer_type_correct: prediction.answer_type === reference.answer_type,
        citation_precision: prediction.citations.length ? citedGold / prediction.citations.length : null,
        citation_recall: reference.citations.length
          ? prediction.citations.filter((id) => referenceCitations.has(id)).length / reference.citations.length
          : null,
        answer_token_f1: answerable ? (!abstained ? tokenF1(prediction.answer, reference.answer) : 0) : null,
        abstention_correct: answerable ? !abstained : abstained,
      },
    };
  });

  const avg = (key) => mean(predictions.map((row) => row.scores[key]));
  return {
    system,
    predictions,
    metrics: {
      examples: predictions.length,
      answer_type_accuracy: avg("answer_type_correct"),
      citation_precision: avg("citation_precision"),
      citation_recall: avg("citation_recall"),
      answer_token_f1: avg("answer_token_f1"),
      abstention_accuracy: avg("abstention_correct"),
      abstention_rate: mean(predictions.map((row) => row.prediction.answer_type === "abstain" ? 1 : 0)),
    },
  };
}

function predictRankOne(example) {
  const first = example.input.compact_retrieved_evidence_pack[0];
  if (!first) return abstain("empty evidence pack");
  return answerFromEvidence(first, "rank-one scaffold cites the first retrieved evidence item");
}

function predictLexical(example, minOverlap) {
  let best = null;
  for (const evidence of example.input.compact_retrieved_evidence_pack) {
    const score = jaccard(contentTokens(example.input.question), contentTokens(evidence.text));
    if (!best || score > best.score) best = { evidence, score };
  }
  if (!best || best.score < minOverlap) return abstain(`best lexical overlap ${best?.score.toFixed(3) ?? "0.000"} below threshold ${minOverlap}`);
  return answerFromEvidence(best.evidence, `lexical scaffold selected evidence with overlap ${best.score.toFixed(3)}`);
}

function predictLearned(example, model, { topK, threshold }) {
  const ranked = rankEvidence(example, model);

  const selected = ranked
    .filter((item, index) => index === 0 || item.probability >= threshold)
    .slice(0, topK)
    .filter((item) => item.probability >= threshold);

  if (!selected.length) {
    const best = ranked[0]?.probability ?? 0;
    return abstain(`learned selector best probability ${best.toFixed(3)} below threshold ${threshold}`);
  }

  return answerFromEvidenceSet(
    selected.map((item) => item.evidence),
    `learned evidence selector chose ${selected.length} item(s), top probability ${selected[0].probability.toFixed(3)}`,
  );
}

function predictSufficiencyCalibrated(example, selectorModel, sufficiencyModel, { topK, threshold, compressor = null, spanAnswerer = null }) {
  const ranked = rankEvidence(example, selectorModel);
  const selected = ranked.slice(0, topK);
  const probability = sigmoid(scoreFeatures(sufficiencyModel.weights, sufficiencyFeatures(example, selected)));
  if (probability < threshold) {
    return abstain(`sufficiency probability ${probability.toFixed(3)} below threshold ${threshold}`);
  }
  const rationale = `sufficiency-calibrated selector chose ${selected.length} item(s), sufficiency probability ${probability.toFixed(3)}`;
  if (spanAnswerer) {
    return spanAnswerFromEvidenceSet(example, selected.map((item) => item.evidence), spanAnswerer, rationale);
  }
  if (compressor) {
    return compressedAnswerFromEvidenceSet(example, selected.map((item) => item.evidence), compressor, rationale);
  }
  return answerFromEvidenceSet(selected.map((item) => item.evidence), rationale);
}

function rankEvidence(example, model) {
  return example.input.compact_retrieved_evidence_pack
    .map((evidence) => ({
      evidence,
      probability: sigmoid(scoreFeatures(model.weights, evidenceFeatures(example, evidence))),
    }))
    .sort((a, b) => b.probability - a.probability || a.evidence.retrieval_rank - b.evidence.retrieval_rank);
}

function answerFromEvidence(evidence, rationale) {
  const sentence = firstUsefulSentence(evidence.text);
  return {
    answer_type: "grounded_answer",
    answer: `${sentence} [${evidence.evidence_id}]`,
    citations: [evidence.evidence_id],
    rationale,
  };
}

function answerFromEvidenceSet(evidenceItems, rationale) {
  const sentences = evidenceItems.map((evidence) => `${firstUsefulSentence(evidence.text)} [${evidence.evidence_id}]`);
  return {
    answer_type: "grounded_answer",
    answer: sentences.join(" "),
    citations: evidenceItems.map((evidence) => evidence.evidence_id),
    rationale,
  };
}

function compressedAnswerFromEvidenceSet(example, evidenceItems, compressor, rationale) {
  const parts = evidenceItems.map((evidence) => {
    const compressed = compressEvidenceText(example, evidence, compressor);
    return `${compressed || firstUsefulSentence(evidence.text)} [${evidence.evidence_id}]`;
  });
  return {
    answer_type: "grounded_answer",
    answer: parts.join("; "),
    citations: evidenceItems.map((evidence) => evidence.evidence_id),
    rationale: `${rationale}; compressed selected evidence`,
  };
}

function spanAnswerFromEvidenceSet(example, evidenceItems, model, rationale) {
  const selected = evidenceItems.map((evidence) => {
    const span = selectAnswerSpan(example, evidence, model);
    return `${span || firstUsefulSentence(evidence.text)} [${evidence.evidence_id}]`;
  });
  return {
    answer_type: "grounded_answer",
    answer: selected.join("; "),
    citations: evidenceItems.map((evidence) => evidence.evidence_id),
    rationale: `${rationale}; supervised span answerer selected answer-like spans`,
  };
}

function abstain(rationale) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    rationale,
  };
}

function normalizeReference(example) {
  return {
    answer_type: example.output.answer_type,
    answer: stripCitations(example.output.answer),
    citations: (example.output.citations ?? []).map((citation) => citation.evidence_id),
  };
}

function firstUsefulSentence(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const selected = parts.find((part) => contentTokens(part).length >= 5) ?? parts[0] ?? String(text).trim();
  return selected.length > 420 ? `${selected.slice(0, 417).trim()}...` : selected;
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

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function trainEvidenceSelector(examples) {
  const candidates = [];
  for (const example of examples) {
    for (const evidence of example.input.compact_retrieved_evidence_pack) {
      candidates.push({
        features: evidenceFeatures(example, evidence),
        label: example.teacher_trace.evidence_roles[evidence.evidence_id] === "gold_evidence" ? 1 : 0,
      });
    }
  }

  const weights = {};
  const epochs = numberArg(args.epochs, 60);
  const learningRate = Number(args["learning-rate"] ?? 0.18);
  const l2 = Number(args.l2 ?? 0.0005);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const candidate of candidates) {
      const prediction = sigmoid(scoreFeatures(weights, candidate.features));
      const error = candidate.label - prediction;
      for (const [name, value] of Object.entries(candidate.features)) {
        weights[name] = (weights[name] ?? 0) * (1 - learningRate * l2) + learningRate * error * value;
      }
    }
  }

  const correct = candidates.filter((candidate) => {
    const prediction = sigmoid(scoreFeatures(weights, candidate.features)) >= 0.5 ? 1 : 0;
    return prediction === candidate.label;
  }).length;

  return {
    model_type: "hashed-logistic-evidence-selector",
    epochs,
    learningRate,
    l2,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    positiveCandidates: candidates.filter((candidate) => candidate.label === 1).length,
    negativeCandidates: candidates.filter((candidate) => candidate.label === 0).length,
    weights,
  };
}

function trainSufficiencyCalibrator(examples, selectorModel) {
  const candidates = examples.map((example) => {
    const ranked = rankEvidence(example, selectorModel).slice(0, 2);
    return {
      features: sufficiencyFeatures(example, ranked),
      label: example.output.answer_type === "grounded_answer" ? 1 : 0,
    };
  });

  const weights = {};
  const epochs = numberArg(args["sufficiency-epochs"], 80);
  const learningRate = Number(args["sufficiency-learning-rate"] ?? 0.16);
  const l2 = Number(args["sufficiency-l2"] ?? 0.0005);
  const positiveCount = candidates.filter((candidate) => candidate.label === 1).length;
  const negativeCount = candidates.length - positiveCount;
  const positiveWeight = positiveCount ? candidates.length / (2 * positiveCount) : 1;
  const negativeWeight = negativeCount ? candidates.length / (2 * negativeCount) : 1;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const candidate of candidates) {
      const prediction = sigmoid(scoreFeatures(weights, candidate.features));
      const classWeight = candidate.label === 1 ? positiveWeight : negativeWeight;
      const error = (candidate.label - prediction) * classWeight;
      for (const [name, value] of Object.entries(candidate.features)) {
        weights[name] = (weights[name] ?? 0) * (1 - learningRate * l2) + learningRate * error * value;
      }
    }
  }

  const correct = candidates.filter((candidate) => {
    const prediction = sigmoid(scoreFeatures(weights, candidate.features)) >= 0.5 ? 1 : 0;
    return prediction === candidate.label;
  }).length;

  return {
    model_type: "weighted-logistic-sufficiency-calibrator",
    epochs,
    learningRate,
    l2,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    positiveExamples: positiveCount,
    negativeExamples: negativeCount,
    weights,
  };
}

function trainAnswerCompressor(examples) {
  const tokenStats = {};
  let positiveTokens = 0;
  let negativeTokens = 0;
  for (const example of examples) {
    if (example.output.answer_type !== "grounded_answer") continue;
    const answerTokens = new Set(contentTokens(example.output.answer));
    const goldEvidence = example.input.compact_retrieved_evidence_pack
      .filter((evidence) => example.teacher_trace.evidence_roles[evidence.evidence_id] === "gold_evidence");
    for (const evidence of goldEvidence) {
      for (const token of contentTokens(evidence.text)) {
        tokenStats[token] ??= { positive: 0, negative: 0 };
        if (answerTokens.has(token)) {
          tokenStats[token].positive += 1;
          positiveTokens += 1;
        } else {
          tokenStats[token].negative += 1;
          negativeTokens += 1;
        }
      }
    }
  }

  return {
    model_type: "answer-token-salience-compressor",
    tokenStats,
    positiveTokens,
    negativeTokens,
  };
}

function trainSpanAnswerer(examples) {
  const candidates = [];
  for (const example of examples) {
    if (example.output.answer_type !== "grounded_answer") continue;
    const answer = stripCitations(example.output.answer);
    const goldEvidence = example.input.compact_retrieved_evidence_pack
      .filter((evidence) => example.teacher_trace.evidence_roles[evidence.evidence_id] === "gold_evidence");
    for (const evidence of goldEvidence) {
      const spans = candidateAnswerSpans(evidence.text);
      if (!spans.length) continue;
      const scored = spans.map((span) => ({
        span,
        labelScore: tokenF1(span, answer),
      }));
      const bestScore = Math.max(...scored.map((span) => span.labelScore));
      for (const item of scored) {
        candidates.push({
          features: spanFeatures(example, evidence, item.span),
          label: bestScore > 0 && item.labelScore >= Math.max(0.18, bestScore * 0.72) ? 1 : 0,
        });
      }
    }
  }

  const weights = {};
  const epochs = numberArg(args["span-epochs"], 80);
  const learningRate = Number(args["span-learning-rate"] ?? 0.14);
  const l2 = Number(args["span-l2"] ?? 0.0007);
  const positiveCount = candidates.filter((candidate) => candidate.label === 1).length;
  const negativeCount = candidates.length - positiveCount;
  const positiveWeight = positiveCount ? candidates.length / (2 * positiveCount) : 1;
  const negativeWeight = negativeCount ? candidates.length / (2 * negativeCount) : 1;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const candidate of candidates) {
      const prediction = sigmoid(scoreFeatures(weights, candidate.features));
      const classWeight = candidate.label === 1 ? positiveWeight : negativeWeight;
      const error = (candidate.label - prediction) * classWeight;
      for (const [name, value] of Object.entries(candidate.features)) {
        weights[name] = (weights[name] ?? 0) * (1 - learningRate * l2) + learningRate * error * value;
      }
    }
  }

  const correct = candidates.filter((candidate) => {
    const prediction = sigmoid(scoreFeatures(weights, candidate.features)) >= 0.5 ? 1 : 0;
    return prediction === candidate.label;
  }).length;

  return {
    model_type: "weighted-logistic-answer-span-selector",
    epochs,
    learningRate,
    l2,
    candidateCount: candidates.length,
    positiveCandidates: positiveCount,
    negativeCandidates: negativeCount,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    weights,
  };
}

function compressEvidenceText(example, evidence, compressor) {
  const candidates = candidateAnswerSpans(evidence.text);
  if (!candidates.length) return "";
  const questionTokens = new Set(contentTokens(example.input.question));
  const maxChars = numberArg(args["compress-max-chars"], 220);
  const scored = candidates.map((span, index) => {
    const tokens = contentTokens(span);
    const salience = tokens.length
      ? mean(tokens.map((token) => {
        const stats = compressor.tokenStats[token] ?? { positive: 0, negative: 0 };
        return (stats.positive + 1) / (stats.positive + stats.negative + 2);
      }))
      : 0;
    const overlap = tokens.filter((token) => questionTokens.has(token)).length / Math.max(1, questionTokens.size);
    const numberBoost = /\d/.test(span) ? 0.15 : 0;
    const resultBoost = /result|accuracy|score|dataset|baseline|model|table|figure|human|annotat/i.test(span) ? 0.08 : 0;
    const lengthPenalty = Math.max(0, tokens.length - 28) * 0.012;
    return {
      span,
      index,
      score: salience + overlap + numberBoost + resultBoost - lengthPenalty,
    };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  return truncateAtWord(scored[0].span, maxChars);
}

function selectAnswerSpan(example, evidence, model) {
  const spans = candidateAnswerSpans(evidence.text);
  if (!spans.length) return "";
  const maxChars = numberArg(args["span-max-chars"], 220);
  const scored = spans
    .map((span, index) => ({
      span,
      index,
      probability: sigmoid(scoreFeatures(model.weights, spanFeatures(example, evidence, span))),
    }))
    .sort((a, b) => b.probability - a.probability || a.index - b.index);
  return truncateAtWord(scored[0].span, maxChars);
}

function spanFeatures(example, evidence, span) {
  const questionTokens = contentTokens(example.input.question);
  const spanTokens = contentTokens(span);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section);
  const questionTokenSet = new Set(questionTokens);
  const spanTokenSet = new Set(spanTokens);
  const overlapCount = [...questionTokenSet].filter((token) => spanTokenSet.has(token)).length;
  const questionHasNumberIntent = /\b(how many|how much|how big|number|size|large|results?|score|accuracy|percentage|percent|count)\b/i.test(example.input.question);
  const yesNoQuestion = /^(do|does|did|is|are|was|were|can|could|will|would|has|have)\b/i.test(example.input.question);
  const spanHasNumber = /\d/.test(span);
  const spanLooksMetric = /result|accuracy|score|baseline|dataset|table|figure|percent|percentage|human|annotat/i.test(span);
  const startsWithAnswerCue = /^(yes|no|we|our|the|this|these)\b/i.test(span.trim());

  const features = {
    bias: 1,
    question_jaccard: jaccard(questionTokens, spanTokens),
    question_coverage: questionTokens.length ? overlapCount / questionTokenSet.size : 0,
    evidence_coverage: evidenceTokens.length ? spanTokens.length / evidenceTokens.length : 0,
    section_jaccard: jaccard(questionTokens, sectionTokens),
    token_length: Math.min(1, spanTokens.length / 48),
    short_span: spanTokens.length <= 18 ? 1 : 0,
    medium_span: spanTokens.length > 18 && spanTokens.length <= 42 ? 1 : 0,
    long_span: spanTokens.length > 42 ? 1 : 0,
    number_match: questionHasNumberIntent && spanHasNumber ? 1 : 0,
    number_without_intent: !questionHasNumberIntent && spanHasNumber ? 1 : 0,
    yes_no_question: yesNoQuestion ? 1 : 0,
    yes_no_answer_cue: yesNoQuestion && /^(yes|no)\b/i.test(span.trim()) ? 1 : 0,
    metric_like: spanLooksMetric ? 1 : 0,
    starts_with_answer_cue: startsWithAnswerCue ? 1 : 0,
  };

  for (const token of questionTokens.slice(0, 24)) {
    if (spanTokenSet.has(token)) features[`span_qtok:${token}`] = 1;
  }
  return features;
}

function evidenceFeatures(example, evidence) {
  const questionTokens = contentTokens(example.input.question);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section);
  const titleTokens = contentTokens(example.input.document_metadata?.title ?? "");
  const abstractTokens = contentTokens(example.input.document_metadata?.abstract ?? "");
  const questionTokenSet = new Set(questionTokens);
  const evidenceTokenSet = new Set(evidenceTokens);
  const overlapTokens = evidenceTokens.filter((token) => questionTokenSet.has(token));
  const questionHasNumberIntent = /\b(how many|how much|how big|number|size|large|results?|score|accuracy|percentage)\b/i.test(example.input.question);
  const evidenceHasNumber = /\d/.test(evidence.text);
  const tableLike = /FLOAT SELECTED|Table|Figure|accuracy|score|result/i.test(evidence.text);

  const features = {
    bias: 1,
    lexical_jaccard: jaccard(questionTokens, evidenceTokens),
    lexical_overlap_count: Math.min(8, new Set(overlapTokens).size) / 8,
    question_token_coverage: questionTokens.length ? new Set(overlapTokens).size / new Set(questionTokens).size : 0,
    evidence_token_coverage: evidenceTokens.length ? new Set(overlapTokens).size / evidenceTokenSet.size : 0,
    title_overlap: jaccard(questionTokens, titleTokens),
    abstract_overlap: jaccard(questionTokens, abstractTokens),
    section_overlap: jaccard(questionTokens, sectionTokens),
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 1)),
    log_length: Math.min(1, Math.log1p(evidenceTokens.length) / 7),
    number_match: questionHasNumberIntent && evidenceHasNumber ? 1 : 0,
    table_like: tableLike ? 1 : 0,
  };

  for (const token of questionTokens.slice(0, 24)) {
    if (evidenceTokenSet.has(token)) features[`qtok:${token}`] = 1;
  }
  for (const token of sectionTokens.slice(0, 8)) {
    features[`section:${token}`] = 1;
  }

  return features;
}

function candidateAnswerSpans(text) {
  const sentences = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const spans = [];
  for (const sentence of sentences) {
    spans.push(sentence);
    if (sentence.length > 160) {
      for (const clause of sentence.split(/\s*[,;:]\s*/).map((part) => part.trim()).filter(Boolean)) {
        if (contentTokens(clause).length >= 3) spans.push(clause);
      }
    }
  }
  const seen = new Set();
  return spans.filter((span) => {
    const key = span.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return contentTokens(span).length >= 3;
  });
}

function truncateAtWord(value, maxChars) {
  const text = String(value).trim();
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars + 1);
  const boundary = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, boundary > 80 ? boundary : maxChars).trim()}...`;
}

function sufficiencyFeatures(example, selected) {
  const probabilities = selected.map((item) => item.probability);
  const evidenceItems = selected.map((item) => item.evidence);
  const questionTokens = contentTokens(example.input.question);
  const evidenceText = evidenceItems.map((evidence) => evidence.text).join(" ");
  const evidenceTokens = contentTokens(evidenceText);
  const citationCount = evidenceItems.length;
  const maxProbability = probabilities.length ? Math.max(...probabilities) : 0;
  const meanProbability = mean(probabilities);
  const minProbability = probabilities.length ? Math.min(...probabilities) : 0;
  const questionTokenSet = new Set(questionTokens);
  const evidenceTokenSet = new Set(evidenceTokens);
  const overlapCount = [...questionTokenSet].filter((token) => evidenceTokenSet.has(token)).length;
  const anyTableLike = evidenceItems.some((evidence) => /FLOAT SELECTED|Table|Figure|accuracy|score|result/i.test(evidence.text));
  const questionHasNumberIntent = /\b(how many|how much|how big|number|size|large|results?|score|accuracy|percentage)\b/i.test(example.input.question);
  const evidenceHasNumber = /\d/.test(evidenceText);

  return {
    bias: 1,
    selected_count: citationCount / 2,
    max_selector_probability: maxProbability,
    mean_selector_probability: meanProbability,
    min_selector_probability: minProbability,
    probability_gap: probabilities.length > 1 ? probabilities[0] - probabilities[1] : probabilities[0] ?? 0,
    selected_question_jaccard: jaccard(questionTokens, evidenceTokens),
    selected_question_coverage: questionTokens.length ? overlapCount / questionTokenSet.size : 0,
    selected_token_length: Math.min(1, Math.log1p(evidenceTokens.length) / 8),
    selected_has_table_like: anyTableLike ? 1 : 0,
    selected_number_match: questionHasNumberIntent && evidenceHasNumber ? 1 : 0,
    question_number_without_evidence_number: questionHasNumberIntent && !evidenceHasNumber ? 1 : 0,
  };
}

function scoreFeatures(weights, features) {
  let score = 0;
  for (const [name, value] of Object.entries(features)) {
    score += (weights[name] ?? 0) * value;
  }
  return score;
}

function sigmoid(value) {
  if (value < -30) return 0;
  if (value > 30) return 1;
  return 1 / (1 + Math.exp(-value));
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
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function renderReport(run) {
  const metricRows = run.systems.map((system) => {
    const metric = system.metrics;
    return `| ${system.system} | ${pct(metric.answer_type_accuracy)} | ${pct(metric.citation_precision)} | ${pct(metric.citation_recall)} | ${pct(metric.answer_token_f1)} | ${pct(metric.abstention_accuracy)} | ${pct(metric.abstention_rate)} |`;
  }).join("\n");

  const decision = decide(run);
  return `# Grounded QA Distillation Run

Run: \`${run.run_id}\`

Split: \`${run.split}\`

Train split: \`${run.train_split}\`

Examples: ${run.examples}

## Systems

- \`retrieval_rank_1\`: cheapest scaffold; cites the first retrieved evidence item.
- \`lexical_overlap_t*\`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: ${run.threshold_grid.join(", ")}.
- \`learned_selector_*\`: logistic evidence selector trained on \`train.jsonl\` teacher roles. Training accuracy: ${pct(run.learned_selector.training_accuracy)} over ${run.learned_selector.positive_candidates} positive and ${run.learned_selector.negative_candidates} negative candidates.
- \`suff_calibrated_*\`: learned selector plus separate sufficiency calibrator. Training accuracy: ${pct(run.sufficiency_calibrator.training_accuracy)} over ${run.sufficiency_calibrator.positive_examples} answerable and ${run.sufficiency_calibrator.negative_examples} insufficient examples.
- \`suff_compressed_*\`: sufficiency-calibrated selector plus phrase-ranked token-salience answer compressor. Compressor vocabulary: ${run.answer_compressor.vocabulary_size} tokens.
- \`suff_span_*\`: sufficiency-calibrated selector plus supervised logistic answer-span selector. Training accuracy: ${pct(run.span_answerer.training_accuracy)} over ${run.span_answerer.positive_candidates} positive and ${run.span_answerer.negative_candidates} negative span candidates.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${metricRows}

## Decision

${decision}
`;
}

function decide(run) {
  const rankOne = run.systems.find((system) => system.system === "retrieval_rank_1")?.metrics;
  const lexicalSystems = run.systems.filter((system) => system.system.startsWith("lexical_overlap_"));
  const learnedSystems = run.systems.filter((system) => system.system.startsWith("learned_selector_"));
  const sufficiencySystems = run.systems.filter((system) => system.system.startsWith("suff_calibrated_"));
  const compressedSystems = run.systems.filter((system) => system.system.startsWith("suff_compressed_"));
  const spanSystems = run.systems.filter((system) => system.system.startsWith("suff_span_"));
  const bestLexical = lexicalSystems
    .map((system) => ({ ...system, score: system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  const bestLearned = learnedSystems
    .map((system) => ({ ...system, score: system.metrics.citation_precision + system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  const bestSufficiency = sufficiencySystems
    .map((system) => ({ ...system, score: system.metrics.citation_precision + system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  const bestCompressed = compressedSystems
    .map((system) => ({ ...system, score: system.metrics.citation_precision + system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  const bestSpan = spanSystems
    .map((system) => ({ ...system, score: system.metrics.citation_precision + system.metrics.citation_recall + system.metrics.answer_token_f1 + system.metrics.abstention_accuracy }))
    .sort((a, b) => b.score - a.score)[0];
  if (!rankOne || !bestLexical || !bestLearned || !bestSufficiency || !bestCompressed || !bestSpan) return "No decision: missing system metrics.";
  if (bestSpan.metrics.answer_token_f1 > bestSufficiency.metrics.answer_token_f1 && bestSpan.metrics.citation_recall >= bestSufficiency.metrics.citation_recall) {
    return `Promote \`${bestSpan.system}\` as the current answer-synthesis scaffold: supervised span selection improves answer F1 without losing citation recall.`;
  }
  if (bestCompressed.metrics.answer_token_f1 > bestSufficiency.metrics.answer_token_f1 && bestCompressed.metrics.citation_recall >= bestSufficiency.metrics.citation_recall) {
    return `Promote \`${bestCompressed.system}\` as the current constrained student: compression improves answer F1 without losing citation recall.`;
  }
  if (bestSufficiency.metrics.abstention_accuracy >= bestLearned.metrics.abstention_accuracy && bestSufficiency.metrics.citation_precision >= bestLearned.metrics.citation_precision && bestCompressed.metrics.answer_token_f1 <= bestSufficiency.metrics.answer_token_f1) {
    return `Keep \`${bestSufficiency.system}\` as the current calibrated student; \`${bestCompressed.system}\` is a negative compression ablation because it does not improve answer F1.`;
  }
  if (bestSufficiency.metrics.abstention_accuracy >= bestLearned.metrics.abstention_accuracy && bestSufficiency.metrics.citation_precision >= bestLearned.metrics.citation_precision) {
    return `Promote \`${bestSufficiency.system}\` as the current calibrated student if it preserves recall on test; it separates evidence selection from sufficiency instead of using selector score as a proxy.`;
  }
  if (bestLearned.metrics.citation_precision >= bestLexical.metrics.citation_precision && bestLearned.metrics.answer_token_f1 >= bestLexical.metrics.answer_token_f1) {
    return `Promote \`${bestLearned.system}\` as the current cheap student baseline. It matches or beats the lexical family on citation precision and answer compression, but still needs a generative student and entailment judge before paper claims.`;
  }
  if (rankOne.citation_precision > bestLexical.metrics.citation_precision && rankOne.answer_token_f1 >= bestLexical.metrics.answer_token_f1) {
    return "Keep retrieval rank as a strong baseline, but it is not paper-sufficient because it depends on retrieved-evidence ordering rather than learning answer synthesis.";
  }
  return `Keep the learned selector as an ablation, not yet the main student. Best lexical variant is \`${bestLexical.system}\`; best learned variant is \`${bestLearned.system}\`.`;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatThreshold(value) {
  return String(value).replace(".", "p");
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

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}
