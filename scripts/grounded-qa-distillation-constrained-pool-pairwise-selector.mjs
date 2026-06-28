import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const adjudicationRunId = args["adjudication-run"] ?? "openai-pool-adjudication-qwen-frontier-pool-2026-06-28-v1";
const claimNliRunId = args["claim-nli-run"] ?? "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const hardSelectorRunId = args["hard-selector-run"] ?? "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const trainMaxSourceIndex = Number(args["train-max-source-index"] ?? 300);
const outputDir = path.join(runsDir, runId);

const featureNames = [
  "claim_model_min",
  "claim_model_mean",
  "nli_entailment_min",
  "nli_entailment_mean",
  "nli_margin_min",
  "nli_margin_mean",
  "nli_contradiction_max",
  "citation_count",
  "answer_tokens",
  "claim_count",
  "inline_complete",
  "unsupported_number_count",
  "unsupported_comparative_count",
  "short_answer_bonus",
];
const comparativeTerms = ["best", "better", "worse", "worst", "outperform", "outperformed", "outperforms", "higher", "lower", "more", "less", "fewer", "larger", "smaller", "shorter", "longer", "improve", "improved", "increase", "increased", "decrease", "decreased", "reduce", "reduced", "significant", "significantly"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const adjudicationResult = await readJson(path.join(runsDir, adjudicationRunId, "result.json"));
const hardSelectorResult = await readJson(path.join(runsDir, hardSelectorRunId, "result.json"));
const adjudications = await readJsonl(path.join(runsDir, adjudicationRunId, "pool_adjudications.jsonl"));
const selectedPools = await readJsonl(path.join(runsDir, adjudicationRunId, "selected_pools.jsonl"));
const claimNliResult = await readJson(path.join(runsDir, claimNliRunId, "result.json"));
const claimNliScores = await readJsonl(path.join(runsDir, claimNliRunId, "claim-nli-scores.jsonl"));
const nliByKey = new Map(claimNliScores.map((row) => [row.unit_key, row.nli]));
const validationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));
const adjudicationByRoot = new Map(adjudications.filter((row) => !row.skipped).map((row) => [row.root_example_id, row]));

const poolRows = selectedPools
  .map((pool) => enrichPool(pool, adjudicationByRoot.get(pool.root_example_id)))
  .filter((pool) => pool.adjudication && pool.adjudication.judgment.selected_candidate_id !== "NONE");
