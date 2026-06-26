import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sftPrepRunId = args["sft-prep-run-id"] ?? "hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1";
const runId = args["run-id"] ?? `temporal-span-scaffold-${sftPrepRunId}`;
const outputDir = path.join(runDir, runId);
const packetDir = path.join(runDir, sftPrepRunId);
const thresholdGrid = [0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const packet = JSON.parse(await fs.readFile(path.join(packetDir, "result.json"), "utf8"));
const trainRows = (await readJsonl(path.join(packetDir, "train.hf-sft.jsonl"))).map(toLabeledRow);
const validationRows = (await readJsonl(path.join(packetDir, "validation.hf-sft.jsonl"))).map(toLabeledRow);
const evalRows = (await readJsonl(path.join(packetDir, "eval_prompts.jsonl"))).map(toEvalRow);

const spanModel = trainSpanModel(trainRows);
const sufficiencyModel = trainSufficiencyModel(trainRows, spanModel);
const validationSweeps = thresholdGrid.map((threshold) => evaluate(validationRows, threshold, "validation"));
const selected = chooseThreshold(validationSweeps);
const evalResult = evaluate(evalRows, selected.threshold, "eval");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  sft_prep_run_id: sftPrepRunId,
  packet_summary: {
    teacher_label_prefix: packet.teacher_label_prefix,
    train_windows: packet.train_windows,
    eval_window: packet.eval_window,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    eval_prompts: evalRows.length,
    train_eval_paper_overlap: packet.leakage_checks?.train_eval_paper_overlap,
    validation_eval_paper_overlap: packet.leakage_checks?.validation_eval_paper_overlap,
  },
  method: {
    type: "zero_llm_temporal_answer_span_scaffold",
    training: "Train a cited-evidence sentence/span selector from accepted temporal SFT labels, plus a sufficiency model for abstention.",
    prediction: "Abstain below selected sufficiency threshold; otherwise emit the selected evidence span with one inline citation.",
    selected_threshold: selected.threshold,
  },
  models: {
    span_selector: summarizeModel(spanModel),
    sufficiency: summarizeModel(sufficiencyModel),
  },
  validation_threshold_sweep: validationSweeps.map(({ predictions: _predictions, ...row }) => row),
  validation: selected.metrics,
  eval: evalResult.metrics,
  cost: {
    llm_calls: 0,
    estimated_inference_cost_usd: 0,
    note: "Local temporal span scaffold. No hosted model calls.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), evalResult.predictions);
await fs.writeFile(path.join(outputDir, "temporal-span-scaffold-model.json"), `${JSON.stringify({ span_selector: spanModel, sufficiency: sufficiencyModel }, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  selected_threshold: selected.threshold,
  validation: selected.metrics,
  eval: evalResult.metrics,
}, null, 2));

function toLabeledRow(row) {
  const assistant = JSON.parse(row.messages.at(-1).content);
  return {
    example_id: row.example_id,
    window: row.window,
    input: row.input,
    output: normalizeOutput(assistant),
    reference: normalizeOutput(assistant),
  };
}

function toEvalRow(row) {
  return {
    example_id: row.example_id,
    window: row.window,
    input: row.input,
    output: normalizeOutput(row.reference),
    reference: normalizeOutput(row.reference),
  };
}

function normalizeOutput(output) {
  const answerType = output?.answer_type === "grounded_answer" ? "grounded_answer" : "abstain";
  return {
    answer_type: answerType,
    answer: String(output?.answer ?? ""),
    citations: answerType === "grounded_answer"
      ? (output?.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean)
      : [],
    claim_table: Array.isArray(output?.claim_table) ? output.claim_table : [],
    abstention_reason: output?.abstention_reason ?? null,
  };
}

function trainSpanModel(rows) {
  const candidates = [];
  for (const row of rows.filter((item) => item.output.answer_type === "grounded_answer")) {
    const cited = new Set(row.output.citations);
    const spans = spanCandidates(row);
    const positive = bestGoldSpan(row, spans, cited);
    for (const span of spans) {
      candidates.push({
        features: spanFeatures(row, span),
        label: positive && span.key === positive.key ? 1 : 0,
      });
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["span-epochs"], 120),
    learningRate: Number(args["span-learning-rate"] ?? 0.12),
    l2: Number(args["span-l2"] ?? 0.0006),
  });
}

function trainSufficiencyModel(rows, spanModel) {
  const candidates = rows.map((row) => {
    const ranked = rankSpans(row, spanModel).slice(0, 3);
    return {
      features: sufficiencyFeatures(row, ranked),
      label: row.output.answer_type === "grounded_answer" ? 1 : 0,
    };
  });
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["sufficiency-epochs"], 100),
    learningRate: Number(args["sufficiency-learning-rate"] ?? 0.12),
    l2: Number(args["sufficiency-l2"] ?? 0.0006),
  });
}

function evaluate(rows, threshold, splitName) {
  const predictions = rows.map((row) => {
    const prediction = predict(row, threshold);
    const reference = row.reference;
    const referenceCitations = new Set(reference.citations);
    const answerable = reference.answer_type === "grounded_answer";
    const answered = prediction.answer_type === "grounded_answer";
    return {
      example_id: row.example_id,
      window: row.window,
      system: `temporal_span_scaffold_${splitName}`,
      prediction,
      reference,
      scores: {
        answer_type_correct: prediction.answer_type === reference.answer_type,
        citation_precision: answered && prediction.citations.length
          ? prediction.citations.filter((id) => referenceCitations.has(id)).length / prediction.citations.length
          : null,
        citation_recall: answerable && reference.citations.length
          ? prediction.citations.filter((id) => referenceCitations.has(id)).length / reference.citations.length
          : null,
        answer_token_f1: answerable ? (answered ? tokenF1(prediction.answer, reference.answer) : 0) : null,
        abstention_correct: answerable ? !answered : !answered,
        inline_citation_rate: answered
          ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / Math.max(1, prediction.citations.length)
          : null,
      },
    };
  });
  return { threshold, predictions, metrics: summarizePredictions(predictions) };
}

function predict(row, threshold) {
  const ranked = rankSpans(row, spanModel).slice(0, 3);
  const sufficiency = sigmoid(scoreFeatures(sufficiencyModel.weights, sufficiencyFeatures(row, ranked)));
  if (sufficiency < threshold || !ranked.length) {
    return {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "temporal_span_scaffold", citations: [] }],
      abstention_reason: `Sufficiency ${sufficiency.toFixed(3)} below threshold ${threshold}.`,
    };
  }
  const selected = ranked[0].span;
  const answer = `${truncateAtWord(selected.text, 320)} [${selected.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [selected.evidence_id],
    claim_table: [{ claim: stripCitations(selected.text), support: "selected_by_temporal_span_scaffold", citations: [selected.evidence_id] }],
    abstention_reason: null,
    rationale: `Sufficiency ${sufficiency.toFixed(3)} at threshold ${threshold}; span probability ${ranked[0].probability.toFixed(3)}.`,
  };
}

function bestGoldSpan(row, spans, cited) {
  const citedSpans = spans.filter((span) => cited.has(span.evidence_id));
  const pool = citedSpans.length ? citedSpans : spans;
  return [...pool].sort((a, b) => tokenF1(b.text, row.output.answer) - tokenF1(a.text, row.output.answer))[0] ?? null;
}

function rankSpans(row, model) {
  return spanCandidates(row)
    .map((span) => ({ span, probability: sigmoid(scoreFeatures(model.weights, spanFeatures(row, span))) }))
    .sort((a, b) => b.probability - a.probability || b.span.question_overlap - a.span.question_overlap || a.span.retrieval_rank - b.span.retrieval_rank);
}

function spanCandidates(row) {
  const spans = [];
  for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
    const sentences = splitSentences(evidence.text);
    for (const [index, sentence] of sentences.entries()) {
      const cleaned = sentence.trim();
      if (contentTokens(cleaned).length < 4) continue;
      const questionOverlap = jaccard(contentTokens(row.input.question), contentTokens(cleaned));
      spans.push({
        key: `${evidence.evidence_id}:${index}`,
        evidence_id: evidence.evidence_id,
        retrieval_rank: Number(evidence.retrieval_rank ?? 99),
        section: evidence.section ?? "",
        text: cleaned,
        question_overlap: questionOverlap,
        sentence_index: index,
      });
    }
  }
  return spans;
}

function spanFeatures(row, span) {
  const questionTokens = contentTokens(row.input.question);
  const spanTokens = contentTokens(span.text);
  const sectionTokens = contentTokens(span.section);
  const titleTokens = contentTokens(row.input.document_metadata?.title ?? "");
  const qSet = new Set(questionTokens);
  const sSet = new Set(spanTokens);
  const overlap = [...qSet].filter((token) => sSet.has(token)).length;
  const numberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result|f1|bleu)\b/i.test(row.input.question);
  return {
    bias: 1,
    reciprocal_rank: 1 / Math.max(1, span.retrieval_rank),
    sentence_position: 1 / (1 + span.sentence_index),
    question_jaccard: jaccard(questionTokens, spanTokens),
    question_coverage: qSet.size ? overlap / qSet.size : 0,
    section_overlap: jaccard(questionTokens, sectionTokens),
    title_overlap: jaccard(questionTokens, titleTokens),
    log_span_length: Math.min(1, Math.log1p(spanTokens.length) / 6),
    too_long: spanTokens.length > 60 ? 1 : 0,
    number_match: numberIntent && /\d/.test(span.text) ? 1 : 0,
    table_or_result: /FLOAT SELECTED|table|figure|result|score|accuracy|dataset|baseline|annotat|compare/i.test(span.text) ? 1 : 0,
  };
}

function sufficiencyFeatures(row, ranked) {
  const probs = ranked.map((item) => item.probability);
  const mergedText = ranked.map((item) => item.span.text).join(" ");
  return {
    bias: 1,
    top_probability: probs[0] ?? 0,
    second_probability: probs[1] ?? 0,
    probability_gap: (probs[0] ?? 0) - (probs[1] ?? 0),
    mean_probability: mean(probs),
    top_question_overlap: ranked[0]?.span.question_overlap ?? 0,
    merged_question_jaccard: jaccard(contentTokens(row.input.question), contentTokens(mergedText)),
    counterfactual_flag: row.input.document_metadata?.counterfactual ? 1 : 0,
    has_number: /\d/.test(mergedText) ? 1 : 0,
  };
}

function chooseThreshold(results) {
  return [...results].sort((left, right) => {
    const leftScore = objective(left.metrics);
    const rightScore = objective(right.metrics);
    return rightScore - leftScore || right.metrics.answer_token_f1 - left.metrics.answer_token_f1 || right.metrics.answered - left.metrics.answered;
  })[0];
}

function objective(metrics) {
  return (2 * metrics.answer_type_accuracy) + metrics.citation_precision + metrics.citation_recall + metrics.answer_token_f1 + metrics.inline_citation_rate;
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
    model_type: "weighted_logistic",
    epochs,
    learningRate,
    l2,
    trainingAccuracy: candidates.length ? correct / candidates.length : 0,
    positiveCandidates: positive,
    negativeCandidates: negative,
    weights,
  };
}

