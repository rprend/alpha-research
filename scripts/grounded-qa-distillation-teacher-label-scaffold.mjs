import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const exportDir = path.join(experimentDir, "exports");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-repair-temporal-test-0-80-v1";
const evalOffset = numberArg(args["eval-offset"], 80, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], Number.POSITIVE_INFINITY);
const runId = args["run-id"] ?? `teacher-label-scaffold-${split}-${evalOffset}-heldout-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const labels = await readJsonl(path.join(exportDir, `${teacherLabelPrefix}.sft.jsonl`));
const trainingExamples = labels.map(toTrainingExample);
const evidenceSelector = trainEvidenceSelector(trainingExamples);
const sufficiencyModel = trainSufficiencyModel(trainingExamples, evidenceSelector);
const spanModel = trainSpanSelector(trainingExamples);
const thresholdGrid = [0.15, 0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85];
const trainThresholds = thresholdGrid.map((threshold) => evaluate(trainingExamples, threshold, { splitName: "train" }));
const selectedThreshold = chooseThreshold(trainThresholds).threshold;
const evalRows = references.slice(evalOffset, Number.isFinite(evalLimit) ? evalOffset + evalLimit : undefined);
const heldout = evaluate(evalRows, selectedThreshold, { splitName: "heldout" });

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  teacher_label_prefix: teacherLabelPrefix,
  eval_offset: evalOffset,
  eval_examples: evalRows.length,
  training: {
    accepted_teacher_labels: labels.length,
    answer_labels: trainingExamples.filter((row) => row.output.answer_type === "grounded_answer").length,
    abstention_labels: trainingExamples.filter((row) => row.output.answer_type === "abstain").length,
  },
  evidence_selector: summarizeEvidenceSelector(evidenceSelector),
  sufficiency_model: summarizeLogistic(sufficiencyModel),
  span_model: summarizeLogistic(spanModel),
  selected_threshold: selectedThreshold,
  threshold_grid: trainThresholds.map(({ predictions: _predictions, ...row }) => row),
  heldout: heldout.metrics,
  cost: {
    llm_calls: 0,
    estimated_inference_cost_usd: 0,
    note: "Local teacher-label scaffold. No hosted model calls.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), heldout.predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "teacher-label-scaffold-model.json"), `${JSON.stringify({
  evidence_selector: evidenceSelector,
  sufficiency_model: sufficiencyModel,
  span_model: spanModel,
}, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  heldout: result.heldout,
}, null, 2));

function toTrainingExample(row) {
  return {
    example_id: row.example_id,
    input: row.input,
    output: row.teacher_output,
    teacher_trace: row.teacher_trace?.original_teacher_trace ?? row.teacher_trace,
  };
}

function evaluate(rows, threshold, { splitName }) {
  const predictions = rows.map((row) => {
    const prediction = predict(row, threshold);
    const reference = normalizeReference(row);
    const referenceCitations = new Set(reference.citations);
    const citedGold = prediction.citations.filter((id) => evidenceRoles(row)[id] === "gold_evidence").length;
    const answerable = reference.answer_type !== "abstain";
    const abstained = prediction.answer_type === "abstain";
    return {
      example_id: row.example_id,
      system: `teacher_label_scaffold_${splitName}`,
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
        inline_citation_rate: prediction.answer_type === "grounded_answer"
          ? (prediction.citations.length ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / prediction.citations.length : 0)
          : null,
      },
    };
  });
  return {
    threshold,
    predictions,
    metrics: summarizePredictions(predictions),
  };
}

function predict(example, threshold) {
  const ranked = rankEvidence(example, evidenceSelector);
  const top = ranked.slice(0, 2);
  const sufficiencyProbability = sigmoid(scoreFeatures(sufficiencyModel.weights, sufficiencyFeatures(example, top)));
  if (sufficiencyProbability < threshold) {
    return abstain(`teacher-label sufficiency probability ${sufficiencyProbability.toFixed(3)} below threshold ${threshold}`);
  }
  const selected = top.filter((item, index) => index === 0 || item.probability >= Math.max(0.25, top[0].probability * 0.72));
  if (!selected.length) return abstain("teacher-label evidence selector found no evidence");
  const parts = selected.map((item) => {
    const span = selectSpan(example, item.evidence, spanModel);
    return `${span || firstUsefulSentence(item.evidence.text)} [${item.evidence.evidence_id}]`;
  });
  return {
    answer_type: "grounded_answer",
    answer: parts.join(" "),
    citations: selected.map((item) => item.evidence.evidence_id),
    claim_table: parts.map((text, index) => ({
      claim: stripCitations(text),
      support: "selected_by_teacher_label_scaffold",
      citations: [selected[index].evidence.evidence_id],
    })),
    abstention_reason: null,
    rationale: `teacher-label scaffold sufficiency ${sufficiencyProbability.toFixed(3)} threshold ${threshold}`,
  };
}