const trainPools = poolRows.filter((pool) => Number(pool.source_index) < trainMaxSourceIndex);
const validationPools = poolRows.filter((pool) => Number(pool.source_index) >= trainMaxSourceIndex);
const trainPairs = trainPools.flatMap(poolToTrainingPairs);
const scaler = fitScaleOnlyScaler(trainPairs.map((row) => row.delta));
const model = trainPairwiseLogistic(trainPairs.map((row) => scaleVector(row.delta, scaler)), { epochs: 700, learningRate: 0.07, l2: 0.04 });
const trainEval = evaluatePools(trainPools, model, scaler);
const adjudicationValidationEval = evaluatePools(validationPools, model, scaler);
const existingValidationPairs = validationPairs.map(enrichPair);
const existingValidationEval = evaluatePairs(existingValidationPairs, model, scaler);
const finalDiagnosticPairs = diagnosticPairs.map(enrichPair);
const finalDiagnosticEval = evaluatePairs(finalDiagnosticPairs, model, scaler);
const finalSelections = selectDiagnosticCandidates(finalDiagnosticPairs, model, scaler);
const finalSelectionMetrics = summarizeSelections(finalSelections);
const hybrid = tuneHybrid({
  poolModel: model,
  poolScaler: scaler,
  hardModel: hardSelectorResult.learned_models.baseline_pairwise_selector,
  validationPools,
  existingValidationPairs,
  finalDiagnosticPairs,
});
const constrained = tuneConstrainedSelector({
  poolModel: model,
  poolScaler: scaler,
  hardModel: hardSelectorResult.learned_models.baseline_pairwise_selector,
  validationPools,
  existingValidationPairs,
  finalDiagnosticPairs,
});
const status = deriveStatus(adjudicationValidationEval, existingValidationEval, maxSelectionMetric(finalSelectionMetrics, constrained.final_selection.metrics));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "constrained_pool_pairwise_selector",
  status,
  adjudication_run_id: adjudicationRunId,
  claim_nli_run_id: claimNliRunId,
  hard_selector_run_id: hardSelectorRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Constrain GPT-4o pool-choice supervision with D258 pairwise support signal and answer/claim-table consistency penalties, then evaluate final-window candidate selection only as diagnostic.",
  training: {
    algorithm: "pool_choice_pairwise_logistic_regression",
    train_max_source_index: trainMaxSourceIndex,
    adjudicated_pools: poolRows.length,
    train_pools: trainPools.length,
    validation_pools: validationPools.length,
    train_pairwise_preferences: trainPairs.length,
    feature_names: featureNames,
  },
  metrics: {
    train_pool_choice: summarizePoolEval(trainEval),
    adjudication_validation_pool_choice: summarizePoolEval(adjudicationValidationEval),
    existing_validation_pairwise: summarizePairEval(existingValidationEval),
    final_diagnostic_pairwise: summarizePairEval(finalDiagnosticEval),
    final_diagnostic_selection: finalSelectionMetrics,
    hybrid_pool_pairwise_selector: {
      alpha_pool_weight: hybrid.alpha,
      adjudication_validation_pool_choice: summarizePoolEval(hybrid.validation_pool),
      existing_validation_pairwise: summarizePairEval(hybrid.existing_validation_pairwise),
      final_diagnostic_selection: hybrid.final_selection.metrics,
    },
    constrained_pool_pairwise_selector: {
      selected_policy: constrained.policy,
      adjudication_validation_pool_choice: summarizePoolEval(constrained.validation_pool),
      existing_validation_pairwise: summarizePairEval(constrained.existing_validation_pairwise),
      final_diagnostic_pairwise: summarizePairEval(constrained.final_diagnostic_pairwise),
      final_diagnostic_selection: constrained.final_selection.metrics,
    },
  },
  tuning: {
    objective: "Choose a non-final validation policy that keeps pool-choice accuracy useful, preserves existing support-pair accuracy, and prefers lower pool weight / stronger consistency only as a tie-breaker.",
    policies_evaluated: constrained.candidates.length,
    selected_policy: constrained.policy,
    top_candidates: constrained.candidates.slice(0, 10).map((candidate) => ({
      policy: candidate.policy,
      validation_pool_choice_accuracy: candidate.validation_pool.adjudicator_choice_accuracy,
      validation_pool_selected_support_rate: candidate.validation_pool.selected_existing_support_rate,
      existing_validation_accuracy: candidate.existing_validation_pairwise.accuracy,
      objective_score: candidate.objective_score,
    })),
  },
  learned_selector: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  decision: decisionFromMetrics(adjudicationValidationEval, existingValidationEval, finalSelectionMetrics, hybrid, constrained),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    nonfinal_training_use: "allowed_nonfinal_pool_adjudication",
    adjudication_source_index_min: min(poolRows.map((row) => row.source_index)),
    adjudication_source_index_max: max(poolRows.map((row) => row.source_index)),
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    inherited_pool_adjudication_openai_cost_usd: adjudicationResult.run_cost_usd,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    inherited_openai_llm_calls: adjudicationResult.calls_made,
    inherited_openai_cost_usd: adjudicationResult.run_cost_usd,
    note: "This selector training run makes no new LLM calls; it reuses the paid pool adjudication artifact.",
  },
};

