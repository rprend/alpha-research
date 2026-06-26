import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const args = parseArgs(process.argv.slice(2));

const split = args.split ?? "temporal_test";
const trainOffset = numberArg(args["train-offset"], 80, { allowZero: true });
const trainLimit = numberArg(args["train-limit"], 52);
const evalOffset = numberArg(args["eval-offset"], 132, { allowZero: true });
const evalLimit = numberArg(args["eval-limit"], 40);
const rankAnswerBonus = numericArg(args["rank-answer-bonus"], 0.04);
const rankInlinePenalty = numericArg(args["rank-inline-penalty"], -0.35);
const rankDirectInlineBonus = numericArg(args["rank-direct-inline-bonus"], 0);
const abstentionMarginArg = args["abstention-margin"] === "auto"
  ? "auto"
  : numericArg(args["abstention-margin"], Number.NaN);
const answerabilityGuardArg = args["answerability-guard"] === "auto"
  ? "auto"
  : numericArg(args["answerability-guard"], Number.NaN);
const answerabilityCoverageFloor = numericArg(args["answerability-coverage-floor"], Number.NaN);
const includeRecovery = args["include-recovery"] === "true" || args["recovery-run"] || args["recovery-eval-run"];
const runId = args["run-id"] ?? `verifier-selector-${split}-${trainOffset}-${evalOffset}-v1`;
const outputDir = path.join(runDir, runId);

const policies = {
  direct: {
    predictionRun: args["direct-run"] ?? "openai-student-temporal-test-full-v1",
    judgeRun: args["direct-judge-run"] ?? "openai-judge-student-temporal-test-full-v1",
  },
  strict_rubric: {
    predictionRun: args["strict-run"] ?? "openai-student-teacher-rubric-temporal-test-80-132-v1",
    judgeRun: args["strict-judge-run"] ?? "openai-judge-student-teacher-rubric-temporal-test-80-132-v1",
    evalPredictionRun: args["strict-eval-run"] ?? "openai-student-teacher-rubric-temporal-test-132-172-v1",
    evalJudgeRun: args["strict-eval-judge-run"] ?? "openai-judge-student-teacher-rubric-temporal-test-132-172-v1",
  },
  balanced_rubric: {
    predictionRun: args["balanced-run"] ?? "openai-student-teacher-balanced-rubric-temporal-test-80-132-v1",
    judgeRun: args["balanced-judge-run"] ?? "openai-judge-student-teacher-balanced-rubric-temporal-test-80-132-v1",
    evalPredictionRun: args["balanced-eval-run"] ?? "openai-student-teacher-balanced-rubric-temporal-test-132-172-v1",
    evalJudgeRun: args["balanced-eval-judge-run"] ?? "openai-judge-student-teacher-balanced-rubric-temporal-test-132-172-v1",
  },
  citation_repair: {
    predictionRun: args["repair-run"] ?? "citation-contract-repair-direct-mini-temporal-test-80-132-v1",
    judgeRun: args["repair-judge-run"] ?? "openai-judge-citation-contract-repair-direct-mini-temporal-test-80-132-v1",
    evalPredictionRun: args["repair-eval-run"] ?? "citation-contract-repair-direct-mini-temporal-test-132-172-v1",
    evalJudgeRun: args["repair-eval-judge-run"] ?? "openai-judge-citation-contract-repair-direct-mini-temporal-test-132-172-v1",
  },
};

if (includeRecovery) {
  policies.answer_recovery = {
    predictionRun: args["recovery-run"] ?? "citation-contract-repair-answer-recovery-temporal-test-80-132-v1",
    judgeRun: args["recovery-judge-run"] ?? "openai-judge-citation-contract-repair-answer-recovery-temporal-test-80-132-v1",
    evalPredictionRun: args["recovery-eval-run"] ?? "citation-contract-repair-answer-recovery-temporal-test-132-172-v1",
    evalJudgeRun: args["recovery-eval-judge-run"] ?? "openai-judge-citation-contract-repair-answer-recovery-temporal-test-132-172-v1",
  };
}

await fs.mkdir(outputDir, { recursive: true });