function trainEvidenceSelector(rows) {
  const candidates = [];
  for (const row of rows) {
    const cited = new Set((row.output.citations ?? []).map((id) => typeof id === "string" ? id : id.evidence_id));
    for (const evidence of row.input.compact_retrieved_evidence_pack) {
      candidates.push({
        features: evidenceFeatures(row, evidence),
        label: row.output.answer_type === "grounded_answer" && cited.has(evidence.evidence_id) ? 1 : 0,
      });
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args.epochs, 90),
    learningRate: Number(args["learning-rate"] ?? 0.16),
    l2: Number(args.l2 ?? 0.0008),
  });
}

function trainSufficiencyModel(rows, selector) {
  const candidates = rows.map((row) => {
    const ranked = rankEvidence(row, selector).slice(0, 2);
    return {
      features: sufficiencyFeatures(row, ranked),
      label: row.output.answer_type === "grounded_answer" ? 1 : 0,
    };
  });
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["sufficiency-epochs"], 100),
    learningRate: Number(args["sufficiency-learning-rate"] ?? 0.14),
    l2: Number(args["sufficiency-l2"] ?? 0.0008),
  });
}

function trainSpanSelector(rows) {
  const candidates = [];
  for (const row of rows) {
    if (row.output.answer_type !== "grounded_answer") continue;
    const cited = new Set(row.output.citations ?? []);
    for (const evidence of row.input.compact_retrieved_evidence_pack) {
      if (!cited.has(evidence.evidence_id)) continue;
      const spans = candidateAnswerSpans(evidence.text);
      if (!spans.length) continue;
      const scored = spans.map((span) => ({ span, score: tokenF1(span, row.output.answer) }));
      const best = Math.max(...scored.map((item) => item.score));
      for (const item of scored) {
        candidates.push({
          features: spanFeatures(row, evidence, item.span),
          label: best > 0 && item.score >= Math.max(0.16, best * 0.68) ? 1 : 0,
        });
      }
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["span-epochs"], 90),
    learningRate: Number(args["span-learning-rate"] ?? 0.12),
    l2: Number(args["span-l2"] ?? 0.0008),
  });
}

function trainWeightedLogistic(candidates, { epochs, learningRate, l2 }) {
  const weights = {};
  const positive = candidates.filter((row) => row.label === 1).length;
  const negative = candidates.length - positive;
  const positiveWeight = positive ? candidates.length / (2 * positive) : 1;
  const negativeWeight = negative ? candidates.length / (2 * negative) : 1;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const candidate of candidates) {
      const predicted = sigmoid(scoreFeatures(weights, candidate.features));
      const classWeight = candidate.label === 1 ? positiveWeight : negativeWeight;
      const error = (candidate.label - predicted) * classWeight;
      for (const [name, value] of Object.entries(candidate.features)) {
        weights[name] = (weights[name] ?? 0) * (1 - learningRate * l2) + learningRate * error * value;
      }
    }
  }
  const correct = candidates.filter((candidate) => (sigmoid(scoreFeatures(weights, candidate.features)) >= 0.5 ? 1 : 0) === candidate.label).length;
  return {
    model_type: "teacher-label-weighted-logistic",
    epochs,
    learningRate,
    l2,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    positiveCandidates: positive,
    negativeCandidates: negative,
    weights,
  };
}

function chooseThreshold(results) {
  return [...results].sort((a, b) => {
    const aScore = a.metrics.answer_type_accuracy + a.metrics.citation_precision + a.metrics.answer_token_f1;
    const bScore = b.metrics.answer_type_accuracy + b.metrics.citation_precision + b.metrics.answer_token_f1;
    return bScore - aScore || b.metrics.citation_recall - a.metrics.citation_recall;
  })[0];
}