await writeJsonl(path.join(outputDir, "train_pool_predictions.jsonl"), trainEval.rows);
await writeJsonl(path.join(outputDir, "adjudication_validation_pool_predictions.jsonl"), adjudicationValidationEval.rows);
await writeJsonl(path.join(outputDir, "existing_validation_pair_predictions.jsonl"), existingValidationEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_pair_predictions.jsonl"), finalDiagnosticEval.rows);
await writeJsonl(path.join(outputDir, "final_diagnostic_selections.jsonl"), finalSelections);
await writeJsonl(path.join(outputDir, "hybrid_final_diagnostic_selections.jsonl"), hybrid.final_selection.rows);
await writeJsonl(path.join(outputDir, "constrained_validation_pool_predictions.jsonl"), constrained.validation_pool.rows);
await writeJsonl(path.join(outputDir, "constrained_existing_validation_pair_predictions.jsonl"), constrained.existing_validation_pairwise.rows);
await writeJsonl(path.join(outputDir, "constrained_final_diagnostic_pair_predictions.jsonl"), constrained.final_diagnostic_pairwise.rows);
await writeJsonl(path.join(outputDir, "constrained_final_diagnostic_selections.jsonl"), constrained.final_selection.rows);
await writeJsonl(path.join(outputDir, "constrained_policy_grid.jsonl"), constrained.candidates.map((candidate) => ({
  policy: candidate.policy,
  objective_score: candidate.objective_score,
  validation_pool: summarizePoolEval(candidate.validation_pool),
  existing_validation_pairwise: summarizePairEval(candidate.existing_validation_pairwise),
})));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function enrichPool(pool, adjudication) {
  return {
    ...pool,
    adjudication,
    candidates: pool.candidates.map((candidate) => ({
      ...candidate,
      features: candidateFeatures({ example_id: pool.root_example_id, input: pool.input }, candidate),
      selected_by_adjudicator: candidate.candidate_id === adjudication?.judgment?.selected_candidate_id,
    })),
  };
}

function poolToTrainingPairs(pool) {
  const selected = pool.candidates.find((candidate) => candidate.selected_by_adjudicator);
  if (!selected) return [];
  return pool.candidates
    .filter((candidate) => candidate.candidate_id !== selected.candidate_id)
    .map((candidate) => ({
      root_example_id: pool.root_example_id,
      source_index: pool.source_index,
      selected_candidate_id: selected.candidate_id,
      rejected_candidate_id: candidate.candidate_id,
      delta: featureNames.map((name) => selected.features[name] - candidate.features[name]),
    }));
}

function enrichPair(pair) {
  const chosenFeatures = candidateFeatures(pair, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair, pair.rejected);
  return {
    ...pair,
    chosen_features: chosenFeatures,
    rejected_features: rejectedFeatures,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function candidateFeatures(context, candidate) {
  if (candidate.answer_type === "abstain") return Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -5]));
  const claims = claimTexts(candidate);
  const claimScores = claims.map((claim) => {
    const lexical = claimFeatures(context.input, candidate, claim);
    const nli = nliFeatures(nliByKey.get(nliKeyForCandidateClaim(context, candidate, claim)));
    return { ...lexical, ...nli, claim_model: scoreClaimFeatures({ ...lexical, ...nli }, claimNliResult.model, claimNliResult.training.feature_names) };
  });
  return {
    claim_model_min: min(claimScores.map((row) => row.claim_model)),
    claim_model_mean: mean(claimScores.map((row) => row.claim_model)),
    nli_entailment_min: min(claimScores.map((row) => row.nli_entailment)),
    nli_entailment_mean: mean(claimScores.map((row) => row.nli_entailment)),
    nli_margin_min: min(claimScores.map((row) => row.nli_margin)),
    nli_margin_mean: mean(claimScores.map((row) => row.nli_margin)),
    nli_contradiction_max: max(claimScores.map((row) => row.nli_contradiction)),
    citation_count: Math.log1p((candidate.citations ?? []).length),
    answer_tokens: Math.log1p(contentTokens(candidate.answer).length),
    claim_count: Math.log1p(claims.length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
    unsupported_number_count: Math.max(...claimScores.map((row) => row.unsupported_number_count), 0),
    unsupported_comparative_count: Math.max(...claimScores.map((row) => row.unsupported_comparative_count), 0),
    short_answer_bonus: contentTokens(candidate.answer).length <= 8 ? 1 : 0,
  };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 45);
    for (const row of rows) {
      const margin = dot(weights, row);
      const gradientScale = -sigmoid(-margin);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePools(pools, model, scaler) {
  const rows = pools.map((pool) => {
    const ranked = pool.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      score: scoreCandidate(candidate.features, model, scaler),
      selected_by_adjudicator: candidate.selected_by_adjudicator,
      existing_supported_answer: candidate.existing_supported_answer,
      existing_supported_abstention: candidate.existing_supported_abstention,
      existing_unsupported_answer: candidate.existing_unsupported_answer,
    })).sort((left, right) => right.score - left.score);
    return {
      root_example_id: pool.root_example_id,
      source_index: pool.source_index,
      predicted_candidate_id: ranked[0]?.candidate_id ?? null,
      adjudicator_selected_candidate_id: pool.adjudication.judgment.selected_candidate_id,
      correct_adjudicator_choice: ranked[0]?.selected_by_adjudicator === true,
      predicted_existing_supported: Boolean(ranked[0]?.existing_supported_answer || ranked[0]?.existing_supported_abstention),
      ranked_candidates: ranked,
    };
  });
  return {
    pools: rows.length,
    correct_adjudicator_choice: rows.filter((row) => row.correct_adjudicator_choice).length,
    adjudicator_choice_accuracy: rate(rows.filter((row) => row.correct_adjudicator_choice).length, rows.length),
    selected_existing_supported: rows.filter((row) => row.predicted_existing_supported).length,
    selected_existing_support_rate: rate(rows.filter((row) => row.predicted_existing_supported).length, rows.length),
    rows,
  };
}

