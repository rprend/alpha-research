import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1";
const runId = args["run-id"] ?? "generation-gap-trained-evidence-preflight-d321-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const featureNames = [
  "bias",
  "reciprocal_rank",
  "sentence_position",
  "question_jaccard",
  "question_coverage",
  "section_overlap",
  "title_overlap",
  "number_match",
  "yes_no_match",
  "result_section",
  "answerish_text",
  "short_sentence",
  "too_long",
  "gold_role_hint_absent",
];
const thresholdGrid = [-0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1.0];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const packetDir = path.join(runsDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");
const trainRows = await readJsonl(path.join(datasetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(datasetDir, "sft_validation.jsonl"));
const prompts = await readJsonl(path.join(datasetDir, "eval_prompts.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const trainExamples = buildEvidenceExamples(trainRows, "train");
const validationExamples = buildEvidenceExamples(validationRows, "validation");
const scaler = fitScaler(trainExamples.map((row) => row.features));
const model = trainLogistic(trainExamples.map((row) => ({
  x: scale(row.features, scaler),
  label: row.label,
  weight: row.label ? 3 : 1,
})));
const trainEval = evaluateEvidenceExamples(trainExamples, model, scaler);
const validationEval = evaluateEvidenceExamples(validationExamples, model, scaler);
const thresholdSweep = thresholdGrid.map((threshold) => evaluatePromptRows(validationRows, model, scaler, threshold, "validation"));
const selectedThreshold = selectThreshold(thresholdSweep);
const validationPromptEval = thresholdSweep.find((row) => row.threshold === selectedThreshold);
const predictions = prompts.map((prompt) => predictPrompt(prompt, model, scaler, selectedThreshold));
const predictionsPath = path.join(outputDir, "predictions.jsonl");
await writeJsonl(predictionsPath, predictions);
const shapeEvalRunId = `${runId}-shape-eval`;
const shapeEval = await runHarness(shapeEvalRunId, predictionsPath);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "generation_gap_trained_evidence_preflight",
  status: shapeEval.status === "model_predictions_pass_shape_gate_needs_grounded_judge"
    ? "trained_evidence_preflight_passed_shape_gate"
    : "trained_evidence_preflight_failed_shape_gate",
  purpose: "Train a zero-spend local evidence/abstention scorer on non-final D321 labels, then evaluate the fixed D321 final generation-gap prompts through the D322 harness.",
  source_runs: {
    packet: packetRunId,
    shape_eval: shapeEvalRunId,
  },
  selected_threshold: selectedThreshold,
  validation_prompt_eval: validationPromptEval,
  training: {
    algorithm: "local_logistic_evidence_sentence_scorer",
    feature_names: featureNames,
    train_rows: trainRows.length,
    validation_rows: validationRows.length,
    train_sentence_examples: trainExamples.length,
    validation_sentence_examples: validationExamples.length,
    selected_threshold: selectedThreshold,
    threshold_selection_rule: "Select on non-final validation rows: maximize overall shape proxy, require abstention accuracy when possible, then answerable F1.",
    model,
    scaler,
  },
  train_sentence_eval: trainEval,
  validation_sentence_eval: validationEval,
  validation_threshold_sweep: thresholdSweep,
  selected_validation_prompt_eval: validationPromptEval,
  predictions: {
    examples: predictions.length,
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    citation_complete_answers: predictions.filter((row) => row.prediction.answer_type === "grounded_answer" && row.prediction.citations.every((id) => row.prediction.answer.includes(`[${id}]`))).length,
  },
  shape_eval_metrics: shapeEval.metrics,
  decision: {
    trained_preflight_passed_shape_gate: shapeEval.status === "model_predictions_pass_shape_gate_needs_grounded_judge",
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    next_step: shapeEval.status === "model_predictions_pass_shape_gate_needs_grounded_judge"
      ? "Consider paid grounded-correctness judging before a larger Prime run."
      : "Do not spend on judging this local scorer; move to a small adapter/generator preflight using the D321 SFT/DPO packet.",
    reason: shapeEval.status === "model_predictions_pass_shape_gate_needs_grounded_judge"
      ? "The trained local scorer clears the fixed shape gate."
      : "The trained local scorer still fails the D322 shape gate, so the D321 gap requires a stronger generator than local evidence scoring.",
  },
  leakage_guard: {
    final_targets_used_for_training: false,
    final_targets_used_for_threshold_selection: false,
    final_targets_used_for_generation: false,
    final_targets_used_for_shape_eval_only: true,
    training_use: "nonfinal_d321_sft_rows_only",
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "Local logistic training and harness scoring only.",
  },
};

await writeJsonl(path.join(outputDir, "train_sentence_predictions.jsonl"), trainExamples.map((row) => predictEvidenceExample(row, model, scaler)));
await writeJsonl(path.join(outputDir, "validation_sentence_predictions.jsonl"), validationExamples.map((row) => predictEvidenceExample(row, model, scaler)));
await writeJsonl(path.join(outputDir, "validation_threshold_sweep.jsonl"), thresholdSweep);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_threshold: selectedThreshold,
  validation_prompt_eval: validationPromptEval,
  predictions: result.predictions,
  shape_eval_metrics: result.shape_eval_metrics,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function buildEvidenceExamples(rows, split) {
  const examples = [];
  for (const row of rows) {
    const target = row.target;
    const goldIds = new Set((target?.citations ?? []).map(String));
    for (const item of row.input.compact_retrieved_evidence_pack ?? []) {
      const sentences = splitSentences(item.text).slice(0, 6);
      for (const [index, sentence] of sentences.entries()) {
        if (contentTokens(sentence).length < 3) continue;
        const label = target.answer_type === "grounded_answer" && goldIds.has(item.evidence_id) ? 1 : 0;
        examples.push({
          split,
          example_id: row.example_id,
          source_example_id: row.input?.document_metadata?.paper_id,
          evidence_id: item.evidence_id,
          sentence_index: index,
          sentence: cleanSentence(sentence),
          target_answer_type: target.answer_type,
          label,
          features: featuresFor(row.input, item, sentence, index),
        });
      }
    }
  }
  return examples;
}

function trainLogistic(rows) {
  const weights = Array(featureNames.length).fill(0);
  const epochs = 240;
  const learningRate = 0.12;
  const l2 = 0.02;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 40);
    for (const row of rows) {
      const pred = sigmoid(dot(weights, row.x));
      const error = pred - row.label;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (row.weight * error * row.x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learning_rate: learningRate, l2 };
}

function evaluateEvidenceExamples(rows, model, scaler) {
  const predictions = rows.map((row) => predictEvidenceExample(row, model, scaler));
  const positives = predictions.filter((row) => row.label === 1);
  const negatives = predictions.filter((row) => row.label === 0);
  return {
    sentence_examples: predictions.length,
    positives: positives.length,
    negatives: negatives.length,
    mean_positive_score: mean(positives.map((row) => row.score)),
    mean_negative_score: mean(negatives.map((row) => row.score)),
    pairwise_auc_proxy: pairwiseAucProxy(positives, negatives),
  };
}

function predictEvidenceExample(row, model, scaler) {
  return {
    split: row.split,
    example_id: row.example_id,
    evidence_id: row.evidence_id,
    sentence_index: row.sentence_index,
    label: row.label,
    score: sigmoid(dot(model.weights, scale(row.features, scaler))),
    sentence: row.sentence,
  };
}

function evaluatePromptRows(rows, model, scaler, threshold, split) {
  const predictions = rows.map((row) => predictPrompt(row, model, scaler, threshold));
  const scored = predictions.map((prediction, index) => scoreAgainstTarget(prediction.prediction, rows[index].target));
  const answerable = scored.filter((row) => row.target_answer_type === "grounded_answer");
  const abstain = scored.filter((row) => row.target_answer_type === "abstain");
  return {
    split,
    threshold,
    examples: scored.length,
    answered: predictions.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: predictions.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: rate(scored.filter((row) => row.answer_type_correct).length, scored.length),
    answerable_f1_mean: mean(answerable.map((row) => row.answer_token_f1).filter(Number.isFinite)),
    citation_exact_rate: rate(scored.filter((row) => row.citation_set_exact).length, scored.length),
    abstention_accuracy: rate(abstain.filter((row) => row.answer_type_correct).length, abstain.length),
    shape_proxy: rate(scored.filter((row) => row.shape_proxy).length, scored.length),
  };
}

function selectThreshold(rows) {
  return [...rows].sort((left, right) =>
    right.shape_proxy - left.shape_proxy
    || right.abstention_accuracy - left.abstention_accuracy
    || Number(right.answerable_f1_mean ?? 0) - Number(left.answerable_f1_mean ?? 0)
    || left.threshold - right.threshold
  )[0].threshold;
}

function predictPrompt(row, model, scaler, threshold) {
  const input = row.input;
  const candidates = [];
  for (const item of input.compact_retrieved_evidence_pack ?? []) {
    for (const [index, sentence] of splitSentences(item.text).slice(0, 6).entries()) {
      if (contentTokens(sentence).length < 3) continue;
      const featureRow = featuresFor(input, item, sentence, index);
      candidates.push({
        evidence_id: item.evidence_id,
        sentence_index: index,
        sentence: cleanSentence(sentence),
        score: sigmoid(dot(model.weights, scale(featureRow, scaler))),
      });
    }
  }
  const selected = candidates.sort((left, right) => right.score - left.score || left.evidence_id.localeCompare(right.evidence_id)).slice(0, 2);
  if (!selected.length || selected[0].score < threshold) {
    const prediction = abstain(`Top trained evidence score ${selected[0]?.score?.toFixed(3) ?? "n/a"} below threshold ${threshold}.`);
    return { example_id: row.example_id, prediction, raw_output: JSON.stringify(prediction), metadata: { policy: "trained_evidence_threshold", top_score: selected[0]?.score ?? null } };
  }
  const citations = unique(selected.filter((row) => row.score >= Math.max(threshold, selected[0].score - 0.12)).map((row) => row.evidence_id)).slice(0, 4);
  const used = selected.filter((row) => citations.includes(row.evidence_id)).slice(0, 2);
  const answer = `${used.map((row) => row.sentence).join("; ")} ${citations.map((id) => `[${id}]`).join(" ")}`;
  const prediction = {
    answer_type: "grounded_answer",
    answer,
    citations,
    claim_table: used.map((row) => ({ claim: row.sentence, support: "trained_evidence_sentence", citations: [row.evidence_id] })),
    abstention_reason: null,
  };
  return { example_id: row.example_id, prediction, raw_output: JSON.stringify(prediction), metadata: { policy: "trained_evidence_scorer", selected_scores: used.map(({ evidence_id, score }) => ({ evidence_id, score })) } };
}

function scoreAgainstTarget(prediction, target) {
  const targetCitations = normalizeCitations(target.citations ?? []);
  const predictionCitations = normalizeCitations(prediction.citations ?? []);
  const answerTypeCorrect = prediction.answer_type === target.answer_type;
  const citationSetExact = target.answer_type === "grounded_answer"
    ? setEqual(new Set(targetCitations), new Set(predictionCitations))
    : predictionCitations.length === 0;
  const answerTokenF1 = target.answer_type === "grounded_answer" && prediction.answer_type === "grounded_answer"
    ? tokenF1(prediction.answer, target.answer)
    : null;
  return {
    target_answer_type: target.answer_type,
    prediction_answer_type: prediction.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    answer_token_f1: answerTokenF1,
    shape_proxy: target.answer_type === "grounded_answer"
      ? prediction.answer_type === "grounded_answer" && predictionCitations.length > 0 && Number(answerTokenF1 ?? 0) >= 0.25
      : prediction.answer_type === "abstain" && predictionCitations.length === 0,
  };
}

function featuresFor(input, evidence, sentence, sentenceIndex) {
  const questionTokens = contentTokens(input.question);
  const sentenceTokens = contentTokens(sentence);
  const sectionTokens = contentTokens(evidence.section ?? "");
  const titleTokens = contentTokens(input.document_metadata?.title ?? "");
  const numberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result|f1|rouge|bleu|improve|improvement|increase|decrease)\b/i.test(input.question);
  const yesNoIntent = /^(is|are|was|were|do|does|did|can|could|has|have|had)\b/i.test(input.question);
  return [
    1,
    1 / Math.max(1, Number(evidence.retrieval_rank ?? 99)),
    1 / (1 + sentenceIndex),
    jaccard(questionTokens, sentenceTokens),
    coverage(questionTokens, sentenceTokens),
    jaccard(questionTokens, sectionTokens),
    jaccard(questionTokens, titleTokens),
    numberIntent && /\d|percent|point|score|rouge|bleu|f1/i.test(sentence) ? 1 : 0,
    yesNoIntent && /\b(no|yes|not|whether|if|show|suggest|indicat)\b/i.test(sentence) ? 1 : 0,
    /\b(result|experiment|evaluation|analysis|table|figure|performance|evidence)\b/i.test(evidence.section ?? "") ? 1 : 0,
    /\b(result|show|shown|found|observe|improve|outperform|perform|achiev|score|accuracy|evidence|because|therefore|suggest|assumption)\w*\b/i.test(sentence) ? 1 : 0,
    sentenceTokens.length <= 16 ? 1 : 0,
    sentenceTokens.length > 70 ? 1 : 0,
    evidence.role ? 0 : 1,
  ];
}

function fitScaler(rows) {
  const means = Array(featureNames.length).fill(0);
  const stds = Array(featureNames.length).fill(1);
  for (let index = 0; index < featureNames.length; index += 1) {
    const values = rows.map((row) => row[index]);
    means[index] = mean(values);
    stds[index] = Math.sqrt(mean(values.map((value) => (value - means[index]) ** 2))) || 1;
  }
  means[0] = 0;
  stds[0] = 1;
  return { means, stds };
}

function scale(row, scaler) {
  return row.map((value, index) => (value - scaler.means[index]) / scaler.stds[index]);
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

async function runHarness(evalRunId, predictionsPath) {
  const script = path.join("scripts", "grounded-qa-distillation-generation-gap-eval-harness.mjs");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      script,
      "--packet-run-id",
      packetRunId,
      "--prediction-file",
      path.relative(rootDir, predictionsPath),
      "--run-id",
      evalRunId,
    ], { cwd: rootDir, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Harness failed with code ${code}: ${stderr}`));
    });
  });
  return readJson(path.join(runsDir, evalRunId, "result.json"));
}

function renderReport(result) {
  return `# Generation Gap Trained Evidence Preflight

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no Prime job.

## Shape Eval

Selected validation threshold: \`${result.selected_threshold}\`

Validation shape proxy at selected threshold: ${pct(result.validation_prompt_eval?.shape_proxy)}

| Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${pct(result.shape_eval_metrics.answer_type_accuracy)} | ${pct(result.shape_eval_metrics.answerable_supported_shape_rate)} | ${pct(result.shape_eval_metrics.abstention_shape_rate)} | ${pct(result.shape_eval_metrics.citation_set_exact_rate)} | ${pct(result.shape_eval_metrics.mean_answer_token_f1)} | ${pct(result.shape_eval_metrics.overall_shape_correct_rate)} |

## Decision

- Trained preflight passed shape gate: ${result.decision.trained_preflight_passed_shape_gate ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function contentTokens(text) {
  const stop = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "how", "what", "which", "they", "them", "does", "did", "under", "specific", "current", "approaches"]);
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stop.has(token));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 0;
  return [...leftSet].filter((token) => rightSet.has(token)).length / union.size;
}

function coverage(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size) return 0;
  return [...leftSet].filter((token) => rightSet.has(token)).length / leftSet.size;
}

function tokenF1(left, right) {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightCounts = new Map();
  for (const token of rightTokens) rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }
  const precision = overlap / leftTokens.length;
  const recall = overlap / rightTokens.length;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function normalizeCitations(citations) {
  return citations.map((citation) => typeof citation === "string" ? citation : citation?.evidence_id).filter(Boolean);
}

function pairwiseAucProxy(positives, negatives) {
  let correct = 0;
  let total = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      total += 1;
      if (positive.score > negative.score) correct += 1;
      else if (positive.score === negative.score) correct += 0.5;
    }
  }
  return total ? correct / total : null;
}

function setEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function unique(values) {
  return [...new Set(values)];
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
