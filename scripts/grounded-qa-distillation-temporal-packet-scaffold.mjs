import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sftPrepRunId = args["sft-prep-run-id"] ?? "hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1";
const runId = args["run-id"] ?? `temporal-packet-scaffold-${sftPrepRunId}`;
const outputDir = path.join(runDir, runId);
const packetDir = path.join(runDir, sftPrepRunId);
const thresholdGrid = [0.15, 0.25, 0.35, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const packet = JSON.parse(await fs.readFile(path.join(packetDir, "result.json"), "utf8"));
const trainRows = (await readJsonl(path.join(packetDir, "train.hf-sft.jsonl"))).map(toLabeledRow);
const validationRows = (await readJsonl(path.join(packetDir, "validation.hf-sft.jsonl"))).map(toLabeledRow);
const evalRows = (await readJsonl(path.join(packetDir, "eval_prompts.jsonl"))).map(toEvalRow);

const evidenceModel = trainEvidenceModel(trainRows);
const sufficiencyModel = trainSufficiencyModel(trainRows, evidenceModel);
const thresholdSweeps = thresholdGrid.map((threshold) => evaluate(validationRows, threshold, {
  splitName: "validation",
  evidenceModel,
  sufficiencyModel,
}));
const selected = chooseThreshold(thresholdSweeps);
const evalResult = evaluate(evalRows, selected.threshold, {
  splitName: "eval",
  evidenceModel,
  sufficiencyModel,
});

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
    type: "zero_llm_temporal_packet_extractive_scaffold",
    training: "Evidence and sufficiency logistic models trained on SFT packet train rows; threshold selected on validation rows.",
    prediction: "Abstain below selected sufficiency threshold; otherwise quote the top evidence sentence with inline citation.",
    selected_threshold: selected.threshold,
  },
  models: {
    evidence_selector: summarizeModel(evidenceModel),
    sufficiency: summarizeModel(sufficiencyModel),
  },
  validation_threshold_sweep: thresholdSweeps.map(({ predictions: _predictions, ...row }) => row),
  validation: selected.metrics,
  eval: evalResult.metrics,
  cost: {
    llm_calls: 0,
    estimated_inference_cost_usd: 0,
    note: "Local packet scaffold. No hosted model calls.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), evalResult.predictions);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "temporal-packet-scaffold-model.json"), `${JSON.stringify({
  evidence_selector: evidenceModel,
  sufficiency: sufficiencyModel,
}, null, 2)}\n`);
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

function trainEvidenceModel(rows) {
  const candidates = [];
  for (const row of rows) {
    const cited = new Set(row.output.citations);
    for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
      candidates.push({
        features: evidenceFeatures(row, evidence),
        label: row.output.answer_type === "grounded_answer" && cited.has(evidence.evidence_id) ? 1 : 0,
      });
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["evidence-epochs"], 80),
    learningRate: Number(args["evidence-learning-rate"] ?? 0.14),
    l2: Number(args["evidence-l2"] ?? 0.0008),
  });
}

function trainSufficiencyModel(rows, evidenceModel) {
  const candidates = rows.map((row) => {
    const ranked = rankEvidence(row, evidenceModel).slice(0, 2);
    return {
      features: sufficiencyFeatures(row, ranked),
      label: row.output.answer_type === "grounded_answer" ? 1 : 0,
    };
  });
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["sufficiency-epochs"], 100),
    learningRate: Number(args["sufficiency-learning-rate"] ?? 0.13),
    l2: Number(args["sufficiency-l2"] ?? 0.0008),
  });
}

function evaluate(rows, threshold, { splitName, evidenceModel, sufficiencyModel }) {
  const predictions = rows.map((row) => {
    const prediction = predict(row, threshold, evidenceModel, sufficiencyModel);
    const reference = row.reference;
    const referenceCitations = new Set(reference.citations);
    const answerable = reference.answer_type === "grounded_answer";
    const answered = prediction.answer_type === "grounded_answer";
    return {
      example_id: row.example_id,
      window: row.window,
      system: `temporal_packet_scaffold_${splitName}`,
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
  return {
    threshold,
    predictions,
    metrics: summarizePredictions(predictions),
  };
}

function predict(row, threshold, evidenceModel, sufficiencyModel) {
  const ranked = rankEvidence(row, evidenceModel).slice(0, 2);
  const sufficiency = sigmoid(scoreFeatures(sufficiencyModel.weights, sufficiencyFeatures(row, ranked)));
  if (sufficiency < threshold || !ranked.length) {
    return {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "temporal_packet_scaffold", citations: [] }],
      abstention_reason: `Sufficiency ${sufficiency.toFixed(3)} below threshold ${threshold}.`,
    };
  }
  const selected = ranked[0].evidence;
  const span = firstUsefulSentence(selected.text);
  const answer = `${span} [${selected.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [selected.evidence_id],
    claim_table: [{ claim: stripCitations(span), support: "selected_by_temporal_packet_scaffold", citations: [selected.evidence_id] }],
    abstention_reason: null,
    rationale: `Sufficiency ${sufficiency.toFixed(3)} at threshold ${threshold}.`,
  };
}