function evaluatePairs(pairs, model, scaler) {
  const rows = pairs.map((pair) => {
    const margin = scoreDelta(pair.delta, model, scaler);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      split: pair.split,
      source_index: pair.source_index ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
      training_use: pair.training_use,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
    rows,
  };
}

function selectDiagnosticCandidates(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidate.id)) {
        if (role === "chosen") candidates.get(candidate.id).supported_answer = true;
        continue;
      }
      candidates.set(candidate.id, {
        example_id: exampleId,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: scoreCandidate(features, model, scaler),
      });
    }
  }
  return [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
}

function tuneHybrid({ poolModel, poolScaler, hardModel, validationPools, existingValidationPairs, finalDiagnosticPairs }) {
  const candidates = [0, 0.2, 0.4, 0.6, 0.8, 1].map((alpha) => {
    const validationPool = evaluatePoolsHybrid(validationPools, poolModel, poolScaler, hardModel, alpha);
    const existingPairwise = evaluatePairsHybrid(existingValidationPairs, poolModel, poolScaler, hardModel, alpha);
    return {
      alpha,
      validation_pool: validationPool,
      existing_validation_pairwise: existingPairwise,
      final_selection: selectDiagnosticCandidatesHybrid(finalDiagnosticPairs, poolModel, poolScaler, hardModel, alpha),
    };
  });
  return candidates.sort((left, right) => {
    const poolDelta = right.validation_pool.adjudicator_choice_accuracy - left.validation_pool.adjudicator_choice_accuracy;
    if (Math.abs(poolDelta) > 1e-12) return poolDelta;
    const supportDelta = right.validation_pool.selected_existing_support_rate - left.validation_pool.selected_existing_support_rate;
    if (Math.abs(supportDelta) > 1e-12) return supportDelta;
    return right.existing_validation_pairwise.accuracy - left.existing_validation_pairwise.accuracy;
  })[0];
}

function tuneConstrainedSelector({ poolModel, poolScaler, hardModel, validationPools, existingValidationPairs, finalDiagnosticPairs }) {
  const policies = [];
  for (const alpha of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    for (const uncitedClaimPenalty of [0, 0.25, 0.5, 0.75, 1.0]) {
      for (const claimAnswerMismatchPenalty of [0, 0.25, 0.5, 0.75]) {
        for (const claimOverAnswerPenalty of [0, 0.15, 0.3]) {
          policies.push({
            alpha_pool_weight: alpha,
            uncited_claim_penalty: uncitedClaimPenalty,
            claim_answer_mismatch_penalty: claimAnswerMismatchPenalty,
            claim_over_answer_penalty: claimOverAnswerPenalty,
          });
        }
      }
    }
  }
  const candidates = policies.map((policy) => {
    const validationPool = evaluatePoolsConstrained(validationPools, poolModel, poolScaler, hardModel, policy);
    const existingPairwise = evaluatePairsConstrained(existingValidationPairs, poolModel, poolScaler, hardModel, policy);
    return {
      policy,
      validation_pool: validationPool,
      existing_validation_pairwise: existingPairwise,
      objective_score: constrainedObjective(policy, validationPool, existingPairwise),
    };
  }).sort((left, right) => {
    const objectiveDelta = right.objective_score - left.objective_score;
    if (Math.abs(objectiveDelta) > 1e-12) return objectiveDelta;
    const supportDelta = right.validation_pool.selected_existing_support_rate - left.validation_pool.selected_existing_support_rate;
    if (Math.abs(supportDelta) > 1e-12) return supportDelta;
    return left.policy.alpha_pool_weight - right.policy.alpha_pool_weight;
  });
  const selected = candidates[0];
  const finalDiagnosticPairwise = evaluatePairsConstrained(finalDiagnosticPairs, poolModel, poolScaler, hardModel, selected.policy);
  const finalSelection = selectDiagnosticCandidatesConstrained(finalDiagnosticPairs, poolModel, poolScaler, hardModel, selected.policy);
  return {
    ...selected,
    candidates,
    final_diagnostic_pairwise: finalDiagnosticPairwise,
    final_selection: finalSelection,
  };
}

function constrainedObjective(policy, validationPool, existingPairwise) {
  const poolChoice = validationPool.adjudicator_choice_accuracy;
  const poolSupport = validationPool.selected_existing_support_rate;
  const existingAccuracy = existingPairwise.accuracy;
  const poolWeightPenalty = 0.03 * policy.alpha_pool_weight;
  const consistencyPenalty = 0.005 * (policy.uncited_claim_penalty + policy.claim_answer_mismatch_penalty + policy.claim_over_answer_penalty);
  return 0.45 * poolChoice + 0.25 * poolSupport + 0.30 * existingAccuracy - poolWeightPenalty - consistencyPenalty;
}

