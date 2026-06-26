import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const exportDir = path.join(experimentDir, "exports");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const studentRunId = args["student-run"] ?? "openai-student-temporal-test-full-v1";
const judgeRunId = args["judge-run"] ?? "openai-judge-student-temporal-test-full-v1";
const teacherLabelPrefix = args["teacher-label-prefix"] ?? "teacher-repair-temporal-test-0-80-v1";
const trainLimit = numberArg(args["train-limit"], 80);
const evalOffset = numberArg(args["eval-offset"], 80, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], Number.POSITIVE_INFINITY);
const runId = args["run-id"] ?? `teacher-label-filter-${split}-${evalOffset}-heldout-v1`;
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const references = await readJsonl(path.join(experimentDir, "data", `${split}.jsonl`));
const referencesById = new Map(references.map((row) => [row.example_id, row]));
const studentRows = await readJsonl(path.join(runDir, studentRunId, "predictions.jsonl"));
const studentById = new Map(studentRows.filter((row) => !row.skipped).map((row) => [row.example_id, row]));
const judgeRows = await readJsonl(path.join(runDir, judgeRunId, "judgments.jsonl"));
const judgeById = new Map(judgeRows.filter((row) => !row.skipped).map((row) => [row.example_id, row]));
const labelRows = await loadTeacherLabels(teacherLabelPrefix);
const labelById = new Map(labelRows.map((row) => [row.example_id, row]));

const trainExamples = references
  .slice(0, trainLimit)
  .map((reference) => buildTrainingExample(reference))
  .filter(Boolean);
const model = trainLogistic(trainExamples);
const thresholds = [0.15, 0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85];
const thresholdResults = thresholds.map((threshold) => evaluateFiltered(references.slice(0, trainLimit), model, threshold, { splitName: "train" }));
const selectedThreshold = chooseThreshold(thresholdResults).threshold;
const evalReferences = references.slice(evalOffset, Number.isFinite(evalLimit) ? evalOffset + evalLimit : undefined);
const baseline = evaluateBaseline(evalReferences);
const filtered = evaluateFiltered(evalReferences, model, selectedThreshold, { splitName: "heldout" });
const predictions = filtered.predictions;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  student_run_id: studentRunId,
  judge_run_id: judgeRunId,
  teacher_label_prefix: teacherLabelPrefix,
  train_examples_seen: trainLimit,
  train_examples_used: trainExamples.length,
  eval_offset: evalOffset,
  eval_examples: evalReferences.length,
  model: {
    type: "logistic_keep_answer_filter",
    feature_names: featureNames(),
    weights: model.weights,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    selected_threshold: selectedThreshold,
    threshold_grid: thresholdResults.map(({ predictions: _predictions, ...row }) => row),
  },
  baseline: baseline.metrics,
  filtered: filtered.metrics,
  interpretation: {
    cost_change: "No additional LLM calls. The filter runs locally after the direct mini student.",
    limitation: "The filter can only keep direct student answers or force abstention; it cannot recover answers the student already abstained on.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "filter-model.json"), `${JSON.stringify(model, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  baseline: result.baseline,
  filtered: result.filtered,
}, null, 2));

async function loadTeacherLabels(prefix) {
  const accepted = await readJsonl(path.join(exportDir, `${prefix}.sft.jsonl`));
  const rejected = await readJsonl(path.join(exportDir, `${prefix}.rejected.jsonl`));
  return [
    ...accepted.map((row) => ({ ...row, strict_label: row.teacher_output.answer_type === "grounded_answer" ? "keep_answer" : "force_abstain" })),
    ...rejected.map((row) => ({ ...row, strict_label: "force_abstain" })),
  ];
}

function buildTrainingExample(reference) {
  const student = studentById.get(reference.example_id);
  const label = labelById.get(reference.example_id);
  if (!student || !label) return null;
  const prediction = normalizePrediction(student.prediction ?? {});
  if (prediction.answer_type !== "grounded_answer") return null;
  return {
    example_id: reference.example_id,
    target: label.strict_label === "keep_answer" ? 1 : 0,
    features: features(reference, prediction),
  };
}