function summarizePredictions(predictions) {
  return {
    examples: predictions.length,
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(predictions.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(predictions.map((row) => row.scores.citation_precision)),
    citation_recall: mean(predictions.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(predictions.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(predictions.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(predictions.map((row) => row.scores.inline_citation_rate)),
  };
}

function rankEvidence(example, model) {
  return example.input.compact_retrieved_evidence_pack
    .map((evidence) => ({
      evidence,
      probability: sigmoid(scoreFeatures(model.weights, evidenceFeatures(example, evidence))),
    }))
    .sort((a, b) => b.probability - a.probability || a.evidence.retrieval_rank - b.evidence.retrieval_rank);
}

function selectSpan(example, evidence, model) {
  const spans = candidateAnswerSpans(evidence.text);
  if (!spans.length) return "";
  const maxChars = numberArg(args["span-max-chars"], 240);
  const scored = spans
    .map((span, index) => ({ span, index, probability: sigmoid(scoreFeatures(model.weights, spanFeatures(example, evidence, span))) }))
    .sort((a, b) => b.probability - a.probability || a.index - b.index);
  return truncateAtWord(scored[0].span, maxChars);
}

function evidenceFeatures(example, evidence) {
  const questionTokens = contentTokens(example.input.question);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section);
  const titleTokens = contentTokens(example.input.document_metadata?.title ?? "");
  const questionTokenSet = new Set(questionTokens);
  const evidenceTokenSet = new Set(evidenceTokens);
  const overlapTokens = evidenceTokens.filter((token) => questionTokenSet.has(token));
  const questionHasNumberIntent = /\b(how many|how much|how big|number|size|large|results?|score|accuracy|percentage|percent|count)\b/i.test(example.input.question);
  const evidenceHasNumber = /\d/.test(evidence.text);
  const tableLike = /FLOAT SELECTED|Table|Figure|accuracy|score|result|dataset|baseline|human|annotat/i.test(evidence.text);
  const features = {
    bias: 1,
    lexical_jaccard: jaccard(questionTokens, evidenceTokens),
    lexical_overlap_count: Math.min(8, new Set(overlapTokens).size) / 8,
    question_token_coverage: questionTokens.length ? new Set(overlapTokens).size / new Set(questionTokens).size : 0,
    evidence_token_coverage: evidenceTokens.length ? new Set(overlapTokens).size / evidenceTokenSet.size : 0,
    title_overlap: jaccard(questionTokens, titleTokens),
    section_overlap: jaccard(questionTokens, sectionTokens),
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 1)),
    log_length: Math.min(1, Math.log1p(evidenceTokens.length) / 7),
    number_match: questionHasNumberIntent && evidenceHasNumber ? 1 : 0,
    table_like: tableLike ? 1 : 0,
  };
  for (const token of questionTokens.slice(0, 24)) {
    if (evidenceTokenSet.has(token)) features[`qtok:${token}`] = 1;
  }
  for (const token of sectionTokens.slice(0, 8)) features[`section:${token}`] = 1;
  return features;
}

function sufficiencyFeatures(example, rankedEvidence) {
  const probabilities = rankedEvidence.map((item) => item.probability);
  const evidence = rankedEvidence.map((item) => item.evidence);
  const questionTokens = contentTokens(example.input.question);
  const mergedEvidenceTokens = contentTokens(evidence.map((item) => item.text).join(" "));
  return {
    bias: 1,
    top_probability: probabilities[0] ?? 0,
    second_probability: probabilities[1] ?? 0,
    probability_gap: (probabilities[0] ?? 0) - (probabilities[1] ?? 0),
    mean_probability: mean(probabilities),
    selected_count: rankedEvidence.length / 2,
    merged_question_jaccard: jaccard(questionTokens, mergedEvidenceTokens),
    has_number_match: /\d/.test(evidence.map((item) => item.text).join(" ")) && /\b(how many|number|score|accuracy|percent|percentage|count)\b/i.test(example.input.question) ? 1 : 0,
    counterfactual_flag: example.input.document_metadata?.counterfactual ? 1 : 0,
  };
}

function spanFeatures(example, evidence, span) {
  const questionTokens = contentTokens(example.input.question);
  const spanTokens = contentTokens(span);
  const questionTokenSet = new Set(questionTokens);
  const spanTokenSet = new Set(spanTokens);
  const overlapCount = [...questionTokenSet].filter((token) => spanTokenSet.has(token)).length;
  const questionHasNumberIntent = /\b(how many|how much|number|size|results?|score|accuracy|percentage|percent|count)\b/i.test(example.input.question);
  const yesNoQuestion = /^(do|does|did|is|are|was|were|can|could|will|would|has|have)\b/i.test(example.input.question);
  return {
    bias: 1,
    question_jaccard: jaccard(questionTokens, spanTokens),
    question_coverage: questionTokens.length ? overlapCount / questionTokenSet.size : 0,
    section_jaccard: jaccard(questionTokens, contentTokens(evidence.section)),
    token_length: Math.min(1, spanTokens.length / 48),
    short_span: spanTokens.length <= 18 ? 1 : 0,
    medium_span: spanTokens.length > 18 && spanTokens.length <= 42 ? 1 : 0,
    number_match: questionHasNumberIntent && /\d/.test(span) ? 1 : 0,
    yes_no_answer_cue: yesNoQuestion && /^(yes|no)\b/i.test(span.trim()) ? 1 : 0,
    metric_like: /result|accuracy|score|baseline|dataset|table|figure|percent|percentage|human|annotat/i.test(span) ? 1 : 0,
  };
}

function normalizeReference(example) {
  const output = example.output ?? example.teacher_output;
  return {
    answer_type: output.answer_type,
    answer: stripCitations(output.answer),
    citations: (output.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id),
  };
}

function evidenceRoles(example) {
  return example.teacher_trace?.evidence_roles ?? example.teacher_trace?.original_teacher_trace?.evidence_roles ?? {};
}

function candidateAnswerSpans(text) {
  const sentences = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const spans = [];
  for (const sentence of sentences) {
    spans.push(sentence);
    const clauses = sentence.split(/;\s+|,\s+(?=(?:which|where|who|and|but|with|show|showing|using|based)\b)/i)
      .map((part) => part.trim())
      .filter((part) => contentTokens(part).length >= 5);
    spans.push(...clauses);
  }
  return [...new Set(spans)].filter(Boolean);
}

function firstUsefulSentence(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const selected = parts.find((part) => contentTokens(part).length >= 5) ?? parts[0] ?? String(text).trim();
  return truncateAtWord(selected, 420);
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "The evidence pack does not contain enough support to answer this question.",
    citations: [],
    claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
    abstention_reason: reason,
  };
}