function evaluatePoolsConstrained(pools, poolModel, poolScaler, hardModel, policy) {
  const rows = pools.map((pool) => {
    const ranked = pool.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      score: constrainedScore(candidate.features, candidate, poolModel, poolScaler, hardModel, policy),
      selected_by_adjudicator: candidate.selected_by_adjudicator,
      existing_supported_answer: candidate.existing_supported_answer,
      existing_supported_abstention: candidate.existing_supported_abstention,
      existing_unsupported_answer: candidate.existing_unsupported_answer,
      consistency_penalty: consistencyPenalty(candidate, policy),
      consistency_features: consistencyFeatures(candidate),
    })).sort((left, right) => right.score - left.score);
    return {
      root_example_id: pool.root_example_id,
      source_index: pool.source_index,
      predicted_candidate_id: ranked[0]?.candidate_id ?? null,
      adjudicator_selected_candidate_id: pool.adjudication.judgment.selected_candidate_id,
      correct_adjudicator_choice: ranked[0]?.selected_by_adjudicator === true,
      predicted_existing_supported: Boolean(ranked[0]?.existing_supported_answer || ranked[0]?.existing_supported_abstention),
      ranked_candidates: ranked,
    };
  });
  return {
    pools: rows.length,
    correct_adjudicator_choice: rows.filter((row) => row.correct_adjudicator_choice).length,
    adjudicator_choice_accuracy: rate(rows.filter((row) => row.correct_adjudicator_choice).length, rows.length),
    selected_existing_supported: rows.filter((row) => row.predicted_existing_supported).length,
    selected_existing_support_rate: rate(rows.filter((row) => row.predicted_existing_supported).length, rows.length),
    rows,
  };
}

function evaluatePairsConstrained(pairs, poolModel, poolScaler, hardModel, policy) {
  const rows = pairs.map((pair) => {
    const chosenScore = constrainedScore(pair.chosen_features, pair.chosen, poolModel, poolScaler, hardModel, policy);
    const rejectedScore = constrainedScore(pair.rejected_features, pair.rejected, poolModel, poolScaler, hardModel, policy);
    const margin = chosenScore - rejectedScore;
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      split: pair.split,
      source_index: pair.source_index ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
      chosen_consistency_penalty: consistencyPenalty(pair.chosen, policy),
      rejected_consistency_penalty: consistencyPenalty(pair.rejected, policy),
      training_use: pair.training_use,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
    rows,
  };
}

function selectDiagnosticCandidatesConstrained(pairs, poolModel, poolScaler, hardModel, policy) {
  const byExample = new Map();
  for (const pair of pairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidate.id)) {
        if (role === "chosen") candidates.get(candidate.id).supported_answer = true;
        continue;
      }
      candidates.set(candidate.id, {
        example_id: exampleId,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: constrainedScore(features, candidate, poolModel, poolScaler, hardModel, policy),
        consistency_penalty: consistencyPenalty(candidate, policy),
        consistency_features: consistencyFeatures(candidate),
      });
    }
  }
  const rows = [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      selected_consistency_penalty: ranked[0]?.consistency_penalty ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return { rows, metrics: summarizeSelections(rows) };
}

function constrainedScore(features, candidate, poolModel, poolScaler, hardModel, policy) {
  const blended = policy.alpha_pool_weight * scoreCandidate(features, poolModel, poolScaler) + (1 - policy.alpha_pool_weight) * scoreCandidateWithModelSummary(features, hardModel);
  return blended - consistencyPenalty(candidate, policy);
}

function consistencyPenalty(candidate, policy) {
  const features = consistencyFeatures(candidate);
  return policy.uncited_claim_penalty * features.uncited_claim_count
    + policy.claim_answer_mismatch_penalty * features.claim_answer_mismatch
    + policy.claim_over_answer_penalty * features.claim_over_answer_count;
}

