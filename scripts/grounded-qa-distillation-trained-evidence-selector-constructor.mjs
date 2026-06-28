import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runDir = path.join(experimentDir, "runs");
const reportDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "trained-evidence-selector-constructor-final-window-2026-06-27-v1";
const dataFile = args["data-file"] ?? "extended_temporal_future_holdout.jsonl";
const trainStart = numberArg(args["train-start"], 0);
const trainEnd = numberArg(args["train-end"], 240);
const tuneStart = numberArg(args["tune-start"], 240);
const tuneEnd = numberArg(args["tune-end"], 320);
const evalStart = numberArg(args["eval-start"], 320);
const evalEnd = numberArg(args["eval-end"], 389);
const thresholdGrid = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];

const outputDir = path.join(runDir, runId);
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });

const rows = (await readJsonl(path.join(dataDir, dataFile))).map(toRow);
const trainRows = rows.slice(trainStart, trainEnd);
const tuneRows = rows.slice(tuneStart, tuneEnd);
const evalRows = rows.slice(evalStart, evalEnd);

const evidenceSelector = trainEvidenceSelector(trainRows);
const spanSelector = trainSpanSelector(trainRows);
const sufficiencyModel = trainSufficiencyModel(trainRows, evidenceSelector);
const tuneSweeps = thresholdGrid.map((threshold) => evaluate(tuneRows, threshold, "tune"));
const selected = chooseThreshold(tuneSweeps);
const evalResult = evaluate(evalRows, selected.threshold, "eval");
const evalSweeps = thresholdGrid.map((threshold) => evaluate(evalRows, threshold, "eval_sweep"));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "trained_evidence_selector_constructor",
  status: classify(evalResult.metrics),
  purpose: "Test whether a leakage-safe local evidence selector trained on earlier gold evidence ids can fix the support-selection failure seen in the naive constrained span constructor.",
  data: {
    source_file: path.join("docs/experiments/grounded-qa-distillation/data", dataFile),
    train_window: { id: `${trainStart}-${trainEnd}`, start_index_inclusive: trainStart, end_index_exclusive: trainEnd, examples: trainRows.length },
    tune_window: { id: `${tuneStart}-${tuneEnd}`, start_index_inclusive: tuneStart, end_index_exclusive: tuneEnd, examples: tuneRows.length },
    eval_window: { id: `${evalStart + 1}-${evalEnd}`, start_index_inclusive: evalStart, end_index_exclusive: evalEnd, examples: evalRows.length },
    leakage_control: "Evidence/span/sufficiency models train only on rows before 240; threshold selection uses 240-320; final 321-389 labels are evaluation-only.",
  },
  method: {
    type: "zero_llm_trained_evidence_selector_plus_constrained_span_constructor",
    prediction: "Rank evidence items with a weighted logistic selector trained on earlier gold citations, score sufficiency from the top evidence probabilities, abstain below the tuned threshold, otherwise emit one selected span with an inline citation.",
    selected_threshold: selected.threshold,
    threshold_selection_objective: "On the tune window, prefer answer_rate >= 50% and reference-citation-supported answers >= 60% when possible; then maximize support-first metrics.",
  },
  models: {
    evidence_selector: summarizeModel(evidenceSelector),
    span_selector: summarizeModel(spanSelector),
    sufficiency: summarizeModel(sufficiencyModel),
  },
  tune_threshold_sweep: tuneSweeps.map(({ predictions: _predictions, ...row }) => row),
  eval_threshold_sweep_for_diagnosis_only: evalSweeps.map(({ predictions: _predictions, ...row }) => row),
  tune: selected.metrics,
  eval: evalResult.metrics,
  interpretation: interpret(evalResult.metrics),
  budget: await readBudget(),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Local deterministic trained selector; no OpenAI calls, no Prime/GPU launch.",
  },
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), evalResult.predictions);
await fs.writeFile(path.join(outputDir, "trained-evidence-selector-model.json"), `${JSON.stringify({
  evidence_selector: evidenceSelector,
  span_selector: spanSelector,
  sufficiency: sufficiencyModel,
}, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  selected_threshold: selected.threshold,
  tune: selected.metrics,
  eval: evalResult.metrics,
  status: result.status,
}, null, 2));

function toRow(row) {
  const citations = (row.output?.citations ?? []).map((citation) => typeof citation === "string" ? citation : citation.evidence_id).filter(Boolean);
  return {
    example_id: row.example_id,
    source_split: row.source_split,
    input: row.input,
    teacher_trace: row.teacher_trace,
    reference: {
      answer_type: row.output?.answer_type === "grounded_answer" ? "grounded_answer" : "abstain",
      answer: String(row.output?.answer ?? ""),
      citations,
      claim_table: Array.isArray(row.output?.claim_table) ? row.output.claim_table : [],
      abstention_reason: row.output?.abstention_reason ?? null,
    },
  };
}

function trainEvidenceSelector(rows) {
  const candidates = [];
  for (const row of rows) {
    const gold = goldEvidenceIds(row);
    for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
      candidates.push({
        features: evidenceFeatures(row, evidence),
        label: row.reference.answer_type === "grounded_answer" && gold.has(evidence.evidence_id) ? 1 : 0,
      });
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["evidence-epochs"], 160),
    learningRate: numericArg(args["evidence-learning-rate"], 0.12),
    l2: numericArg(args["evidence-l2"], 0.001),
  });
}

function trainSpanSelector(rows) {
  const candidates = [];
  for (const row of rows) {
    if (row.reference.answer_type !== "grounded_answer") continue;
    const gold = goldEvidenceIds(row);
    for (const evidence of row.input.compact_retrieved_evidence_pack ?? []) {
      if (!gold.has(evidence.evidence_id)) continue;
      const spans = candidateSpans(evidence.text);
      if (!spans.length) continue;
      const scored = spans.map((span) => ({ span, score: tokenF1(span, row.reference.answer) }));
      const best = Math.max(...scored.map((item) => item.score));
      for (const item of scored) {
        candidates.push({
          features: spanFeatures(row, evidence, item.span),
          label: best > 0 && item.score >= Math.max(0.16, best * 0.7) ? 1 : 0,
        });
      }
    }
  }
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["span-epochs"], 130),
    learningRate: numericArg(args["span-learning-rate"], 0.1),
    l2: numericArg(args["span-l2"], 0.001),
  });
}

function trainSufficiencyModel(rows, evidenceSelector) {
  const candidates = rows.map((row) => {
    const ranked = rankEvidence(row, evidenceSelector).slice(0, 3);
    return {
      features: sufficiencyFeatures(row, ranked),
      label: row.reference.answer_type === "grounded_answer" ? 1 : 0,
    };
  });
  return trainWeightedLogistic(candidates, {
    epochs: numberArg(args["sufficiency-epochs"], 180),
    learningRate: numericArg(args["sufficiency-learning-rate"], 0.1),
    l2: numericArg(args["sufficiency-l2"], 0.001),
  });
}

function evaluate(rows, threshold, splitName) {
  const predictions = rows.map((row) => {
    const prediction = predict(row, threshold);
    const reference = row.reference;
    const answered = prediction.answer_type === "grounded_answer";
    const answerable = reference.answer_type === "grounded_answer";
    const referenceCitations = new Set(reference.citations);
    const citedGold = answered ? prediction.citations.filter((id) => referenceCitations.has(id)).length : 0;
    return {
      example_id: row.example_id,
      source_split: row.source_split,
      system: `trained_evidence_selector_constructor_${splitName}`,
      prediction,
      reference,
      scores: {
        answer_type_correct: prediction.answer_type === reference.answer_type,
        citation_precision: answered && prediction.citations.length ? citedGold / prediction.citations.length : null,
        citation_recall: answerable && reference.citations.length ? citedGold / reference.citations.length : null,
        answer_token_f1: answerable ? (answered ? tokenF1(prediction.answer, reference.answer) : 0) : null,
        abstention_correct: answerable ? !answered : !answered,
        inline_citation_rate: answered
          ? prediction.citations.filter((id) => prediction.answer.includes(`[${id}]`)).length / Math.max(1, prediction.citations.length)
          : null,
        sufficiency_probability: prediction.metadata?.sufficiency_probability ?? null,
        selected_evidence_probability: prediction.metadata?.selected_evidence_probability ?? null,
      },
    };
  });
  return { threshold, metrics: summarizePredictions(predictions), predictions };
}

function predict(row, threshold) {
  const ranked = rankEvidence(row, evidenceSelector).slice(0, 3);
  const sufficiency = sigmoid(scoreFeatures(sufficiencyModel.weights, sufficiencyFeatures(row, ranked)));
  const selected = ranked[0];
  if (!selected || sufficiency < threshold) {
    return {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "Evidence is insufficient to answer.", support: "abstention", citations: [] }],
      abstention_reason: selected ? `Sufficiency ${sufficiency.toFixed(3)} below threshold ${threshold}.` : "No usable evidence found.",
      metadata: {
        sufficiency_probability: sufficiency,
        selected_evidence_id: selected?.evidence.evidence_id ?? null,
        selected_evidence_probability: selected?.probability ?? null,
        ranked_evidence: ranked.map(toRankedMetadata),
      },
    };
  }
  const span = selectSpan(row, selected.evidence, spanSelector);
  const answer = `${span || firstUsefulSentence(selected.evidence.text)} [${selected.evidence.evidence_id}]`;
  return {
    answer_type: "grounded_answer",
    answer,
    citations: [selected.evidence.evidence_id],
    claim_table: [{ claim: stripCitations(answer), support: "selected_by_trained_evidence_selector", citations: [selected.evidence.evidence_id] }],
    abstention_reason: null,
    metadata: {
      sufficiency_probability: sufficiency,
      selected_evidence_id: selected.evidence.evidence_id,
      selected_evidence_probability: selected.probability,
      selected_section: selected.evidence.section ?? "",
      selected_retrieval_rank: selected.evidence.retrieval_rank ?? null,
      ranked_evidence: ranked.map(toRankedMetadata),
    },
  };
}

function rankEvidence(row, model) {
  return (row.input.compact_retrieved_evidence_pack ?? [])
    .map((evidence) => ({
      evidence,
      probability: sigmoid(scoreFeatures(model.weights, evidenceFeatures(row, evidence))),
    }))
    .sort((left, right) => right.probability - left.probability || Number(left.evidence.retrieval_rank ?? 99) - Number(right.evidence.retrieval_rank ?? 99));
}

function selectSpan(row, evidence, model) {
  const spans = candidateSpans(evidence.text);
  if (!spans.length) return "";
  const scored = spans
    .map((span, index) => ({ span, index, probability: sigmoid(scoreFeatures(model.weights, spanFeatures(row, evidence, span))) }))
    .sort((left, right) => right.probability - left.probability || left.index - right.index);
  return truncateAtWord(scored[0].span, 320);
}

function evidenceFeatures(row, evidence) {
  const questionTokens = contentTokens(row.input.question);
  const evidenceTokens = contentTokens(evidence.text);
  const sectionTokens = contentTokens(evidence.section ?? "");
  const titleTokens = contentTokens(row.input.document_metadata?.title ?? "");
  const qSet = new Set(questionTokens);
  const eSet = new Set(evidenceTokens);
  const overlap = [...qSet].filter((token) => eSet.has(token)).length;
  const numberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result|f1|rouge|bleu|improve|improvement|increase|decrease)\b/i.test(row.input.question);
  const yesNoIntent = /^(is|are|was|were|do|does|did|can|could|has|have|had)\b/i.test(row.input.question);
  const features = {
    bias: 1,
    reciprocal_rank: 1 / Math.max(1, Number(evidence.retrieval_rank ?? 99)),
    question_jaccard: jaccard(questionTokens, evidenceTokens),
    question_coverage: qSet.size ? overlap / qSet.size : 0,
    evidence_coverage: eSet.size ? overlap / eSet.size : 0,
    section_overlap: jaccard(questionTokens, sectionTokens),
    title_overlap: jaccard(questionTokens, titleTokens),
    log_length: Math.min(1, Math.log1p(evidenceTokens.length) / 7),
    number_match: numberIntent && /\d|percent|point|score|rouge|bleu|f1/i.test(evidence.text) ? 1 : 0,
    yes_no_evidence: yesNoIntent && /\b(show|shown|evidence|suggest|demonstrat|indicat|find|found|observe|report|benefit|improv)\w*\b/i.test(evidence.text) ? 1 : 0,
    result_section: /\b(result|experiment|evaluation|analysis|table|figure|performance)\b/i.test(evidence.section ?? "") ? 1 : 0,
    answerish_text: /\b(result|show|shown|found|observe|improve|outperform|perform|achiev|score|accuracy|evidence|because|therefore|suggest)\w*\b/i.test(evidence.text) ? 1 : 0,
    counterfactual_flag: row.input.document_metadata?.counterfactual ? 1 : 0,
  };
  for (const token of questionTokens.slice(0, 18)) {
    if (eSet.has(token)) features[`qtok:${token}`] = 1;
  }
  for (const token of sectionTokens.slice(0, 8)) features[`section:${token}`] = 1;
  return features;
}

function spanFeatures(row, evidence, span) {
  const questionTokens = contentTokens(row.input.question);
  const spanTokens = contentTokens(span);
  const qSet = new Set(questionTokens);
  const sSet = new Set(spanTokens);
  const overlap = [...qSet].filter((token) => sSet.has(token)).length;
  const numberIntent = /\b(how many|how much|number|size|score|accuracy|percent|percentage|count|result|f1|rouge|bleu|improve|improvement|increase|decrease)\b/i.test(row.input.question);
  const yesNoIntent = /^(is|are|was|were|do|does|did|can|could|has|have|had)\b/i.test(row.input.question);
  return {
    bias: 1,
    question_jaccard: jaccard(questionTokens, spanTokens),
    question_coverage: qSet.size ? overlap / qSet.size : 0,
    section_overlap: jaccard(questionTokens, contentTokens(evidence.section ?? "")),
    log_span_length: Math.min(1, Math.log1p(spanTokens.length) / 6),
    short_span: spanTokens.length <= 18 ? 1 : 0,
    medium_span: spanTokens.length > 18 && spanTokens.length <= 48 ? 1 : 0,
    too_long: spanTokens.length > 70 ? 1 : 0,
    number_match: numberIntent && /\d|percent|point|score|rouge|bleu|f1/i.test(span) ? 1 : 0,
    yes_no_match: yesNoIntent && /\b(show|shown|evidence|suggest|demonstrat|indicat|find|found|observe|report|yes|no|benefit|improv)\w*\b/i.test(span) ? 1 : 0,
    answerish_text: /\b(result|show|shown|found|observe|improve|outperform|perform|achiev|score|accuracy|evidence|because|therefore|suggest)\w*\b/i.test(span) ? 1 : 0,
  };
}

function sufficiencyFeatures(row, ranked) {
  const probabilities = ranked.map((item) => item.probability);
  const mergedText = ranked.map((item) => item.evidence.text).join(" ");
  return {
    bias: 1,
    top_probability: probabilities[0] ?? 0,
    second_probability: probabilities[1] ?? 0,
    third_probability: probabilities[2] ?? 0,
    probability_gap: (probabilities[0] ?? 0) - (probabilities[1] ?? 0),
    mean_probability: mean(probabilities),
    top_question_overlap: ranked[0] ? evidenceFeatures(row, ranked[0].evidence).question_coverage : 0,
    merged_question_jaccard: jaccard(contentTokens(row.input.question), contentTokens(mergedText)),
    has_number_match: /\d/.test(mergedText) && /\b(how many|number|score|accuracy|percent|percentage|count|rouge|bleu|f1)\b/i.test(row.input.question) ? 1 : 0,
    counterfactual_flag: row.input.document_metadata?.counterfactual ? 1 : 0,
  };
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

function chooseThreshold(results) {
  const supportViable = results.filter((row) => row.metrics.answer_rate >= 0.5 && row.metrics.reference_citation_supported_answer_rate >= 0.6);
  const coverageViable = results.filter((row) => row.metrics.answer_rate >= 0.5);
  const pool = supportViable.length ? supportViable : coverageViable.length ? coverageViable : results;
  return [...pool].sort((left, right) => objective(right.metrics) - objective(left.metrics) || right.metrics.answer_rate - left.metrics.answer_rate)[0];
}

function objective(metrics) {
  return (2 * metrics.reference_citation_supported_answer_rate) + metrics.citation_recall + metrics.answer_token_f1 + (0.5 * metrics.answer_type_accuracy);
}

function summarizePredictions(predictions) {
  const answeredRows = predictions.filter((row) => row.prediction.answer_type === "grounded_answer");
  const answerableRows = predictions.filter((row) => row.reference.answer_type === "grounded_answer");
  const unsupportedByReferenceCitation = answeredRows.filter((row) => {
    const refs = new Set(row.reference.citations);
    return !row.prediction.citations.some((id) => refs.has(id));
  }).length;
  return {
    examples: predictions.length,
    answered: answeredRows.length,
    abstained: predictions.length - answeredRows.length,
    reference_answerable: answerableRows.length,
    answer_rate: mean(predictions.map((row) => row.prediction.answer_type === "grounded_answer")),
    answer_type_accuracy: mean(predictions.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(predictions.map((row) => row.scores.citation_precision)),
    citation_recall: mean(predictions.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(predictions.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(predictions.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(predictions.map((row) => row.scores.inline_citation_rate)),
    reference_citation_supported_answer_rate: answeredRows.length ? (answeredRows.length - unsupportedByReferenceCitation) / answeredRows.length : 0,
    unsupported_by_reference_citation: unsupportedByReferenceCitation,
  };
}

function classify(metrics) {
  if (metrics.answer_rate >= 0.7 && metrics.reference_citation_supported_answer_rate >= 0.66) return "support_preserving_zero_llm_scaffold_candidate";
  if (metrics.reference_citation_supported_answer_rate >= 0.66 && metrics.answer_rate < 0.7) return "support_preserving_but_coverage_limited";
  return "coverage_or_support_limited_negative";
}

function interpret(metrics) {
  return {
    supports_as_final_scaffold: metrics.answer_rate >= 0.7 && metrics.reference_citation_supported_answer_rate >= 0.66,
    needs_paid_judge_before_pareto: metrics.answer_rate >= 0.5 && metrics.reference_citation_supported_answer_rate >= 0.5,
    next_step: metrics.answer_rate >= 0.5 && metrics.reference_citation_supported_answer_rate >= 0.5
      ? "Run a bounded paid support judge on this trained-selector surface before adding it to the cost/coverage/support Pareto table."
      : "Do not spend on judging this exact trained-selector surface; improve model features/training data or use it as a negative control.",
    conclusion: "This isolates whether support selection is learnable from prior-window gold citations without per-query LLM calls.",
  };
}

function renderReport(result) {
  const sweepRows = result.tune_threshold_sweep.map((row) => (
    `| ${row.threshold} | ${row.metrics.answered} | ${pct(row.metrics.answer_rate)} | ${pct(row.metrics.reference_citation_supported_answer_rate)} | ${pct(row.metrics.citation_recall)} | ${pct(row.metrics.answer_token_f1)} | ${pct(row.metrics.answer_type_accuracy)} |`
  )).join("\n");
  const evalSweepRows = result.eval_threshold_sweep_for_diagnosis_only.map((row) => (
    `| ${row.threshold} | ${row.metrics.answered} | ${pct(row.metrics.answer_rate)} | ${pct(row.metrics.reference_citation_supported_answer_rate)} | ${pct(row.metrics.citation_recall)} | ${pct(row.metrics.answer_token_f1)} | ${pct(row.metrics.answer_type_accuracy)} |`
  )).join("\n");
  return `# Trained Evidence Selector Constructor

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Purpose

Test whether a zero-LLM trained evidence selector fixes the support-selection failure from the hand-weighted constrained span constructor.

## Setup

| Item | Value |
| --- | --- |
| Source file | \`${result.data.source_file}\` |
| Train window | \`${result.data.train_window.id}\` (${result.data.train_window.examples} examples) |
| Tune window | \`${result.data.tune_window.id}\` (${result.data.tune_window.examples} examples) |
| Eval window | \`${result.data.eval_window.id}\` (${result.data.eval_window.examples} examples) |
| Selected threshold | ${result.method.selected_threshold} |
| OpenAI calls | ${result.llm_budget.openai_llm_calls} |
| External compute | $${result.llm_budget.external_compute_cost_usd.toFixed(2)} |

## Tune Threshold Sweep

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${sweepRows}

## Held-Out Final Window

| Examples | Answered | Abstained | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${result.eval.examples} | ${result.eval.answered} | ${result.eval.abstained} | ${pct(result.eval.answer_rate)} | ${pct(result.eval.reference_citation_supported_answer_rate)} | ${pct(result.eval.citation_recall)} | ${pct(result.eval.answer_token_f1)} | ${pct(result.eval.answer_type_accuracy)} |

## Eval Threshold Sweep For Diagnosis Only

This table uses held-out labels after the threshold has already been selected. It is diagnostic, not a threshold-selection procedure.

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${evalSweepRows}

## Interpretation

${result.interpretation.conclusion}

Next step: ${result.interpretation.next_step}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
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

function goldEvidenceIds(row) {
  const roleGold = Object.entries(row.teacher_trace?.evidence_roles ?? {})
    .filter(([, role]) => String(role).includes("gold"))
    .map(([id]) => id);
  return new Set(roleGold.length ? roleGold : row.reference.citations);
}

function toRankedMetadata(item) {
  return {
    evidence_id: item.evidence.evidence_id,
    probability: item.probability,
    retrieval_rank: item.evidence.retrieval_rank ?? null,
    section: item.evidence.section ?? "",
  };
}

function candidateSpans(text) {
  const sentences = splitSentences(text);
  const spans = [];
  for (const sentence of sentences) {
    spans.push(sentence);
    spans.push(...sentence.split(/;\s+|,\s+(?=(?:which|where|who|and|but|with|show|showing|using|based)\b)/i)
      .map((part) => part.trim())
      .filter((part) => contentTokens(part).length >= 5));
  }
  return [...new Set(spans)].filter(Boolean);
}

function firstUsefulSentence(text) {
  const selected = splitSentences(text).find((part) => contentTokens(part).length >= 5) ?? String(text).trim();
  return truncateAtWord(selected, 320);
}

async function readBudget() {
  try {
    const budget = JSON.parse(await fs.readFile(path.join(experimentDir, "spend", "budget.json"), "utf8"));
    return {
      max_budget_usd: budget.max_budget_usd,
      actual_total_spend_usd: budget.spend_usd?.total_actual,
      remaining_budget_usd: budget.spend_usd?.remaining,
      external_compute_actual_usd: budget.spend_usd?.external_compute,
    };
  } catch {
    return null;
  }
}

function splitSentences(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function contentTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why", "they", "them", "there", "than", "then", "also", "any"]);
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
  return Object.entries(values).reduce((total, [key, value]) => total + (weights[key] ?? 0) * Number(value), 0);
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
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
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
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function numericArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