function chooseThreshold(results) {
  return [...results].sort((left, right) => {
    const leftScore = objective(left.metrics);
    const rightScore = objective(right.metrics);
    return rightScore - leftScore || right.metrics.answer_type_accuracy - left.metrics.answer_type_accuracy;
  })[0];
}

function objective(metrics) {
  return (2 * metrics.answer_type_accuracy) + metrics.citation_precision + metrics.answer_token_f1 + metrics.inline_citation_rate;
}

function evidenceFeatures(row, evidence) {
  const questionTokens = contentTokens(row.input.question);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section ?? "");
  const titleTokens = contentTokens(row.input.document_metadata?.title ?? "");
  const questionSet = new Set(questionTokens);
  const evidenceSet = new Set(evidenceTokens);
  const overlap = [...questionSet].filter((token) => evidenceSet.has(token));
  const questionHasNumberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result)\b/i.test(row.input.question);
  return {
    bias: 1,
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 1)),
    question_jaccard: jaccard(questionTokens, evidenceTokens),
    question_coverage: questionSet.size ? overlap.length / questionSet.size : 0,
    title_overlap: jaccard(questionTokens, titleTokens),
    section_overlap: jaccard(questionTokens, sectionTokens),
    log_evidence_length: Math.min(1, Math.log1p(evidenceTokens.length) / 7),
    number_match: questionHasNumberIntent && /\d/.test(evidence.text) ? 1 : 0,
    table_like: /FLOAT SELECTED|table|figure|result|score|accuracy|dataset|baseline|annotat/i.test(evidence.text) ? 1 : 0,
  };
}

function sufficiencyFeatures(row, ranked) {
  const probabilities = ranked.map((item) => item.probability);
  const evidenceText = ranked.map((item) => item.evidence.text).join(" ");
  return {
    bias: 1,
    top_probability: probabilities[0] ?? 0,
    second_probability: probabilities[1] ?? 0,
    probability_gap: (probabilities[0] ?? 0) - (probabilities[1] ?? 0),
    mean_probability: mean(probabilities),
    top_question_jaccard: ranked[0] ? evidenceFeatures(row, ranked[0].evidence).question_jaccard : 0,
    merged_question_jaccard: jaccard(contentTokens(row.input.question), contentTokens(evidenceText)),
    counterfactual_flag: row.input.document_metadata?.counterfactual ? 1 : 0,
    has_number: /\d/.test(evidenceText) ? 1 : 0,
  };
}

function rankEvidence(row, model) {
  return (row.input.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => ({
      evidence,
      probability: sigmoid(scoreFeatures(model.weights, evidenceFeatures(row, evidence))),
    }))
    .sort((a, b) => b.probability - a.probability || Number(a.evidence.retrieval_rank ?? 99) - Number(b.evidence.retrieval_rank ?? 99));
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
    `| ${row.threshold} | ${row.metrics.answered} | ${pct(row.metrics.answer_type_accuracy)} | ${pct(row.metrics.citation_precision)} | ${pct(row.metrics.answer_token_f1)} | ${pct(row.metrics.inline_citation_rate)} |`
  )).join("\n");
  return `# Temporal Packet Scaffold

## Purpose

Evaluate a zero-LLM local scaffold that consumes the same leakage-safe temporal SFT packet prepared for Qwen LoRA. This is a control for what the accepted labels teach without generative fine-tuning.

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

| Threshold | Answered | Answer-type acc. | Citation precision | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
${sweepRows}

## Later Eval Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Temporal packet scaffold | ${result.eval.answered} | ${result.eval.abstained} | ${pct(result.eval.answer_type_accuracy)} | ${pct(result.eval.citation_precision)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.inline_citation_rate)} |

## Interpretation

This scaffold is cheap and fully amortized, but it is extractive and cannot synthesize or repair claims like a generative student. It should be treated as a local control while the Qwen LoRA path is blocked.
`;
}

function firstUsefulSentence(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const selected = parts.find((part) => contentTokens(part).length >= 5) ?? parts[0] ?? String(text).trim();
  return truncateAtWord(selected, 280);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"]);
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