function consistencyFeatures(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? claim.text ?? "").trim()).filter(Boolean);
  const answerTokens = new Set(contentTokens(candidate.answer));
  const answerText = normalizedText(candidate.answer);
  const uncitedClaimCount = (candidate.claim_table ?? []).filter((claim) => !(claim.citations ?? []).length).length;
  const mismatchedClaims = claims.filter((claim) => {
    const claimTokens = contentTokens(claim);
    if (!claimTokens.length) return false;
    const overlap = [...new Set(claimTokens)].filter((token) => answerTokens.has(token)).length / new Set(claimTokens).size;
    return overlap < 0.35 && !answerText.includes(normalizedText(claim));
  });
  const answerTokenCount = contentTokens(candidate.answer).length;
  const claimTokenCount = claims.reduce((total, claim) => total + contentTokens(claim).length, 0);
  return {
    uncited_claim_count: Math.log1p(uncitedClaimCount),
    claim_answer_mismatch: mismatchedClaims.length ? 1 : 0,
    claim_over_answer_count: Math.max(0, Math.log1p(claimTokenCount) - Math.log1p(answerTokenCount || 1)),
    claim_count: claims.length,
  };
}

function evaluatePoolsHybrid(pools, poolModel, poolScaler, hardModel, alpha) {
  const rows = pools.map((pool) => {
    const ranked = pool.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      score: hybridScore(candidate.features, poolModel, poolScaler, hardModel, alpha),
      selected_by_adjudicator: candidate.selected_by_adjudicator,
      existing_supported_answer: candidate.existing_supported_answer,
      existing_supported_abstention: candidate.existing_supported_abstention,
      existing_unsupported_answer: candidate.existing_unsupported_answer,
    })).sort((left, right) => right.score - left.score);
    return {
      root_example_id: pool.root_example_id,
      source_index: pool.source_index,
      predicted_candidate_id: ranked[0]?.candidate_id ?? null,
      adjudicator_selected_candidate_id: pool.adjudication.judgment.selected_candidate_id,
      correct_adjudicator_choice: ranked[0]?.selected_by_adjudicator === true,
      predicted_existing_supported: Boolean(ranked[0]?.existing_supported_answer || ranked[0]?.existing_supported_abstention),
      ranked_candidates: ranked,
    };
  });
  return {
    pools: rows.length,
    correct_adjudicator_choice: rows.filter((row) => row.correct_adjudicator_choice).length,
    adjudicator_choice_accuracy: rate(rows.filter((row) => row.correct_adjudicator_choice).length, rows.length),
    selected_existing_supported: rows.filter((row) => row.predicted_existing_supported).length,
    selected_existing_support_rate: rate(rows.filter((row) => row.predicted_existing_supported).length, rows.length),
    rows,
  };
}

function evaluatePairsHybrid(pairs, poolModel, poolScaler, hardModel, alpha) {
  const rows = pairs.map((pair) => {
    const chosenScore = hybridScore(pair.chosen_features, poolModel, poolScaler, hardModel, alpha);
    const rejectedScore = hybridScore(pair.rejected_features, poolModel, poolScaler, hardModel, alpha);
    const margin = chosenScore - rejectedScore;
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id ?? pair.root_example_id,
      split: pair.split,
      source_index: pair.source_index ?? null,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
      training_use: pair.training_use,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
    mean_margin: mean(rows.map((row) => row.margin)),
    rows,
  };
}

function selectDiagnosticCandidatesHybrid(pairs, poolModel, poolScaler, hardModel, alpha) {
  const byExample = new Map();
  for (const pair of pairs) {
    const exampleId = pair.example_id ?? pair.root_example_id;
    if (!byExample.has(exampleId)) byExample.set(exampleId, new Map());
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      const candidates = byExample.get(exampleId);
      if (candidates.has(candidate.id)) {
        if (role === "chosen") candidates.get(candidate.id).supported_answer = true;
        continue;
      }
      candidates.set(candidate.id, {
        example_id: exampleId,
        candidate_id: candidate.id,
        family: candidate.family,
        supported_answer: role === "chosen",
        score: hybridScore(features, poolModel, poolScaler, hardModel, alpha),
      });
    }
  }
  const rows = [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      selected_score: ranked[0]?.score ?? null,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      unsupported_candidate_count: ranked.filter((row) => !row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return { rows, metrics: summarizeSelections(rows) };
}

function hybridScore(features, poolModel, poolScaler, hardModel, alpha) {
  return alpha * scoreCandidate(features, poolModel, poolScaler) + (1 - alpha) * scoreCandidateWithModelSummary(features, hardModel);
}

function scoreCandidateWithModelSummary(features, modelSummary) {
  const vector = featureNames.map((name) => {
    const value = Number(features[name] ?? 0);
    return value / Number(modelSummary.scaler.std[name] || 1);
  });
  return dot(featureNames.map((name) => Number(modelSummary.weights[name] ?? 0)), vector);
}

function summarizeSelections(rows) {
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    examples_with_supported_candidate: rows.filter((row) => row.supported_candidate_count > 0).length,
  };
}

function maxSelectionMetric(left, right) {
  return left.selection_support_rate >= right.selection_support_rate ? left : right;
}

function deriveStatus(validationEval, existingValidationEval, finalSelectionMetrics) {
  if (validationEval.adjudicator_choice_accuracy >= 0.75 && existingValidationEval.accuracy >= 0.75 && finalSelectionMetrics.selection_support_rate >= 0.75) return "constrained_selector_promising";
  if (validationEval.adjudicator_choice_accuracy >= 0.5 || finalSelectionMetrics.selection_support_rate >= 0.5) return "constrained_selector_partial_signal";
  return "constrained_selector_not_sufficient";
}

function decisionFromMetrics(validationEval, existingValidationEval, finalSelectionMetrics, hybrid, constrained) {
  const bestSelection = [finalSelectionMetrics, hybrid.final_selection.metrics, constrained.final_selection.metrics]
    .sort((left, right) => right.selection_support_rate - left.selection_support_rate)[0];
  if (validationEval.adjudicator_choice_accuracy >= 0.75 && existingValidationEval.accuracy >= 0.75 && bestSelection.selection_support_rate >= 0.75) {
    return { integrate_selector_now: true, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "A constrained selector clears validation and final diagnostic thresholds.", next_step: "Integrate this constrained selector and evaluate amortized cost/coverage." };
  }
  if (constrained.final_selection.metrics.selection_support_rate > finalSelectionMetrics.selection_support_rate) {
    return { integrate_selector_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "The constrained selector recovers final diagnostic support relative to pool-only selection but does not yet clear the conference-grade threshold.", next_step: "Use this constrained objective as the next scaffold baseline and target remaining both-fail final examples before buying more labels." };
  }
  return { integrate_selector_now: false, launch_gpu_now: false, buy_more_openai_labels_now: false, reason: "Constrained pool-pairwise scoring does not improve final diagnostic selection enough.", next_step: "Inspect the remaining both-fail final examples and only then decide whether another targeted label batch is justified." };
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
}

function fitScaleOnlyScaler(vectors) {
  const std = {};
  featureNames.forEach((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const center = mean(values);
    const variance = mean(values.map((value) => (value - center) ** 2));
    std[name] = Math.sqrt(variance) || 1;
  });
  return { mean: Object.fromEntries(featureNames.map((name) => [name, 0])), std };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => value / Number(scaler.std[featureNames[index]] || 1));
}