const references = await readJsonl(path.join(dataDir, `${split}.jsonl`));
const trainReferences = references.slice(trainOffset, trainOffset + trainLimit);
const evalReferences = references.slice(evalOffset, evalOffset + evalLimit);

const trainRows = await buildRows(trainReferences, "train");
const evalRows = await buildRows(evalReferences, "eval");
const featureNames = featureVector(trainRows[0].candidates.direct, trainRows[0].candidates, trainRows[0].input).names;
const trainExamples = trainRows.flatMap((row) => Object.values(row.candidates).map((candidate) => ({
  x: featureVector(candidate, row.candidates, row.input).values,
  y: candidate.target_good ? 1 : 0,
})));
const model = trainLogistic(trainExamples, { iterations: 2800, learningRate: 0.08, l2: 0.02 });
const abstentionMargin = abstentionMarginArg === "auto"
  ? tuneAbstentionMargin(trainRows, model)
  : (Number.isFinite(abstentionMarginArg) ? abstentionMarginArg : null);
const answerabilityFeatureNames = rowFeatureVector(trainRows[0], model).names;
const answerabilityModel = trainLogistic(trainRows.map((row) => ({
  x: rowFeatureVector(row, model).values,
  y: row.reference.answer_type === "grounded_answer" ? 1 : 0,
})), { iterations: 2200, learningRate: 0.08, l2: 0.03 });
const answerabilityThreshold = answerabilityGuardArg === "auto"
  ? tuneAnswerabilityThreshold(trainRows, model, abstentionMargin, answerabilityModel, answerabilityCoverageFloor)
  : (Number.isFinite(answerabilityGuardArg) ? answerabilityGuardArg : null);

const selectedTrainRows = selectRows(trainRows, model, abstentionMargin, answerabilityModel, answerabilityThreshold);
const selectedEvalRows = selectRows(evalRows, model, abstentionMargin, answerabilityModel, answerabilityThreshold);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  split,
  train: {
    offset: trainOffset,
    examples: trainRows.length,
    candidate_rows: trainExamples.length,
    positive_candidate_rate: mean(trainExamples.map((row) => row.y)),
  },
  eval: {
    offset: evalOffset,
    examples: selectedEvalRows.length,
  },
  policy_runs: policies,
  verifier: {
    type: "zero_call_logistic_candidate_verifier",
    target: "candidate is judge-correct and answer-type-correct on train examples",
    feature_names: featureNames,
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    bias: model.bias,
    train_loss: model.loss,
    rank_answer_bonus: rankAnswerBonus,
    rank_inline_penalty: rankInlinePenalty,
    rank_direct_inline_bonus: rankDirectInlineBonus,
    abstention_margin: abstentionMargin,
  },
  answerability_guard: {
    enabled: answerabilityThreshold != null,
    target: "row is answerable on train examples",
    feature_names: answerabilityFeatureNames,
    weights: Object.fromEntries(answerabilityFeatureNames.map((name, index) => [name, answerabilityModel.weights[index]])),
    bias: answerabilityModel.bias,
    train_loss: answerabilityModel.loss,
    threshold: answerabilityThreshold,
    coverage_floor: Number.isFinite(answerabilityCoverageFloor) ? answerabilityCoverageFloor : null,
  },
  cost: {
    llm_calls: 0,
    run_cost_usd: 0,
    note: "Verifier selector trains only on existing prediction and judge artifacts.",
  },
  train_metrics: summarizeSelections(selectedTrainRows),
  eval_metrics: summarizeSelections(selectedEvalRows),
  eval_policy_mix: groupCount(selectedEvalRows.map((row) => row.selected_policy)),
  eval_oracle: oracleSummary(evalRows),
};