function renderReport(result) {
  return `# Teacher-Label Scaffold V1

## Setup

- Teacher label packet: \`${result.teacher_label_prefix}\`
- Accepted teacher labels: ${result.training.accepted_teacher_labels}
- Answer labels: ${result.training.answer_labels}
- Abstention labels: ${result.training.abstention_labels}
- Held-out slice: \`${result.split}\` examples ${result.eval_offset + 1}-${result.eval_offset + result.eval_examples}
- Selected sufficiency threshold: ${result.selected_threshold}
- LLM calls: ${result.cost.llm_calls}

## Held-Out Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Teacher-label scaffold | ${result.heldout.answered} | ${result.heldout.abstained} | ${pct(result.heldout.answer_type_accuracy)} | ${pct(result.heldout.citation_precision)} | ${pct(result.heldout.citation_recall)} | ${pct(result.heldout.answer_token_f1)} | ${pct(result.heldout.inline_citation_rate)} |

This scaffold is trained only from the judge-filtered repaired-teacher labels. It is a true amortized zero-LLM policy, but it can only extract spans from retrieved evidence and does not have generative paraphrasing ability.
`;
}

function summarizeEvidenceSelector(model) {
  return {
    model_type: model.model_type,
    training_accuracy: model.trainingAccuracy,
    positive_candidates: model.positiveCandidates,
    negative_candidates: model.negativeCandidates,
    feature_count: Object.keys(model.weights).length,
  };
}

function summarizeLogistic(model) {
  return {
    model_type: model.model_type,
    training_accuracy: model.trainingAccuracy,
    positive_candidates: model.positiveCandidates,
    negative_candidates: model.negativeCandidates,
    feature_count: Object.keys(model.weights).length,
  };
}

function scoreFeatures(weights, values) {
  return Object.entries(values).reduce((total, [key, value]) => total + (weights[key] ?? 0) * value, 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
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

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function truncateAtWord(value, maxChars) {
  const text = String(value).trim();
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return `${truncated.slice(0, Math.max(0, truncated.lastIndexOf(" "))).trim()}...`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
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