function scoreClaimFeatures(features, model, modelFeatureNames) {
  const vector = modelFeatureNames.map((name) => (Number(features[name] ?? 0) - Number(model.scaler.mean[name] ?? 0)) / Number(model.scaler.std[name] || 1));
  return sigmoid(model.intercept + dot(modelFeatureNames.map((name) => Number(model.weights[name] ?? 0)), vector));
}

function claimFeatures(input, candidate, claim) {
  const citedText = citedEvidenceText(input, candidate);
  const questionTokens = contentTokens(input.question);
  const claimNumbers = numberTokens(claim).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question).map(normalizeNumber));
  const unsupportedNumbers = claimNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number)).length;
  return {
    unsupported_number_count: Math.log1p(unsupportedNumbers),
    unsupported_comparative_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, comparativeTerms).length),
    claim_cited_token_coverage: tokenCoverage(contentTokens(claim), contentTokens(citedText)),
    claim_pack_token_coverage: tokenCoverage(contentTokens(claim), contentTokens((input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" "))),
    claim_best_sentence_coverage: 0,
    unsupported_claim_token_rate: 0,
    numeric_supported_rate: claimNumbers.length ? (claimNumbers.length - unsupportedNumbers) / claimNumbers.length : 1,
    unsupported_quantifier_count: 0,
    question_claim_overlap: tokenCoverage(questionTokens, contentTokens(claim)),
    question_cited_overlap: tokenCoverage(questionTokens, contentTokens(citedText)),
    claim_token_count: Math.log1p(contentTokens(claim).length),
    citation_count: Math.log1p((candidate.citations ?? []).length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
  };
}

function nliFeatures(nli) {
  return { nli_entailment: Number(nli?.entailment ?? 0), nli_contradiction: Number(nli?.contradiction ?? 0), nli_margin: Number(nli?.margin ?? 0) };
}

function nliKeyForCandidateClaim(context, candidate, claim) {
  return `candidate::${context.example_id ?? context.root_example_id}::${candidate.id ?? candidate.candidate_id}::${hashString(claim)}`;
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) return [answer, ...claims];
  return claims;
}

