import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));
const stopwords = new Set("the and for that with this from are was were what which they them does did any how their there using used into than then also only specific paper study method model dataset task result results use uses is in on of to a an by as or be can it its we our you your from into over under about without within across between has have had not no do done than such each all both same more most less fewer much many percentage previous state art".split(" "));

const repairPacketRunId = args["repair-packet-run-id"] ?? "frontier-full-nonfinal-repair-packet-2026-06-29-v1";
const validationGateRunId = args["validation-gate-run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "learned-repaired-selector-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const trainRows = await readJsonl(path.join(runsDir, repairPacketRunId, "dataset", "sft_train_repaired_sample.jsonl"));
const validationPrompts = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_prompts.jsonl"));
const validationTargets = await readJsonl(path.join(runsDir, validationGateRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const validationTargetById = new Map(validationTargets.map((row) => [row.example_id, row.target]));

const trainTune = trainRows.slice(0, 160).map((row) => asEvalRow(row, "train_tune"));
const trainHeldout = trainRows.slice(160).map((row) => asEvalRow(row, "train_heldout"));
const validationRows = validationPrompts.map((row) => ({
  example_id: row.example_id,
  input: row.input,
  target: validationTargetById.get(row.example_id),
  split: "repaired_validation_gate",
}));

const answerFeatureNames = [
  "top_overlap",
  "second_overlap",
  "score_margin",
  "top_density",
  "top_section_match",
  "numeric_question",
  "numeric_support",
  "question_length",
  "evidence_count",
  "counterfactual",
  "risky_question",
  "comparison_question",
  "how_much_question",
  "list_question",
  "top_sentence_has_metric",
  "abstract_overlap",
];
const citationFeatureNames = [
  "candidate_overlap",
  "candidate_density",
  "rank_inverse",
  "section_match",
  "numeric_match",
  "candidate_has_metric",
  "sentence_length",
  "question_coverage",
  "abstract_overlap",
  "top_candidate",
];

const answerTrain = trainTune.map((row) => ({
  x: answerFeatures(row.input),
  y: row.target?.answer_type === "grounded_answer" ? 1 : 0,
}));
const citationTrain = [];
for (const row of trainTune) {
  if (row.target?.answer_type !== "grounded_answer") continue;
  const gold = new Set(normalizeCitations(row.target.citations));
  for (const candidate of evidenceCandidates(row.input)) {
    citationTrain.push({
      x: citationFeatures(row.input, candidate),
      y: gold.has(candidate.evidence_id) ? 1 : 0,
    });
  }
}

const answerScaler = makeScaler(answerTrain.map((row) => row.x));
const citationScaler = makeScaler(citationTrain.map((row) => row.x));
const answerModel = trainLogistic(answerTrain, answerScaler, { epochs: 1400, learningRate: 0.08, l2: 0.004 });
const citationModel = trainLogistic(citationTrain, citationScaler, { epochs: 1200, learningRate: 0.08, l2: 0.006 });

const grid = buildGrid();
const candidates = grid.map((params) => ({
  params,
  tune: evaluateRows(trainTune, params),
}));
candidates.sort(compareCandidates);
const selected = candidates[0];

const tunePredictions = predictRows(trainTune, selected.params);
const heldoutPredictions = predictRows(trainHeldout, selected.params);
const validationPredictions = predictRows(validationRows, selected.params);
const tuneMetrics = summarizePredictions(tunePredictions);
const heldoutMetrics = summarizePredictions(heldoutPredictions);
const validationMetrics = summarizePredictions(validationPredictions);
const baselineValidation = {
  train_calibrated_scaffold_contract_correct: 44,
  train_calibrated_scaffold_contract_correct_rate: 44 / 70,
  constrained_hybrid_contract_correct: 45,
  constrained_hybrid_contract_correct_rate: 45 / 70,
  train_selected_constrained_policy_contract_correct: 41,
  train_selected_constrained_policy_contract_correct_rate: 41 / 70,
};

await writeJsonl(path.join(outputDir, "train_tune_predictions.jsonl"), tunePredictions);
await writeJsonl(path.join(outputDir, "train_heldout_predictions.jsonl"), heldoutPredictions);
await writeJsonl(path.join(outputDir, "validation_predictions.jsonl"), validationPredictions);
await writeJsonl(path.join(outputDir, "tuning_grid.jsonl"), candidates);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "learned_repaired_selector_audit",
  status: statusFor(validationMetrics, baselineValidation),
  purpose: "Train a zero-spend lightweight answerability and citation selector on repaired train rows, then evaluate transfer to heldout repaired train and repaired validation before any more LLM/GPU spend.",
  source_runs: {
    repair_packet_run_id: repairPacketRunId,
    validation_gate_run_id: validationGateRunId,
  },
  split_policy: {
    train_tune_rows: trainTune.length,
    train_heldout_rows: trainHeldout.length,
    validation_gate_rows: validationRows.length,
    leakage_note: "Answerability/citation models and thresholds are trained and selected only on the first 160 repaired train rows. Heldout train and repaired validation are diagnostic evaluation surfaces.",
  },
  training: {
    answer_feature_names: answerFeatureNames,
    citation_feature_names: citationFeatureNames,
    answer_train_examples: answerTrain.length,
    citation_train_examples: citationTrain.length,
    answer_positive_examples: answerTrain.filter((row) => row.y === 1).length,
    citation_positive_examples: citationTrain.filter((row) => row.y === 1).length,
  },
  learned_models: {
    answerability: {
      weights: answerModel.weights,
      intercept: answerModel.intercept,
      feature_means: answerScaler.means,
      feature_scales: answerScaler.scales,
    },
    citation_selector: {
      weights: citationModel.weights,
      intercept: citationModel.intercept,
      feature_means: citationScaler.means,
      feature_scales: citationScaler.scales,
    },
  },
  tuning: {
    candidates: candidates.length,
    selected_policy: selected.params,
    selection_objective: "Maximize train-tune contract correctness, then answer-type accuracy, then citation exactness, then prefer fewer answered rows.",
  },
  metrics: {
    train_tune: tuneMetrics,
    train_heldout: heldoutMetrics,
    repaired_validation_gate: validationMetrics,
  },
  baseline_comparison: {
    ...baselineValidation,
    selected_validation_contract_correct: validationMetrics.contract_correct,
    selected_validation_contract_correct_rate: validationMetrics.contract_correct_rate,
    delta_vs_train_calibrated_scaffold: validationMetrics.contract_correct - baselineValidation.train_calibrated_scaffold_contract_correct,
    delta_vs_constrained_hybrid: validationMetrics.contract_correct - baselineValidation.constrained_hybrid_contract_correct,
    delta_vs_train_selected_constrained_policy: validationMetrics.contract_correct - baselineValidation.train_selected_constrained_policy_contract_correct,
  },
  decision: {
    buy_openai_judgments_now: false,
    launch_prime_now: false,
    promote_as_final_scaffold: false,
    next_step: nextStepFor(validationMetrics, baselineValidation),
    reason: "A learned local selector must beat the zero-spend scaffold and Qwen/scaffold hybrid before paid judging or another Prime run is justified.",
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit trains local logistic selectors over existing repaired labels and makes no model API calls or GPU launches.",
  },
  artifacts: {
    train_tune_predictions_jsonl: rel(path.join(outputDir, "train_tune_predictions.jsonl")),
    train_heldout_predictions_jsonl: rel(path.join(outputDir, "train_heldout_predictions.jsonl")),
    validation_predictions_jsonl: rel(path.join(outputDir, "validation_predictions.jsonl")),
    tuning_grid_jsonl: rel(path.join(outputDir, "tuning_grid.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.tuning.selected_policy,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
}, null, 2));

function asEvalRow(row, split) {
  return {
    example_id: row.example_id,
    input: row.input,
    target: row.target,
    split,
  };
}

function buildGrid() {
  const rows = [];
  for (const answer_threshold of [0.26, 0.32, 0.38, 0.44, 0.5, 0.56, 0.62, 0.68, 0.74]) {
    for (const citation_threshold of [0.18, 0.24, 0.3, 0.36, 0.42, 0.5, 0.58]) {
      for (const max_citations of [1, 2, 3]) {
        for (const min_margin of [0, 0.03, 0.06, 0.1]) {
          rows.push({ answer_threshold, citation_threshold, max_citations, min_margin });
        }
      }
    }
  }
  return rows;
}

function predictRows(rows, params) {
  return rows.map((row) => {
    const prediction = predict(row, params);
    const scores = scorePrediction(prediction, row.target);
    return {
      example_id: row.example_id,
      split: row.split,
      prediction,
      raw_output: JSON.stringify(prediction),
      scores,
      metadata: {
        scaffold: "learned_repaired_answerability_and_citation_selector",
        params,
        answer_probability: prediction._debug?.answer_probability,
        selected_citation_probabilities: prediction._debug?.selected_citation_probabilities,
        no_model_or_llm_calls: true,
      },
    };
  });
}

function evaluateRows(rows, params) {
  return summarizePredictions(predictRows(rows, params));
}

function summarizePredictions(predictions) {
  const answered = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const answerTypeCorrect = count(predictions, (row) => row.scores.answer_type_correct);
  const citationExact = count(predictions, (row) => row.scores.citation_set_exact);
  const contractCorrect = count(predictions, (row) => row.scores.contract_correct);
  return {
    examples: predictions.length,
    answered: answered.length,
    abstained: predictions.length - answered.length,
    answer_rate: rate(answered.length, predictions.length),
    answer_type_correct: answerTypeCorrect,
    answer_type_accuracy: rate(answerTypeCorrect, predictions.length),
    citation_set_exact: citationExact,
    citation_set_exact_rate: rate(citationExact, predictions.length),
    contract_correct: contractCorrect,
    contract_correct_rate: rate(contractCorrect, predictions.length),
    confusion: countBy(predictions.map((row) => `${row.prediction.answer_type}_vs_${row.scores.target_answer_type}`)),
  };
}

function predict(row, params) {
  const input = row.input;
  const answerProbability = predictProb(answerModel, answerScaler, answerFeatures(input));
  const candidates = evidenceCandidates(input).map((candidate, index) => ({
    ...candidate,
    citation_probability: predictProb(citationModel, citationScaler, citationFeatures(input, candidate)),
    model_rank: index + 1,
  })).sort((left, right) => right.citation_probability - left.citation_probability || right.lexical_score - left.lexical_score || left.evidence_id.localeCompare(right.evidence_id));
  const selected = candidates
    .filter((candidate) => candidate.citation_probability >= params.citation_threshold)
    .slice(0, params.max_citations);
  const margin = selected.length ? selected[0].citation_probability - (candidates[selected.length]?.citation_probability ?? 0) : 0;
  if (answerProbability < params.answer_threshold || !selected.length || margin < params.min_margin) {
    return abstain(input.question, `answer_p=${answerProbability.toFixed(3)} citation_count=${selected.length} margin=${margin.toFixed(3)}`, answerProbability, selected);
  }
  const citations = selected.map((candidate) => candidate.evidence_id);
  const claims = selected.map((candidate, index) => ({
    claim_id: `C${index + 1}`,
    claim: candidate.sentence,
    citations: [candidate.evidence_id],
    support_status: "supported",
  }));
  const prediction = {
    answer_type: "grounded_answer",
    evidence_first: {
      sufficiency: "sufficient",
      supported_claims: claims,
      missing_support: "",
      question_target: input.question ?? "exact_question_target",
    },
    answer: `${selected.map((candidate) => candidate.sentence).join(" ")} ${citations.map((id) => `[${id}]`).join(" ")}`,
    citations,
    claim_table: claims.map((claim) => ({ claim: claim.claim, support: "supported", citations: claim.citations })),
    abstention_reason: null,
    _debug: {
      answer_probability: answerProbability,
      selected_citation_probabilities: selected.map((candidate) => [candidate.evidence_id, candidate.citation_probability]),
    },
  };
  return prediction;
}

function answerFeatures(input) {
  const candidates = evidenceCandidates(input);
  const top = candidates[0] ?? emptyCandidate();
  const second = candidates[1] ?? emptyCandidate();
  const questionTokens = tokenSet(input.question);
  const abstractTokens = tokenSet(input.document_metadata?.abstract);
  const abstractOverlap = overlapCount(questionTokens, abstractTokens) / Math.max(1, questionTokens.size);
  return [
    top.overlap,
    second.overlap,
    top.lexical_score - second.lexical_score,
    top.density,
    top.section_match,
    numberSet(input.question).size > 0 ? 1 : 0,
    candidates.some((candidate) => candidate.numeric_match > 0) ? 1 : 0,
    Math.min(1, tokenList(input.question).length / 16),
    Math.min(1, (input.compact_retrieved_evidence_pack ?? []).length / 6),
    Boolean(input.document_metadata?.counterfactual) ? 1 : 0,
    isRiskyQuestion(input.question) ? 1 : 0,
    isComparisonQuestion(input.question) ? 1 : 0,
    /\b(how much|how many|percentage|percent|fewer|more)\b/i.test(input.question ?? "") ? 1 : 0,
    /\b(which|what are|list|three|two)\b/i.test(input.question ?? "") ? 1 : 0,
    hasMetric(top.sentence) ? 1 : 0,
    abstractOverlap,
  ];
}

function citationFeatures(input, candidate) {
  const questionTokens = tokenSet(input.question);
  const abstractTokens = tokenSet(input.document_metadata?.abstract);
  return [
    candidate.overlap,
    candidate.density,
    1 / Math.max(1, candidate.retrieval_rank),
    candidate.section_match,
    candidate.numeric_match,
    hasMetric(candidate.sentence) ? 1 : 0,
    Math.min(1, tokenList(candidate.sentence).length / 80),
    questionTokens.size ? overlapCount(questionTokens, tokenSet(candidate.sentence)) / questionTokens.size : 0,
    overlapCount(abstractTokens, tokenSet(candidate.sentence)) / Math.max(1, Math.min(40, abstractTokens.size)),
    candidate.candidate_rank === 1 ? 1 : 0,
  ];
}

function evidenceCandidates(input) {
  const questionTokens = tokenSet(input.question);
  const questionNumbers = numberSet(input.question);
  const candidates = [];
  for (const evidence of input.compact_retrieved_evidence_pack ?? []) {
    const sentences = splitSentences(evidence.text);
    const best = sentences.map((sentence) => scoreSentence(input, evidence, sentence, questionTokens, questionNumbers))
      .sort((left, right) => right.lexical_score - left.lexical_score)[0] ?? scoreSentence(input, evidence, evidence.text, questionTokens, questionNumbers);
    candidates.push(best);
  }
  return candidates.sort((left, right) => right.lexical_score - left.lexical_score || left.retrieval_rank - right.retrieval_rank || left.evidence_id.localeCompare(right.evidence_id))
    .map((candidate, index) => ({ ...candidate, candidate_rank: index + 1 }));
}

function scoreSentence(input, evidence, sentence, questionTokens, questionNumbers) {
  const combined = `${evidence.section ?? ""} ${sentence}`;
  const tokens = tokenList(combined);
  const tokenSetValue = new Set(tokens);
  const overlap = questionTokens.size ? overlapCount(questionTokens, tokenSetValue) / questionTokens.size : 0;
  const density = tokens.length ? overlapCount(questionTokens, tokenSetValue) / tokens.length : 0;
  const numericMatch = [...numberSet(sentence)].some((number) => questionNumbers.has(number)) ? 1 : 0;
  const sectionMatch = sectionMatchesQuestion(input.question, evidence.section) ? 1 : 0;
  const lexicalScore = overlap + density + (numericMatch ? 0.1 : 0) + (sectionMatch ? 0.05 : 0) - (0.015 * (Number(evidence.retrieval_rank ?? 1) - 1));
  return {
    evidence_id: evidence.evidence_id,
    retrieval_rank: Number(evidence.retrieval_rank ?? 1),
    section: evidence.section ?? "",
    sentence: cleanSentence(sentence),
    overlap,
    density,
    numeric_match: numericMatch,
    section_match: sectionMatch,
    lexical_score: lexicalScore,
  };
}

function trainLogistic(rows, scaler, options) {
  const dim = rows[0]?.x.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.x, scaler);
      const prediction = sigmoid(dot(weights, x) + intercept);
      const error = prediction - row.y;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= options.learningRate * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) {
      weights[i] -= options.learningRate * ((grad[i] / n) + (options.l2 * weights[i]));
    }
  }
  return { weights, intercept };
}