function evaluateBaseline(rows) {
  const predictions = rows.map((reference) => {
    const student = studentById.get(reference.example_id);
    const prediction = normalizePrediction(student?.prediction ?? {});
    return scorePrediction(reference, prediction, {
      policy: "direct_student",
      original_answer_type: prediction.answer_type,
      keep_probability: null,
      forced_abstain: false,
    });
  });
  return { predictions, metrics: summarize(predictions) };
}

function evaluateFiltered(rows, model, threshold, { splitName }) {
  const predictions = rows.map((reference) => {
    const student = studentById.get(reference.example_id);
    const original = normalizePrediction(student?.prediction ?? {});
    let prediction = original;
    let keepProbability = null;
    let forcedAbstain = false;
    if (original.answer_type === "grounded_answer") {
      keepProbability = sigmoid(scoreFeatures(model.weights, features(reference, original)));
      if (keepProbability < threshold) {
        forcedAbstain = true;
        prediction = abstain(`teacher-label filter keep probability ${keepProbability.toFixed(3)} below threshold ${threshold}`);
      }
    }
    return scorePrediction(reference, prediction, {
      policy: `teacher_label_filter_${splitName}`,
      original_answer_type: original.answer_type,
      keep_probability: keepProbability,
      forced_abstain: forcedAbstain,
    });
  });
  return { threshold, predictions, metrics: summarize(predictions) };
}

function scorePrediction(reference, prediction, metadata) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = prediction.citations.filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  const judge = judgeById.get(reference.example_id);
  const keptSupportedAnswer = prediction.answer_type === "grounded_answer"
    && judge?.judgment?.verdict === "supported"
    && judge?.judgment?.all_claims_supported === true
    && judge?.judgment?.citation_ids_valid === true;
  const abstentionSupportedByGold = prediction.answer_type === "abstain" && reference.output.answer_type === "abstain";
  return {
    example_id: reference.example_id,
    prediction,
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: [...referenceCitations],
    },
    scores: {
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
      judged_or_gold_correct: keptSupportedAnswer || abstentionSupportedByGold,
      kept_answer_supported: prediction.answer_type === "grounded_answer" ? keptSupportedAnswer : null,
    },
    metadata,
  };
}

function summarize(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    forced_abstentions: rows.filter((row) => row.metadata.forced_abstain).length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
    kept_answer_support_rate: mean(rows.map((row) => row.scores.kept_answer_supported)),
    hybrid_supported_or_gold_abstention_rate: mean(rows.map((row) => row.scores.judged_or_gold_correct)),
  };
}

function trainLogistic(rows) {
  const names = featureNames();
  const weights = Object.fromEntries(names.map((name) => [name, 0]));
  const learningRate = 0.08;
  const epochs = 600;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const row of rows) {
      const predicted = sigmoid(scoreFeatures(weights, row.features));
      const error = row.target - predicted;
      for (const name of names) {
        weights[name] += learningRate * error * (row.features[name] ?? 0);
      }
    }
  }
  return { weights, epochs, learningRate };
}

function chooseThreshold(results) {
  return [...results].sort((a, b) => {
    const aScore = a.metrics.hybrid_supported_or_gold_abstention_rate + a.metrics.answer_type_accuracy + a.metrics.citation_precision;
    const bScore = b.metrics.hybrid_supported_or_gold_abstention_rate + b.metrics.answer_type_accuracy + b.metrics.citation_precision;
    return bScore - aScore || b.metrics.answer_token_f1 - a.metrics.answer_token_f1;
  })[0];
}