function citedEvidenceText(input, candidate) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  return (candidate.citations ?? []).map((id) => evidenceById.get(String(id).replace(/^\[/, "").replace(/\]$/, ""))?.text ?? "").join(" ");
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function unsupportedTerms(text, citedText, question, terms) {
  const citedTerms = new Set(matchedTerms(citedText, terms));
  const questionTerms = new Set(matchedTerms(question, terms));
  return matchedTerms(text, terms).filter((term) => !citedTerms.has(term) && !questionTerms.has(term));
}

function matchedTerms(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`).test(text));
}

function contentTokens(value) {
  return stripCitations(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopwords.has(token));
}

function stripCitations(value) {
  return String(value ?? "").replace(/\[[^\]]+\]/g, " ");
}

function numberTokens(value) {
  return String(value ?? "").match(/[-+]?\d+(?:[.,]\d+)*(?:%| percent)?/gi) ?? [];
}

function normalizeNumber(value) {
  return String(value ?? "").toLowerCase().replace(/,/g, "").replace(/\s+percent\b/, "%");
}

function normalizedText(value) {
  return contentTokens(value).join(" ");
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizePoolEval(evalResult) {
  return { pools: evalResult.pools, correct_adjudicator_choice: evalResult.correct_adjudicator_choice, adjudicator_choice_accuracy: evalResult.adjudicator_choice_accuracy, selected_existing_supported: evalResult.selected_existing_supported, selected_existing_support_rate: evalResult.selected_existing_support_rate };
}

function summarizePairEval(evalResult) {
  return { pairs: evalResult.pairs, correct: evalResult.correct, accuracy: evalResult.accuracy, mean_margin: evalResult.mean_margin };
}

function renderReport(result) {
  const constrained = result.metrics.constrained_pool_pairwise_selector;
  return `# Constrained Pool-Pairwise Selector

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no new LLM calls. It reuses paid non-final GPT-4o pool adjudications, constrains them with the D258 pairwise support model, and uses final-window labels only as forbidden diagnostics.

| Split | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train pool choice | ${result.metrics.train_pool_choice.pools} | ${result.metrics.train_pool_choice.correct_adjudicator_choice} | ${pct(result.metrics.train_pool_choice.adjudicator_choice_accuracy)} |
| Adjudication validation pool choice | ${result.metrics.adjudication_validation_pool_choice.pools} | ${result.metrics.adjudication_validation_pool_choice.correct_adjudicator_choice} | ${pct(result.metrics.adjudication_validation_pool_choice.adjudicator_choice_accuracy)} |
| Existing validation pairwise | ${result.metrics.existing_validation_pairwise.pairs} | ${result.metrics.existing_validation_pairwise.correct} | ${pct(result.metrics.existing_validation_pairwise.accuracy)} |
| Final diagnostic pairwise | ${result.metrics.final_diagnostic_pairwise.pairs} | ${result.metrics.final_diagnostic_pairwise.correct} | ${pct(result.metrics.final_diagnostic_pairwise.accuracy)} |
| Pool-only final selection | ${result.metrics.final_diagnostic_selection.examples} | ${result.metrics.final_diagnostic_selection.selected_supported} | ${pct(result.metrics.final_diagnostic_selection.selection_support_rate)} |
| Hybrid final selection | ${result.metrics.hybrid_pool_pairwise_selector.final_diagnostic_selection.examples} | ${result.metrics.hybrid_pool_pairwise_selector.final_diagnostic_selection.selected_supported} | ${pct(result.metrics.hybrid_pool_pairwise_selector.final_diagnostic_selection.selection_support_rate)} |
| Constrained validation pool choice | ${constrained.adjudication_validation_pool_choice.pools} | ${constrained.adjudication_validation_pool_choice.correct_adjudicator_choice} | ${pct(constrained.adjudication_validation_pool_choice.adjudicator_choice_accuracy)} |
| Constrained existing validation pairwise | ${constrained.existing_validation_pairwise.pairs} | ${constrained.existing_validation_pairwise.correct} | ${pct(constrained.existing_validation_pairwise.accuracy)} |
| Constrained final diagnostic pairwise | ${constrained.final_diagnostic_pairwise.pairs} | ${constrained.final_diagnostic_pairwise.correct} | ${pct(constrained.final_diagnostic_pairwise.accuracy)} |
| Constrained final selection | ${constrained.final_diagnostic_selection.examples} | ${constrained.final_diagnostic_selection.selected_supported} | ${pct(constrained.final_diagnostic_selection.selection_support_rate)} |

## Selected Policy

\`\`\`json
${JSON.stringify(result.tuning.selected_policy, null, 2)}
\`\`\`

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function min(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : 0;
}

function max(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value || 0)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
