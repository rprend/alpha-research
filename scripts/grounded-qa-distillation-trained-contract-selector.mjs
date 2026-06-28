import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const dataDir = path.join(experimentDir, "data");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "extended_temporal_future_holdout";
const trainOffset = numberArg(args["train-offset"], 240, { allowZero: true });
const trainLimit = numberArg(args["train-limit"], 80);
const evalOffset = numberArg(args["eval-offset"], 320, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 69);
const runId = args["run-id"] ?? "trained-contract-selector-240-320-to-321-389-v1";
const outputDir = path.join(runsDir, runId);

const trainCandidateSpecs = [
  {
    id: "direct_mini_repair",
    family: "openai_mini_scaffold",
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  },
  {
    id: "balanced_risk_gate",
    family: "openai_mini_scaffold",
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
    judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    id: "claim_entailment_guard",
    family: "openai_mini_scaffold",
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
    predictionFilter: (row) => row.window === "241-320",
  },
];

const evalCandidateSpecs = [
  {
    id: "direct_mini_repair",
    family: "openai_mini_scaffold",
    predictionRunId: "citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  },
  {
    id: "balanced_risk_gate",
    family: "openai_mini_scaffold",
    predictionRunId: "risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
    judgeRunId: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
  {
    id: "claim_entailment_guard",
    family: "openai_mini_scaffold",
    predictionRunId: "claim-entailment-guard-balanced-risk-gate-240-389-v1",
    judgeRunId: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
    predictionFilter: (row) => row.window === "321-389",
  },
  ...[
    ["qwen3b_v1", "qwen3b_lora", "joint-action-qwen3b-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1-citation-repair"],
    ["qwen3b_v3", "qwen3b_lora", "joint-action-qwen3b-v3-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen3b-v3-smoke-eval-v1-citation-repair"],
    ["qwen3b_v4", "qwen3b_lora", "joint-action-qwen3b-v4-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen3b-v4-smoke-eval-v1-citation-repair"],
    ["qwen7b_v4", "qwen7b_lora", "joint-action-qwen7b-v4-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair"],
    ["qwen7b_v5", "qwen7b_lora", "joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair"],
    ["qwen7b_v6", "qwen7b_lora", "joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair"],
    ["qwen7b_v7", "qwen7b_lora", "joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair", "openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair"],
    ["qwen7b_v8", "qwen7b_lora", "joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8", "openai-judge-gpt4o-joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8"],
    ["qwen7b_v9", "qwen7b_lora", "joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair"],
    ["qwen7b_v10", "qwen7b_lora", "joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-answer-completion-v10-citation-repair"],
    ["qwen7b_v11", "qwen7b_lora", "joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-mixed-metric-v11-citation-repair"],
    ["qwen7b_v12", "qwen7b_lora", "joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair", "openai-judge-gpt4o-joint-action-qwen7b-support-targeted-v12-citation-repair"],
  ].map(([id, family, predictionRunId, judgeRunId]) => ({ id, family, predictionRunId, judgeRunId })),
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const trainReferences = references.slice(trainOffset, trainOffset + trainLimit);
const evalReferences = references.slice(evalOffset, evalOffset + evalLimit);
const trainRows = await buildRows(trainReferences, trainCandidateSpecs);
const evalRows = await buildRows(evalReferences, evalCandidateSpecs);
const featureNames = featureVector(trainRows[0].candidates[0]).names;
const trainExamples = trainRows.flatMap((row) => row.candidates.map((candidate) => ({
  x: featureVector(candidate).values,
  y: candidate.judged_correct ? 1 : 0,
})));
const model = trainLogistic(trainExamples, { iterations: 3600, learningRate: 0.08, l2: 0.035 });
const margin = tuneMargin(trainRows, model);
const selectedTrainRows = selectRows(trainRows, model, margin);
const selectedEvalRows = selectRows(evalRows, model, margin);
const oracleEvalRows = evalRows.map(selectOracleRow);
const scaffoldEvalRows = evalRows.map((row) => selectPriority(row, ["claim_entailment_guard", "balanced_risk_gate", "direct_mini_repair"]));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "trained_contract_selector",
  status: statusFor(summarizeSelections(selectedEvalRows), summarizeSelections(oracleEvalRows)),
  purpose: "Train a zero-call logistic verifier on earlier judged scaffold candidates, then apply it to final-window contract-complete expanded candidates.",
  split,
  train_window: { offset: trainOffset, examples: trainRows.length, candidate_rows: trainExamples.length },
  eval_window: { offset: evalOffset, examples: evalRows.length },
  train_candidate_specs: trainCandidateSpecs.map(({ predictionFilter, ...spec }) => spec),
  eval_candidate_specs: evalCandidateSpecs.map(({ predictionFilter, ...spec }) => spec),
  model: {
    type: "logistic_candidate_correctness_verifier",
    feature_names: featureNames,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    bias: model.bias,
    train_loss: model.loss,
    answer_abstention_margin: margin,
  },
  train_metrics: summarizeSelections(selectedTrainRows),
  eval_metrics: summarizeSelections(selectedEvalRows),
  eval_oracle_metrics: summarizeSelections(oracleEvalRows),
  scaffold_priority_metrics: summarizeSelections(scaffoldEvalRows),
  eval_policy_mix: groupCount(selectedEvalRows.map((row) => row.selected_candidate_id)),
  gap_analysis: {
    eval_minus_scaffold_answer_rate: summarizeSelections(selectedEvalRows).answer_rate - summarizeSelections(scaffoldEvalRows).answer_rate,
    eval_minus_scaffold_answer_support_rate: summarizeSelections(selectedEvalRows).answer_support_rate - summarizeSelections(scaffoldEvalRows).answer_support_rate,
    eval_minus_scaffold_overall_correct_rate: summarizeSelections(selectedEvalRows).overall_judged_correct_rate - summarizeSelections(scaffoldEvalRows).overall_judged_correct_rate,
    oracle_minus_eval_supported_answers: supportedAnswerCount(oracleEvalRows) - supportedAnswerCount(selectedEvalRows),
    oracle_minus_eval_overall_correct_rate: summarizeSelections(oracleEvalRows).overall_judged_correct_rate - summarizeSelections(selectedEvalRows).overall_judged_correct_rate,
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
  },
};

await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), selectedTrainRows);
await writeJsonl(path.join(outputDir, "predictions.jsonl"), selectedEvalRows);
await writeJsonl(path.join(outputDir, "oracle_predictions.jsonl"), oracleEvalRows);
await fs.writeFile(path.join(outputDir, "selector-model.json"), `${JSON.stringify(result.model, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  train_metrics: result.train_metrics,
  eval_metrics: result.eval_metrics,
  eval_oracle_metrics: result.eval_oracle_metrics,
  scaffold_priority_metrics: result.scaffold_priority_metrics,
  gap_analysis: result.gap_analysis,
}, null, 2));

async function buildRows(referenceRows, specs) {
  const loaded = await Promise.all(specs.map(loadCandidateSpec));
  return referenceRows.map((reference) => ({
    example_id: reference.example_id,
    counterfactual: Boolean(reference.input?.document_metadata?.counterfactual),
    reference: {
      answer_type: reference.output.answer_type,
      answer: reference.output.answer,
      citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
    },
    candidates: loaded.flatMap((spec) => buildCandidate(reference, spec)),
  }));
}

async function loadCandidateSpec(spec) {
  const predictions = (await readJsonl(path.join(runsDir, spec.predictionRunId, "predictions.jsonl")))
    .filter(spec.predictionFilter ?? (() => true));
  const judgments = await readJsonl(path.join(runsDir, spec.judgeRunId, "judgments.jsonl"));
  return {
    ...spec,
    predictions: new Map(predictions.map((row) => [row.example_id, row])),
    judgments: new Map(judgments.map((row) => [row.example_id, row])),
  };
}

function buildCandidate(reference, spec) {
  const predictionRow = spec.predictions.get(reference.example_id);
  const judgmentRow = spec.judgments.get(reference.example_id);
  if (!predictionRow || !judgmentRow) return [];
  const prediction = normalizePrediction(predictionRow.prediction ?? {});
  const judgment = judgmentRow.judgment ?? {};
  const contract = answerCitationContract(reference, prediction);
  const answered = prediction.answer_type === "grounded_answer";
  const supportedAnswer = answered && isSupportedAnswer(judgment);
  const supportedAbstention = !answered && isSupportedAbstention(judgment);
  return [{
    id: spec.id,
    family: spec.family,
    prediction_run_id: spec.predictionRunId,
    judge_run_id: spec.judgeRunId,
    prediction,
    judgment,
    answered,
    supported_answer: supportedAnswer,
    supported_abstention: supportedAbstention,
    judged_correct: supportedAnswer || supportedAbstention,
    answer_type_correct: prediction.answer_type === reference.output.answer_type,
    contract,
    features: localFeatures(reference, prediction, spec, contract),
  }];
}

function selectRows(rows, model, margin) {
  return rows.map((row) => {
    const scored = row.candidates.map((candidate) => ({
      ...candidate,
      verifier_score: predict(model, featureVector(candidate).values),
    }));
    const answerCandidates = scored
      .filter((candidate) => candidate.answered && candidate.contract.answer_citation_complete && !row.counterfactual)
      .sort((a, b) => b.verifier_score - a.verifier_score || a.id.localeCompare(b.id));
    const abstentionCandidates = scored
      .filter((candidate) => !candidate.answered)
      .sort((a, b) => b.verifier_score - a.verifier_score || a.id.localeCompare(b.id));
    const bestAnswer = answerCandidates[0] ?? null;
    const bestAbstention = abstentionCandidates[0] ?? syntheticAbstention(row);
    const selected = bestAnswer && bestAnswer.verifier_score >= bestAbstention.verifier_score + margin
      ? bestAnswer
      : bestAbstention;
    return selectionRow(row, selected, scored, "trained_contract_selector");
  });
}

function selectOracleRow(row) {
  const supportedAnswers = row.candidates
    .filter((candidate) => candidate.answered && candidate.supported_answer && candidate.contract.answer_citation_complete && !row.counterfactual)
    .sort((a, b) => b.features.heuristic_score - a.features.heuristic_score || a.id.localeCompare(b.id));
  const selected = supportedAnswers[0]
    ?? row.candidates.find((candidate) => candidate.supported_abstention)
    ?? syntheticAbstention(row);
  return selectionRow(row, selected, row.candidates, "trained_contract_selector_oracle");
}

function selectPriority(row, priority) {
  const selected = priority.map((id) => row.candidates.find((candidate) => candidate.id === id)).find(Boolean)
    ?? row.candidates.find((candidate) => !candidate.answered)
    ?? syntheticAbstention(row);
  return selectionRow(row, selected, row.candidates, "scaffold_priority_selector");
}

function selectionRow(row, selected, candidates, selectorType) {
  return {
    example_id: row.example_id,
    selector_type: selectorType,
    selected_candidate_id: selected.id,
    selected_family: selected.family,
    prediction: selected.prediction,
    reference: row.reference,
    inherited_judgment: selected.judgment ?? null,
    selection_scores: {
      supported_answer: selected.supported_answer,
      supported_abstention: selected.supported_abstention,
      judged_correct: selected.supported_answer || selected.supported_abstention,
      answer_type_correct: selected.answer_type_correct,
      answer_citation_complete: selected.contract?.answer_citation_complete ?? false,
      verifier_score: selected.verifier_score ?? null,
      heuristic_score: selected.features?.heuristic_score ?? null,
    },
    candidate_summary: Object.fromEntries(candidates.map((candidate) => [candidate.id, {
      family: candidate.family,
      answered: candidate.answered,
      supported_answer: candidate.supported_answer,
      supported_abstention: candidate.supported_abstention,
      judged_correct: candidate.judged_correct,
      answer_citation_complete: candidate.contract?.answer_citation_complete ?? false,
      verifier_score: candidate.verifier_score ?? null,
      heuristic_score: candidate.features?.heuristic_score ?? null,
    }])),
  };
}

function tuneMargin(rows, model) {
  const candidates = [-0.45, -0.35, -0.25, -0.15, -0.05, 0, 0.05, 0.1, 0.15, 0.25, 0.35, 0.45];
  let best = null;
  for (const margin of candidates) {
    const metrics = summarizeSelections(selectRows(rows, model, margin));
    if (!best || betterMetrics(metrics, best.metrics)) best = { margin, metrics };
  }
  return best.margin;
}

function betterMetrics(left, right) {
  if (Math.abs(left.overall_judged_correct_rate - right.overall_judged_correct_rate) > 1e-12) {
    return left.overall_judged_correct_rate > right.overall_judged_correct_rate;
  }
  if (Math.abs(left.answer_support_rate - right.answer_support_rate) > 1e-12) {
    return left.answer_support_rate > right.answer_support_rate;
  }
  return left.answer_rate > right.answer_rate;
}

function featureVector(candidate) {
  const names = [
    "is_answer",
    "answer_citation_complete",
    "top_level_count",
    "inline_count",
    "answer_cited_token_coverage",
    "question_answer_overlap",
    "question_cited_overlap",
    "answer_token_count",
    "claim_count",
    "family_openai",
    "family_qwen3b",
    "family_qwen7b",
    "heuristic_score",
  ];
  const f = candidate.features;
  const values = [
    candidate.answered ? 1 : 0,
    candidate.contract.answer_citation_complete ? 1 : 0,
    Math.log1p(candidate.contract.top_level_count ?? 0),
    Math.log1p(candidate.contract.inline_count ?? 0),
    f.answer_cited_token_coverage,
    f.question_answer_overlap,
    f.question_cited_overlap,
    Math.log1p(f.answer_token_count),
    Math.log1p(f.claim_count),
    candidate.family === "openai_mini_scaffold" ? 1 : 0,
    candidate.family === "qwen3b_lora" ? 1 : 0,
    candidate.family === "qwen7b_lora" ? 1 : 0,
    f.heuristic_score,
  ];
  return { names, values };
}

function localFeatures(reference, prediction, spec, contract) {
  if (prediction.answer_type === "abstain") {
    return {
      answer_cited_token_coverage: 0,
      question_answer_overlap: 0,
      question_cited_overlap: 0,
      answer_token_count: 0,
      claim_count: 0,
      heuristic_score: 0.4,
    };
  }
  const evidenceById = new Map(reference.input.compact_retrieved_evidence_pack.map((row) => [row.evidence_id, row]));
  const citedText = prediction.citations.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const answerTokens = contentTokens(prediction.answer);
  const questionTokens = contentTokens(reference.input.question);
  const citedTokens = contentTokens(citedText);
  const familyPrior = spec.family === "openai_mini_scaffold" ? 0.18 : spec.id === "qwen7b_v4" ? 0.1 : 0;
  const heuristic = contract.answer_citation_complete
    ? familyPrior + 0.3 + 0.3 * tokenCoverage(answerTokens, citedTokens) + 0.15 * tokenCoverage(questionTokens, answerTokens)
    : -1;
  return {
    answer_cited_token_coverage: tokenCoverage(answerTokens, citedTokens),
    question_answer_overlap: tokenCoverage(questionTokens, answerTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    answer_token_count: answerTokens.length,
    claim_count: prediction.claim_table.length,
    heuristic_score: heuristic,
  };
}

function answerCitationContract(reference, prediction) {
  if (prediction.answer_type !== "grounded_answer") {
    return { answer_citation_complete: true, top_level_valid: true, inline_valid: true, top_level_count: 0, inline_count: 0 };
  }
  const evidenceIds = new Set(reference.input.compact_retrieved_evidence_pack.map((row) => row.evidence_id));
  const inline = extractInlineCitationIds(prediction.answer);
  const topLevelValid = prediction.citations.length > 0 && prediction.citations.every((id) => evidenceIds.has(id));
  const inlineValid = inline.length > 0 && inline.every((id) => evidenceIds.has(id));
  return {
    answer_citation_complete: topLevelValid && inlineValid,
    top_level_valid: topLevelValid,
    inline_valid: inlineValid,
    top_level_count: prediction.citations.length,
    inline_count: inline.length,
  };
}

function summarizeSelections(rows) {
  const answered = rows.filter((row) => row.prediction?.answer_type === "grounded_answer");
  const abstained = rows.filter((row) => row.prediction?.answer_type === "abstain");
  const supportedAnswers = answered.filter((row) => row.selection_scores.supported_answer);
  const supportedAbstentions = abstained.filter((row) => row.selection_scores.supported_abstention);
  return {
    examples: rows.length,
    answered: answered.length,
    abstained: abstained.length,
    answer_rate: ratio(answered.length, rows.length),
    answer_support_rate: ratio(supportedAnswers.length, answered.length),
    abstention_support_rate: ratio(supportedAbstentions.length, abstained.length),
    overall_judged_correct_rate: ratio(supportedAnswers.length + supportedAbstentions.length, rows.length),
    answer_type_accuracy: ratio(rows.filter((row) => row.selection_scores.answer_type_correct).length, rows.length),
    answer_citation_complete_rate: ratio(answered.filter((row) => row.selection_scores.answer_citation_complete).length, answered.length),
    supported_answers: supportedAnswers.length,
    supported_abstentions: supportedAbstentions.length,
  };
}

function statusFor(evalMetrics, oracleMetrics) {
  if (evalMetrics.answer_rate >= 0.7 && evalMetrics.answer_support_rate >= 0.66) return "trained_contract_selector_positive";
  if (oracleMetrics.answer_rate >= 0.7 && oracleMetrics.answer_support_rate === 1) return "candidate_pool_sufficient_selector_underfits";
  if (evalMetrics.answer_rate > 0.6 && evalMetrics.answer_support_rate > 0.6) return "trained_contract_selector_near_miss";
  return "trained_contract_selector_negative";
}

function supportedAnswerCount(rows) {
  return rows.filter((row) => row.prediction?.answer_type === "grounded_answer" && row.selection_scores.supported_answer).length;
}

function syntheticAbstention(row) {
  return {
    id: "synthetic_abstain",
    family: "deterministic_gate",
    prediction: {
      answer_type: "abstain",
      answer: "The evidence pack does not contain enough support to answer this question.",
      citations: [],
      claim_table: [{ claim: "No selected answer candidate passed the verifier.", support: "abstention", citations: [] }],
      abstention_reason: "No selected answer candidate passed the verifier.",
    },
    judgment: null,
    answered: false,
    supported_answer: false,
    supported_abstention: row.reference.answer_type === "abstain",
    judged_correct: row.reference.answer_type === "abstain",
    answer_type_correct: row.reference.answer_type === "abstain",
    contract: { answer_citation_complete: false, top_level_count: 0, inline_count: 0 },
    features: { heuristic_score: 0 },
  };
}

function renderReport(result) {
  return `# Trained Contract Selector

Generated: ${result.generated_at}

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Citation complete |
| --- | ---: | ---: | ---: | ---: |
| Train selector | ${pct(result.train_metrics.answer_rate)} | ${pct(result.train_metrics.answer_support_rate)} | ${pct(result.train_metrics.overall_judged_correct_rate)} | ${pct(result.train_metrics.answer_citation_complete_rate)} |
| Eval selector | ${pct(result.eval_metrics.answer_rate)} | ${pct(result.eval_metrics.answer_support_rate)} | ${pct(result.eval_metrics.overall_judged_correct_rate)} | ${pct(result.eval_metrics.answer_citation_complete_rate)} |
| Eval oracle | ${pct(result.eval_oracle_metrics.answer_rate)} | ${pct(result.eval_oracle_metrics.answer_support_rate)} | ${pct(result.eval_oracle_metrics.overall_judged_correct_rate)} | ${pct(result.eval_oracle_metrics.answer_citation_complete_rate)} |
| Scaffold priority | ${pct(result.scaffold_priority_metrics.answer_rate)} | ${pct(result.scaffold_priority_metrics.answer_support_rate)} | ${pct(result.scaffold_priority_metrics.overall_judged_correct_rate)} | ${pct(result.scaffold_priority_metrics.answer_citation_complete_rate)} |

Status: \`${result.status}\`

This artifact makes no LLM calls and launches no compute.
`;
}