function features(reference, prediction) {
  const evidenceIds = new Set(reference.input.compact_retrieved_evidence_pack.map((item) => item.evidence_id));
  const citedEvidence = reference.input.compact_retrieved_evidence_pack.filter((item) => prediction.citations.includes(item.evidence_id));
  const questionTokens = contentTokens(reference.input.question);
  const answerTokens = contentTokens(prediction.answer);
  const citedOverlaps = citedEvidence.map((item) => jaccard(questionTokens, contentTokens(item.text)));
  const inlineCount = prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length;
  const validCount = prediction.citations.filter((id) => evidenceIds.has(id)).length;
  return {
    bias: 1,
    citation_count: cap(prediction.citations.length, 5) / 5,
    inline_rate: ratio(inlineCount, prediction.citations.length),
    valid_citation_rate: ratio(validCount, prediction.citations.length),
    claim_count: cap(Array.isArray(prediction.claim_table) ? prediction.claim_table.length : 0, 5) / 5,
    answer_token_count: cap(answerTokens.length, 120) / 120,
    cited_question_overlap_mean: mean(citedOverlaps),
    cited_question_overlap_max: citedOverlaps.length ? Math.max(...citedOverlaps) : 0,
    answer_question_overlap: jaccard(questionTokens, answerTokens),
    metadata_has_abstract: reference.input.document_metadata?.abstract ? 1 : 0,
  };
}

function featureNames() {
  return [
    "bias",
    "citation_count",
    "inline_rate",
    "valid_citation_rate",
    "claim_count",
    "answer_token_count",
    "cited_question_overlap_mean",
    "cited_question_overlap_max",
    "answer_question_overlap",
    "metadata_has_abstract",
  ];
}

function renderReport(result) {
  return `# Teacher-Label Filter V1

## Setup

- Student run: \`${result.student_run_id}\`
- Judge run for kept direct answers: \`${result.judge_run_id}\`
- Teacher label packet: \`${result.teacher_label_prefix}\`
- Training slice: first ${result.train_examples_seen} \`${result.split}\` examples
- Training examples used: ${result.train_examples_used} direct grounded-answer predictions
- Held-out slice: \`${result.split}\` examples ${result.eval_offset + 1}-${result.eval_offset + result.eval_examples}
- Selected keep threshold: ${result.model.selected_threshold}

The filter is a local logistic gate over the direct mini student's output. It does not call an LLM and cannot generate missing answers; it only keeps grounded answers or converts them to abstentions.

## Held-Out Result

| Policy | Answered | Forced abstentions | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Kept-answer support | Hybrid support/gold-abstention |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini student | ${result.baseline.answered} | ${result.baseline.forced_abstentions} | ${pct(result.baseline.answer_type_accuracy)} | ${pct(result.baseline.citation_precision)} | ${pct(result.baseline.citation_recall)} | ${pct(result.baseline.answer_token_f1)} | ${pct(result.baseline.inline_citation_rate)} | ${pct(result.baseline.kept_answer_support_rate)} | ${pct(result.baseline.hybrid_supported_or_gold_abstention_rate)} |
| Teacher-label filter | ${result.filtered.answered} | ${result.filtered.forced_abstentions} | ${pct(result.filtered.answer_type_accuracy)} | ${pct(result.filtered.citation_precision)} | ${pct(result.filtered.citation_recall)} | ${pct(result.filtered.answer_token_f1)} | ${pct(result.filtered.inline_citation_rate)} | ${pct(result.filtered.kept_answer_support_rate)} | ${pct(result.filtered.hybrid_supported_or_gold_abstention_rate)} |

The hybrid support/gold-abstention metric uses the existing LLM judge for kept direct answers and the gold insufficient-evidence label for abstentions. It is not a replacement for judging the filtered abstentions, but it is a zero-cost screening metric for whether the local filter is moving in the right direction.

## Interpretation

This is an offline policy test, not a final student. If the filter improves support by over-abstaining, the next step is to train a generator on the accepted teacher labels rather than shipping the gate. If it hurts both support and answer coverage, the strict label packet needs more examples or a better teacher repair rule before post-training.
`;
}

function normalizePrediction(value) {
  const answerType = value.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const citations = Array.isArray(value.citations)
    ? value.citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean)
    : [];
  return {
    answer_type: answerType,
    answer: String(value.answer ?? ""),
    citations: answerType === "abstain" ? [] : citations,
    claim_table: Array.isArray(value.claim_table) ? value.claim_table : [],
    abstention_reason: answerType === "abstain" ? String(value.abstention_reason ?? "") : null,
  };
}

function abstain(reason) {
  return {
    answer_type: "abstain",
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: reason,
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

function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size && !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / new Set([...a, ...b]).size;
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

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function cap(value, max) {
  return Math.min(Number(value) || 0, max);
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