function summarizePredictions(predictions) {
  return {
    examples: predictions.length,
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_rate: mean(predictions.map((row) => row.prediction.answer_type === "grounded_answer")),
    answer_type_accuracy: mean(predictions.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(predictions.map((row) => row.scores.citation_precision)),
    citation_recall: mean(predictions.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(predictions.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(predictions.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(predictions.map((row) => row.scores.inline_citation_rate)),
  };
}

function summarizeModel(model) {
  return {
    model_type: model.model_type,
    training_accuracy: model.trainingAccuracy,
    positive_candidates: model.positiveCandidates,
    negative_candidates: model.negativeCandidates,
    feature_count: Object.keys(model.weights).length,
  };
}

function renderReport(result) {
  const sweepRows = result.validation_threshold_sweep.map((row) => (
    `| ${row.threshold} | ${row.metrics.answered} | ${pct(row.metrics.answer_type_accuracy)} | ${pct(row.metrics.citation_precision)} | ${pct(row.metrics.citation_recall)} | ${pct(row.metrics.answer_token_f1)} | ${pct(row.metrics.inline_citation_rate)} |`
  )).join("\n");
  return `# Temporal Span Scaffold

## Purpose

Evaluate a zero-LLM local span-generation scaffold trained from the same leakage-safe temporal SFT packet prepared for Qwen LoRA. This tests whether answer-span supervision improves over the previous top-evidence sentence quote control.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | \`${result.sft_prep_run_id}\` |
| Train windows | \`${result.packet_summary.train_windows.join(", ")}\` |
| Eval window | \`${result.packet_summary.eval_window}\` |
| Train rows | ${result.packet_summary.train_rows} |
| Validation rows | ${result.packet_summary.validation_rows} |
| Eval prompts | ${result.packet_summary.eval_prompts} |
| Selected threshold | ${result.method.selected_threshold} |
| LLM calls | ${result.cost.llm_calls} |

## Validation Threshold Sweep

| Threshold | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${sweepRows}

## Later Eval Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Temporal span scaffold | ${result.eval.answered} | ${result.eval.abstained} | ${pct(result.eval.answer_type_accuracy)} | ${pct(result.eval.citation_precision)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.inline_citation_rate)} |

## Interpretation

This scaffold is cheap and fully amortized. It is still extractive: it can select a better answer span than the top-sentence control, but it cannot synthesize multi-evidence answers or rewrite unsupported claims like a trained generative student.
`;
}

function splitSentences(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "they", "them"]);
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stop.has(token));
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

function stripCitations(value) {
  return String(value).replace(/\s*\[[^\]]+\]/g, "").trim();
}

function counts(tokens) {
  const result = new Map();
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
  return result;
}

function scoreFeatures(weights, values) {
  return Object.entries(values).reduce((total, [key, value]) => total + (weights[key] ?? 0) * value, 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
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

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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