await writeJsonl(path.join(outputDir, "predictions.jsonl"), selectedEvalRows);
await writeJsonl(path.join(outputDir, "train_predictions.jsonl"), selectedTrainRows);
await fs.writeFile(path.join(outputDir, "verifier-model.json"), `${JSON.stringify(result.verifier, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  result: path.relative(rootDir, path.join(outputDir, "result.json")),
  report: path.relative(rootDir, path.join(outputDir, "report.md")),
  train_metrics: result.train_metrics,
  eval_metrics: result.eval_metrics,
  eval_policy_mix: result.eval_policy_mix,
  eval_oracle: result.eval_oracle,
}, null, 2));

async function buildRows(referenceRows, role) {
  const referenceIds = new Set(referenceRows.map((row) => row.example_id));
  const loaded = {};
  for (const [policy, config] of Object.entries(policies)) {
    const predictionRun = role === "eval" ? (config.evalPredictionRun ?? config.predictionRun) : config.predictionRun;
    const judgeRun = role === "eval" ? (config.evalJudgeRun ?? config.judgeRun) : config.judgeRun;
    loaded[policy] = {
      predictionRun,
      judgeRun,
      predictions: await loadPredictions(predictionRun, referenceIds),
      judgments: await loadJudgments(judgeRun, referenceIds),
    };
  }

  return referenceRows.map((reference) => {
    const candidates = {};
    for (const [policy, artifacts] of Object.entries(loaded)) {
      const predictionRow = artifacts.predictions.get(reference.example_id);
      const judgmentRow = artifacts.judgments.get(reference.example_id);
      const prediction = normalizePrediction(predictionRow?.prediction ?? {});
      const scores = scorePrediction(reference, prediction);
      const inheritedJudgedCorrect = judgedCorrect(judgmentRow);
      candidates[policy] = {
        policy,
        prediction,
        prediction_run: artifacts.predictionRun,
        judge_run: artifacts.judgeRun,
        judgment: judgmentRow?.judgment ?? null,
        inherited_judged_correct: inheritedJudgedCorrect,
        scores,
        inline_complete: inlineComplete(prediction),
        answered: prediction.answer_type === "grounded_answer",
        target_good: inheritedJudgedCorrect && scores.answer_type_correct === true,
      };
    }
    return {
      example_id: reference.example_id,
      reference: {
        answer_type: reference.output.answer_type,
        answer: reference.output.answer,
        citations: (reference.output.citations ?? []).map((citation) => citation.evidence_id),
      },
      candidates,
      input: {
        question: reference.input.question,
        evidence_pack: reference.input.compact_retrieved_evidence_pack,
      },
    };
  });
}

function selectRows(rows, model, abstentionMargin, answerabilityModel = null, answerabilityThreshold = null) {
  return rows.map((row) => {
    const scored = scoreCandidates(row, model);
    const marginSelected = applyAbstentionOverride(scored, abstentionMargin);
    const answerabilityScore = answerabilityModel ? predict(answerabilityModel, rowFeatureVector(row, model).values) : null;
    const selected = applyAnswerabilityGuard(marginSelected, scored, answerabilityScore, answerabilityThreshold);
    return {
      example_id: row.example_id,
      selected_policy: selected.policy,
      verifier_score: selected.verifier_score,
      prediction: selected.prediction,
      reference: row.reference,
      scores: selected.scores,
      inherited_judgment: selected.judgment,
      inherited_judged_correct: selected.inherited_judged_correct,
      target_good: selected.target_good,
      selection_metadata: {
        base_policy: scored[0].policy,
        margin_policy: marginSelected.policy,
        abstention_margin: abstentionMargin,
        answerability_score: answerabilityScore,
        answerability_threshold: answerabilityThreshold,
        overridden_to_abstain: scored[0].policy !== selected.policy && selected.prediction.answer_type === "abstain",
        answerability_guard_fired: marginSelected.policy !== selected.policy && selected.prediction.answer_type === "abstain",
      },
      candidate_summary: Object.fromEntries(scored.map((candidate) => [candidate.policy, {
        verifier_score: candidate.verifier_score,
        answered: candidate.answered,
        inline_complete: candidate.inline_complete,
        inherited_judged_correct: candidate.inherited_judged_correct,
        target_good: candidate.target_good,
        answer_type_correct: candidate.scores.answer_type_correct,
        citation_precision: candidate.scores.citation_precision,
        citation_recall: candidate.scores.citation_recall,
      }])),
    };
  });
}

function scoreCandidates(row, model) {
  return Object.values(row.candidates).map((candidate) => ({
    ...candidate,
    verifier_score: predict(model, featureVector(candidate, row.candidates, row.input).values),
  })).sort((a, b) => candidateRank(b) - candidateRank(a));
}

function tuneAbstentionMargin(rows, model) {
  const candidates = [-0.4, -0.3, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
  let best = { margin: null, metrics: summarizeSelections(selectRows(rows, model, null, null, null)) };
  for (const margin of candidates) {
    const selected = selectRows(rows, model, margin, null, null);
    const metrics = summarizeSelections(selected);
    if (marginBetter(metrics, best.metrics)) best = { margin, metrics };
  }
  return best.margin;
}

function tuneAnswerabilityThreshold(rows, model, abstentionMargin, answerabilityModel, coverageFloor = Number.NaN) {
  const thresholds = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
  const baseline = summarizeSelections(selectRows(rows, model, abstentionMargin, null, null));
  const minAnswered = Number.isFinite(coverageFloor) ? Math.ceil(baseline.answered * coverageFloor) : 0;
  let best = { threshold: null, metrics: baseline };
  for (const threshold of thresholds) {
    const selected = selectRows(rows, model, abstentionMargin, answerabilityModel, threshold);
    const metrics = summarizeSelections(selected);
    if (metrics.answered < minAnswered) continue;
    if (marginBetter(metrics, best.metrics)) best = { threshold, metrics };
  }
  return best.threshold;
}

function marginBetter(left, right) {
  const leftTarget = Number(left.target_good_rate ?? 0);
  const rightTarget = Number(right.target_good_rate ?? 0);
  if (Math.abs(leftTarget - rightTarget) > 1e-12) return leftTarget > rightTarget;
  const leftAnswered = Number(left.answered ?? 0);
  const rightAnswered = Number(right.answered ?? 0);
  if (leftAnswered !== rightAnswered) return leftAnswered > rightAnswered;
  return Number(left.answer_token_f1 ?? 0) > Number(right.answer_token_f1 ?? 0);
}

function applyAbstentionOverride(scored, abstentionMargin) {
  const top = scored[0];
  if (abstentionMargin == null || top.prediction.answer_type !== "grounded_answer") return top;
  const abstainer = scored.find((candidate) => candidate.prediction.answer_type === "abstain");
  if (!abstainer) return top;
  const gap = candidateRank(top) - candidateRank(abstainer);
  return gap <= abstentionMargin ? abstainer : top;
}

function applyAnswerabilityGuard(selected, scored, answerabilityScore, threshold) {
  if (threshold == null || answerabilityScore == null || selected.prediction.answer_type !== "grounded_answer") return selected;
  if (answerabilityScore >= threshold) return selected;
  return scored.find((candidate) => candidate.prediction.answer_type === "abstain") ?? selected;
}

function candidateRank(candidate) {
  const inlinePenalty = candidate.inline_complete ? 0 : rankInlinePenalty;
  const answerBonus = candidate.answered ? rankAnswerBonus : 0;
  const directInlineBonus = candidate.policy === "direct" && candidate.inline_complete ? rankDirectInlineBonus : 0;
  return candidate.verifier_score + inlinePenalty + answerBonus + directInlineBonus;
}

function featureVector(candidate, candidates, input) {
  const prediction = candidate.prediction;
  const citationCount = prediction.citations.length;
  const answerTokens = contentTokens(prediction.answer).length;
  const claimCount = prediction.claim_table.length;
  const answeredPolicies = Object.values(candidates).filter((row) => row.answered).length;
  const sameTypePolicies = Object.values(candidates).filter((row) => row.prediction.answer_type === prediction.answer_type).length;
  const sameCitationPolicies = Object.values(candidates).filter((row) => jaccard(row.prediction.citations, prediction.citations) >= 0.5).length;
  const evidenceFeatures = evidenceAlignmentFeatures(prediction, input);
  const names = [
    "is_direct",
    "is_strict_rubric",
    "is_balanced_rubric",
    "is_citation_repair",
    "is_answer_recovery",
    "answered",
    "inline_complete",
    "citation_count",
    "claim_count",
    "answer_tokens",
    "answered_policy_count",
    "same_type_policy_count",
    "same_citation_policy_count",
    "valid_citation_rate",
    "mean_citation_rank",
    "answer_cited_unigram_coverage",
    "answer_cited_bigram_coverage",
    "answer_full_pack_unigram_coverage",
    "claim_cited_min_coverage",
    "claim_cited_mean_coverage",
    "numeric_values_supported_rate",
    "local_citation_window_coverage",
    "claim_nearest_citation_min_coverage",
    "claim_nearest_citation_mean_coverage",
    "citation_marker_density",
    "citation_order_monotonicity",
    "question_cited_overlap",
    "question_pack_max_overlap",
    "question_pack_mean_overlap",
    "abstain_with_high_question_overlap",
  ];
  const values = [
    candidate.policy === "direct" ? 1 : 0,
    candidate.policy === "strict_rubric" ? 1 : 0,
    candidate.policy === "balanced_rubric" ? 1 : 0,
    candidate.policy === "citation_repair" ? 1 : 0,
    candidate.policy === "answer_recovery" ? 1 : 0,
    candidate.answered ? 1 : 0,
    candidate.inline_complete ? 1 : 0,
    Math.log1p(citationCount),
    Math.log1p(claimCount),
    Math.log1p(answerTokens),
    answeredPolicies / Object.keys(candidates).length,
    sameTypePolicies / Object.keys(candidates).length,
    sameCitationPolicies / Object.keys(candidates).length,
    evidenceFeatures.valid_citation_rate,
    evidenceFeatures.mean_citation_rank,
    evidenceFeatures.answer_cited_unigram_coverage,
    evidenceFeatures.answer_cited_bigram_coverage,
    evidenceFeatures.answer_full_pack_unigram_coverage,
    evidenceFeatures.claim_cited_min_coverage,
    evidenceFeatures.claim_cited_mean_coverage,
    evidenceFeatures.numeric_values_supported_rate,
    evidenceFeatures.local_citation_window_coverage,
    evidenceFeatures.claim_nearest_citation_min_coverage,
    evidenceFeatures.claim_nearest_citation_mean_coverage,
    evidenceFeatures.citation_marker_density,
    evidenceFeatures.citation_order_monotonicity,
    evidenceFeatures.question_cited_overlap,
    evidenceFeatures.question_pack_max_overlap,
    evidenceFeatures.question_pack_mean_overlap,
    prediction.answer_type === "abstain" ? evidenceFeatures.question_pack_max_overlap : 0,
  ];
  return { names, values };
}

function rowFeatureVector(row, model) {
  const scored = scoreCandidates(row, model);
  const top = scored[0];
  const abstainer = scored.find((candidate) => candidate.prediction.answer_type === "abstain");
  const answerers = scored.filter((candidate) => candidate.prediction.answer_type === "grounded_answer");
  const evidencePack = row.input?.evidence_pack ?? [];
  const questionTokens = contentTokens(row.input?.question ?? "");
  const evidenceOverlaps = evidencePack.map((evidence) => tokenCoverage(questionTokens, contentTokens(evidence.text)));
  const topEvidenceFeatures = evidenceAlignmentFeatures(top.prediction, row.input);
  const names = [
    "top_answered",
    "top_verifier_score",
    "top_to_abstain_rank_gap",
    "answered_candidate_rate",
    "abstain_candidate_rate",
    "max_question_evidence_overlap",
    "mean_question_evidence_overlap",
    "top_answer_cited_unigram_coverage",
    "top_question_cited_overlap",
    "top_same_type_policy_count",
    "top_same_citation_policy_count",
  ];
  const values = [
    top.prediction.answer_type === "grounded_answer" ? 1 : 0,
    top.verifier_score,
    abstainer ? candidateRank(top) - candidateRank(abstainer) : 1,
    answerers.length / scored.length,
    scored.filter((candidate) => candidate.prediction.answer_type === "abstain").length / scored.length,
    evidenceOverlaps.length ? Math.max(...evidenceOverlaps) : 0,
    mean(evidenceOverlaps),
    topEvidenceFeatures.answer_cited_unigram_coverage,
    topEvidenceFeatures.question_cited_overlap,
    scored.filter((candidate) => candidate.prediction.answer_type === top.prediction.answer_type).length / scored.length,
    scored.filter((candidate) => jaccard(candidate.prediction.citations, top.prediction.citations) >= 0.5).length / scored.length,
  ];
  return { names, values };
}

function evidenceAlignmentFeatures(prediction, input) {
  const evidencePack = input?.evidence_pack ?? [];
  const evidenceById = new Map(evidencePack.map((evidence) => [evidence.evidence_id, evidence]));
  const citedEvidence = prediction.citations.map((id) => evidenceById.get(id)).filter(Boolean);
  const citedText = citedEvidence.map((evidence) => evidence.text).join(" ");
  const packText = evidencePack.map((evidence) => evidence.text).join(" ");
  const questionTokens = contentTokens(input?.question ?? "");
  const answerTokens = contentTokens(prediction.answer);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const citedBigrams = bigrams(citedTokens);
  const answerBigrams = bigrams(answerTokens);
  const claimCoverages = prediction.claim_table.length
    ? prediction.claim_table.map((claim) => tokenCoverage(contentTokens(claim.claim ?? ""), citedTokens))
    : [];
  const localFeatures = localCitationFeatures(prediction, evidenceById);
  const ranks = citedEvidence.map((evidence) => Number(evidence.retrieval_rank)).filter(Number.isFinite);
  const normalizedMeanRank = ranks.length ? mean(ranks.map((rank) => 1 / Math.max(1, rank))) : 0;
  const numbers = numberTokens(prediction.answer);
  const citedNumberSet = new Set(numberTokens(citedText));
  const questionOverlaps = evidencePack.map((evidence) => tokenCoverage(questionTokens, contentTokens(evidence.text)));

  return {
    valid_citation_rate: prediction.citations.length ? citedEvidence.length / prediction.citations.length : 0,
    mean_citation_rank: normalizedMeanRank,
    answer_cited_unigram_coverage: tokenCoverage(answerTokens, citedTokens),
    answer_cited_bigram_coverage: tokenCoverage(answerBigrams, citedBigrams),
    answer_full_pack_unigram_coverage: tokenCoverage(answerTokens, packTokens),
    claim_cited_min_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_cited_mean_coverage: mean(claimCoverages),
    numeric_values_supported_rate: numbers.length ? numbers.filter((number) => citedNumberSet.has(number)).length / numbers.length : 1,
    local_citation_window_coverage: localFeatures.local_citation_window_coverage,
    claim_nearest_citation_min_coverage: localFeatures.claim_nearest_citation_min_coverage,
    claim_nearest_citation_mean_coverage: localFeatures.claim_nearest_citation_mean_coverage,
    citation_marker_density: localFeatures.citation_marker_density,
    citation_order_monotonicity: localFeatures.citation_order_monotonicity,
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    question_pack_max_overlap: questionOverlaps.length ? Math.max(...questionOverlaps) : 0,
    question_pack_mean_overlap: mean(questionOverlaps),
  };
}

function localCitationFeatures(prediction, evidenceById) {
  if (prediction.answer_type !== "grounded_answer") {
    return {
      local_citation_window_coverage: 0,
      claim_nearest_citation_min_coverage: 0,
      claim_nearest_citation_mean_coverage: 0,
      citation_marker_density: 0,
      citation_order_monotonicity: 1,
    };
  }

  const answer = String(prediction.answer ?? "");
  const markers = [...answer.matchAll(/\[([^\]]+)\]/g)]
    .map((match) => ({ id: match[1], index: match.index ?? 0 }))
    .filter((marker) => evidenceById.has(marker.id));
  const answerTokenCount = Math.max(1, contentTokens(answer).length);
  const localCoverages = markers.map((marker) => {
    const start = Math.max(0, marker.index - 240);
    const end = Math.min(answer.length, marker.index + 240);
    const windowTokens = contentTokens(answer.slice(start, end));
    const evidenceTokens = contentTokens(evidenceById.get(marker.id)?.text ?? "");
    return tokenCoverage(windowTokens, evidenceTokens);
  });
  const claimCoverages = (prediction.claim_table ?? []).map((claim) => {
    const claimText = String(claim.claim ?? "");
    const claimIndex = claimText ? Math.max(0, answer.toLowerCase().indexOf(claimText.toLowerCase())) : -1;
    const nearest = nearestMarker(markers, claimIndex >= 0 ? claimIndex : 0);
    const evidenceTokens = nearest ? contentTokens(evidenceById.get(nearest.id)?.text ?? "") : [];
    return tokenCoverage(contentTokens(claimText), evidenceTokens);
  });
  const markerRanks = markers
    .map((marker) => Number(evidenceById.get(marker.id)?.retrieval_rank))
    .filter(Number.isFinite);

  return {
    local_citation_window_coverage: mean(localCoverages),
    claim_nearest_citation_min_coverage: claimCoverages.length ? Math.min(...claimCoverages) : 0,
    claim_nearest_citation_mean_coverage: mean(claimCoverages),
    citation_marker_density: Math.min(1, markers.length / answerTokenCount),
    citation_order_monotonicity: monotonicity(markerRanks),
  };
}

function nearestMarker(markers, index) {
  if (!markers.length) return null;
  return markers.reduce((best, marker) => {
    if (!best) return marker;
    return Math.abs(marker.index - index) < Math.abs(best.index - index) ? marker : best;
  }, null);
}

function monotonicity(values) {
  if (values.length < 2) return 1;
  let ordered = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] >= values[index - 1]) ordered += 1;
  }
  return ordered / (values.length - 1);
}

function trainLogistic(examples, options) {
  const weights = Array(examples[0].x.length).fill(0);
  let bias = 0;
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const grad = Array(weights.length).fill(0);
    let biasGrad = 0;
    for (const example of examples) {
      const prediction = sigmoid(dot(weights, example.x) + bias);
      const error = prediction - example.y;
      for (let index = 0; index < weights.length; index += 1) grad[index] += error * example.x[index];
      biasGrad += error;
    }
    for (let index = 0; index < weights.length; index += 1) {
      grad[index] = grad[index] / examples.length + options.l2 * weights[index];
      weights[index] -= options.learningRate * grad[index];
    }
    bias -= options.learningRate * (biasGrad / examples.length);
  }
  return {
    weights,
    bias,
    loss: logisticLoss(examples, weights, bias, options.l2),
  };
}

function logisticLoss(examples, weights, bias, l2) {
  const eps = 1e-8;
  const nll = mean(examples.map((example) => {
    const prediction = Math.min(1 - eps, Math.max(eps, sigmoid(dot(weights, example.x) + bias)));
    return -(example.y * Math.log(prediction) + (1 - example.y) * Math.log(1 - prediction));
  }));
  return nll + l2 * sum(weights.map((value) => value * value)) / 2;
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

function oracleSummary(rows) {
  const selected = rows.map((row) => {
    const candidates = Object.values(row.candidates);
    const targetGood = candidates.find((candidate) => candidate.target_good && candidate.inline_complete);
    const fallback = candidates.find((candidate) => candidate.target_good) ?? candidates[0];
    return targetGood ?? fallback;
  });
  return {
    target_good_rate: mean(selected.map((candidate) => candidate.target_good)),
    answered: selected.filter((candidate) => candidate.prediction.answer_type === "grounded_answer").length,
    policy_mix: groupCount(selected.map((candidate) => candidate.policy)),
  };
}

async function loadPredictions(runId, referenceIds) {
  const rows = await readJsonl(path.join(runDir, runId, "predictions.jsonl"));
  return new Map(rows.filter((row) => referenceIds.has(row.example_id)).map((row) => [row.example_id, row]));
}

async function loadJudgments(runId, referenceIds) {
  const rows = await readJsonl(path.join(runDir, runId, "judgments.jsonl"));
  return new Map(rows.filter((row) => referenceIds.has(row.example_id)).map((row) => [row.example_id, row]));
}

function judgedCorrect(row) {
  const judgment = row?.judgment ?? {};
  if (row?.prediction_answer_type === "grounded_answer") {
    return judgment.verdict === "supported"
      && judgment.all_claims_supported === true
      && judgment.citation_ids_valid === true;
  }
  if (row?.prediction_answer_type === "abstain") {
    return judgment.verdict === "correct_abstention"
      && judgment.abstention_supported === true;
  }
  return false;
}

function inlineComplete(prediction) {
  if (prediction.answer_type !== "grounded_answer") return true;
  return prediction.citations.length > 0
    && prediction.citations.every((id) => prediction.answer.includes(`[${id}]`));
}

function scorePrediction(reference, prediction) {
  const referenceCitations = new Set((reference.output.citations ?? []).map((citation) => citation.evidence_id));
  const citedGold = prediction.citations.filter((id) => reference.teacher_trace.evidence_roles[id] === "gold_evidence").length;
  const answerable = reference.output.answer_type !== "abstain";
  const abstained = prediction.answer_type === "abstain";
  return {
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
  };
}

function summarizeSelections(rows) {
  return {
    examples: rows.length,
    answered: rows.filter((row) => row.prediction.answer_type === "grounded_answer").length,
    abstained: rows.filter((row) => row.prediction.answer_type === "abstain").length,
    answer_type_accuracy: mean(rows.map((row) => row.scores.answer_type_correct)),
    citation_precision: mean(rows.map((row) => row.scores.citation_precision)),
    citation_recall: mean(rows.map((row) => row.scores.citation_recall)),
    answer_token_f1: mean(rows.map((row) => row.scores.answer_token_f1)),
    abstention_accuracy: mean(rows.map((row) => row.scores.abstention_correct)),
    inline_citation_rate: mean(rows.map((row) => row.scores.inline_citation_rate)),
    inherited_judged_correct_rate: mean(rows.map((row) => row.inherited_judged_correct)),
    target_good_rate: mean(rows.map((row) => row.target_good)),
  };
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

function renderReport(result) {
  return `# Verifier Selector

## Setup

- Split: \`${result.split}\`
- Train window: offset ${result.train.offset}, ${result.train.examples} examples
- Eval window: offset ${result.eval.offset}, ${result.eval.examples} examples
- LLM calls: ${result.cost.llm_calls}
- Run cost: $${result.cost.run_cost_usd.toFixed(7)}

The verifier is trained only from existing candidate predictions and judge labels. The target is candidate-level correctness: judge-correct and answer-type-correct.

## Result

| Split | Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Inherited judged correct | Target-good |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | ${result.train_metrics.examples} | ${result.train_metrics.answered} | ${pct(result.train_metrics.answer_type_accuracy)} | ${pct(result.train_metrics.citation_precision)} | ${pct(result.train_metrics.citation_recall)} | ${pct(result.train_metrics.answer_token_f1)} | ${pct(result.train_metrics.inline_citation_rate)} | ${pct(result.train_metrics.inherited_judged_correct_rate)} | ${pct(result.train_metrics.target_good_rate)} |
| Eval | ${result.eval_metrics.examples} | ${result.eval_metrics.answered} | ${pct(result.eval_metrics.answer_type_accuracy)} | ${pct(result.eval_metrics.citation_precision)} | ${pct(result.eval_metrics.citation_recall)} | ${pct(result.eval_metrics.answer_token_f1)} | ${pct(result.eval_metrics.inline_citation_rate)} | ${pct(result.eval_metrics.inherited_judged_correct_rate)} | ${pct(result.eval_metrics.target_good_rate)} |

## Eval Policy Mix

${Object.entries(result.eval_policy_mix).map(([policy, count]) => `- ${policy}: ${count}`).join("\n")}

## Oracle Headroom

- Target-good rate if an oracle picked any inline-complete good candidate: ${pct(result.eval_oracle.target_good_rate)}
- Oracle answered examples: ${result.eval_oracle.answered}
- Oracle policy mix: ${JSON.stringify(result.eval_oracle.policy_mix)}

This is a calibration experiment, not a final student. It tests whether support labels from one temporal window transfer to routing decisions on the next window.
`;
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

function bigrams(tokens) {
  const out = [];
  for (let index = 0; index < tokens.length - 1; index += 1) out.push(`${tokens[index]} ${tokens[index + 1]}`);
  return out;
}

function numberTokens(value) {
  return String(value).match(/\b\d+(?:[.,]\d+)*(?:%|k|m|b)?\b/gi) ?? [];
}

function tokenCoverage(targetTokens, sourceTokens) {
  if (!targetTokens.length) return 0;
  const source = new Set(sourceTokens);
  return targetTokens.filter((token) => source.has(token)).length / targetTokens.length;
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
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / union.size;
}

function groupCount(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

function mean(values) {
  const numeric = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
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

function numberArg(value, fallback, options = {}) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function numericArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