function trainLogistic(examples, { iterations, learningRate, l2 }) {
  const dims = examples[0].x.length;
  const weights = Array(dims).fill(0);
  let bias = 0;
  let loss = 0;
  for (let step = 0; step < iterations; step += 1) {
    const grad = Array(dims).fill(0);
    let gradBias = 0;
    loss = 0;
    for (const example of examples) {
      const prediction = sigmoid(dot(weights, example.x) + bias);
      const error = prediction - example.y;
      for (let i = 0; i < dims; i += 1) grad[i] += error * example.x[i];
      gradBias += error;
      loss += -example.y * Math.log(Math.max(prediction, 1e-9)) - (1 - example.y) * Math.log(Math.max(1 - prediction, 1e-9));
    }
    for (let i = 0; i < dims; i += 1) {
      grad[i] = grad[i] / examples.length + l2 * weights[i];
      weights[i] -= learningRate * grad[i];
    }
    bias -= learningRate * gradBias / examples.length;
    loss = loss / examples.length + 0.5 * l2 * dot(weights, weights);
  }
  return { weights, bias, loss };
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

function isSupportedAnswer(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "supported"
    && judgment?.all_claims_supported === true
    && judgment?.citation_ids_valid !== false;
}

function isSupportedAbstention(judgment) {
  return String(judgment?.verdict ?? "").toLowerCase() === "correct_abstention"
    || judgment?.abstention_supported === true;
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

function extractInlineCitationIds(answer) {
  return [...String(answer ?? "").matchAll(/\[([^\]]+)\]/g)]
    .flatMap((match) => match[1].split(/[,;\s]+/))
    .map((id) => id.trim())
    .filter((id) => /^E\d+$/i.test(id))
    .map((id) => id.toUpperCase());
}

function contentTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function groupCount(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function numberArg(value, fallback, { allowZero = false } = {}) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
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
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