function predictProb(model, scaler, features) {
  return sigmoid(dot(model.weights, scale(features, scaler)) + model.intercept);
}

function makeScaler(rows) {
  const dim = rows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of rows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, rows.length);
  for (const row of rows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, rows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function scorePrediction(prediction, target) {
  const answerTypeCorrect = prediction.answer_type === target?.answer_type;
  const citationSetExact = prediction.answer_type === "abstain"
    ? (prediction.citations ?? []).length === 0
    : sameCitationSet(prediction.citations, target?.citations ?? []);
  return {
    target_answer_type: target?.answer_type,
    answer_type_correct: answerTypeCorrect,
    citation_set_exact: citationSetExact,
    contract_correct: answerTypeCorrect && citationSetExact,
  };
}

function abstain(question, reason, answerProbability, selected) {
  return {
    answer_type: "abstain",
    evidence_first: {
      sufficiency: "insufficient",
      supported_claims: [],
      missing_support: `Learned repaired selector did not find enough calibrated support for ${question ?? "the question"} (${reason}).`,
      question_target: question ?? "exact_question_target",
    },
    answer: "",
    citations: [],
    claim_table: [],
    abstention_reason: "The learned local answerability/citation selector did not find enough calibrated support in the evidence pack.",
    _debug: {
      answer_probability: answerProbability,
      selected_citation_probabilities: (selected ?? []).map((candidate) => [candidate.evidence_id, candidate.citation_probability]),
    },
  };
}

function compareCandidates(left, right) {
  for (const key of ["contract_correct_rate", "answer_type_accuracy", "citation_set_exact_rate"]) {
    const delta = Number(right.tune[key]) - Number(left.tune[key]);
    if (Math.abs(delta) > 1e-12) return delta;
  }
  return left.tune.answer_rate - right.tune.answer_rate;
}

function statusFor(validationMetrics, baseline) {
  if (validationMetrics.contract_correct > baseline.constrained_hybrid_contract_correct) {
    return "learned_repaired_selector_beats_existing_validation_baselines";
  }
  if (validationMetrics.contract_correct > baseline.train_calibrated_scaffold_contract_correct) {
    return "learned_repaired_selector_beats_scaffold_not_hybrid";
  }
  return "learned_repaired_selector_does_not_beat_existing_validation_baselines";
}

function nextStepFor(validationMetrics, baseline) {
  if (validationMetrics.contract_correct > baseline.constrained_hybrid_contract_correct) {
    return "Hold this selector for a fresh, leakage-safe validation slice before any paid judge or larger Prime model.";
  }
  return "Do not spend on paid judging or Prime. The local learned selector is not stronger than the current zero-spend validation baselines.";
}

function isRiskyQuestion(question) {
  return /\b(percentage|percent|how many|how much|statistically significant|which are three|compare|difference|ratio|previous state.of.the.art|fewer|more)\b/i.test(question ?? "");
}

function isComparisonQuestion(question) {
  return /\b(compare|compared|versus|vs|over|than|fewer|more|previous|state.of.the.art|difference)\b/i.test(question ?? "");
}

function sectionMatchesQuestion(question, section) {
  const questionText = String(question ?? "").toLowerCase();
  const sectionText = String(section ?? "").toLowerCase();
  return Boolean(sectionText && questionText.split(/\W+/).some((token) => token.length > 4 && sectionText.includes(token)));
}

function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean).slice(0, 7);
}

function cleanSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
}

function tokenList(text) {
  return String(text ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ").split(/[^a-z0-9.]+/).filter((token) => token.length > 1 && !stopwords.has(token));
}

function tokenSet(text) {
  return new Set(tokenList(text));
}

function numberSet(text) {
  return new Set([...String(text ?? "").matchAll(/\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b/g)].map((match) => match[0]));
}

function hasMetric(text) {
  return /\b\d+(?:[,.]\d+)*(?:\.\d+)?%?\b|rouge|accuracy|f1|score|table|significant|p\s*[<=>]/i.test(text ?? "");
}

function overlapCount(leftSet, rightSet) {
  let total = 0;
  for (const value of leftSet) if (rightSet.has(value)) total += 1;
  return total;
}

function emptyCandidate() {
  return {
    evidence_id: "",
    retrieval_rank: 99,
    sentence: "",
    overlap: 0,
    density: 0,
    numeric_match: 0,
    section_match: 0,
    lexical_score: 0,
  };
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function sameCitationSet(left, right) {
  const leftSet = new Set(normalizeCitations(left));
  const rightSet = new Set(normalizeCitations(right));
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function normalizeCitations(citations) {
  return (Array.isArray(citations) ? citations : []).map((citation) => String(typeof citation === "object" ? citation.evidence_id ?? citation.id ?? "" : citation)).filter(Boolean);
}

function renderReport(result) {
  return `# Learned Repaired Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Metrics

| Split | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
| Train tune | ${result.metrics.train_tune.answered}/${result.metrics.train_tune.examples} | ${result.metrics.train_tune.contract_correct}/${result.metrics.train_tune.examples} (${pct(result.metrics.train_tune.contract_correct_rate)}) | ${pct(result.metrics.train_tune.answer_type_accuracy)} | ${pct(result.metrics.train_tune.citation_set_exact_rate)} |
| Train heldout | ${result.metrics.train_heldout.answered}/${result.metrics.train_heldout.examples} | ${result.metrics.train_heldout.contract_correct}/${result.metrics.train_heldout.examples} (${pct(result.metrics.train_heldout.contract_correct_rate)}) | ${pct(result.metrics.train_heldout.answer_type_accuracy)} | ${pct(result.metrics.train_heldout.citation_set_exact_rate)} |
| Repaired validation | ${result.metrics.repaired_validation_gate.answered}/${result.metrics.repaired_validation_gate.examples} | ${result.metrics.repaired_validation_gate.contract_correct}/${result.metrics.repaired_validation_gate.examples} (${pct(result.metrics.repaired_validation_gate.contract_correct_rate)}) | ${pct(result.metrics.repaired_validation_gate.answer_type_accuracy)} | ${pct(result.metrics.repaired_validation_gate.citation_set_exact_rate)} |

## Baseline Comparison

- Train-calibrated scaffold: ${result.baseline_comparison.train_calibrated_scaffold_contract_correct}/70
- Constrained Qwen/scaffold hybrid: ${result.baseline_comparison.constrained_hybrid_contract_correct}/70
- Train-selected constrained policy: ${result.baseline_comparison.train_selected_constrained_policy_contract_correct}/70
- Learned repaired selector: ${result.baseline_comparison.selected_validation_contract_correct}/70
- Delta vs scaffold: ${result.baseline_comparison.delta_vs_train_calibrated_scaffold}
- Delta vs hybrid: ${result.baseline_comparison.delta_vs_constrained_hybrid}
- Delta vs train-selected constrained policy: ${result.baseline_comparison.delta_vs_train_selected_constrained_policy}

## Decision

- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Promote as final scaffold: ${result.decision.promote_as_final_scaffold ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
