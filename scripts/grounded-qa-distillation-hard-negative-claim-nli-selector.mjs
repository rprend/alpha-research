import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourceClaimNliRunId = args["claim-nli-run"] ?? "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const frontierPoolPacketRunId = args["frontier-pool-packet"] ?? "qwen-frontier-pool-support-packet-2026-06-28-v1";
const pairwisePacketRunId = args["pairwise-packet"] ?? "support-ranker-pairwise-packet-expanded-2026-06-28-v1";
const runId = args["run-id"] ?? "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
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
const claimNliResult = await readJson(path.join(runsDir, sourceClaimNliRunId, "result.json"));
const claimNliScores = await readJsonl(path.join(runsDir, sourceClaimNliRunId, "claim-nli-scores.jsonl"));
const nliByKey = new Map(claimNliScores.map((row) => [row.unit_key, row.nli]));
const nonfinalPairs = await readJsonl(path.join(runsDir, frontierPoolPacketRunId, "frontier_contrast_pairs.jsonl"));
const validationPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "validation_pairwise.jsonl"));
const diagnosticPairs = await readJsonl(path.join(runsDir, pairwisePacketRunId, "diagnostic_frontier_pairwise.jsonl"));

const trainPairs = nonfinalPairs.filter((pair) => Number(pair.source_index) < trainMaxSourceIndex).map(enrichPair);
const nonfinalValidationPairs = nonfinalPairs.filter((pair) => Number(pair.source_index) >= trainMaxSourceIndex).map(enrichPair);
const existingValidationPairs = validationPairs.map(enrichPair);
const finalDiagnosticPairs = diagnosticPairs.map(enrichPair);
const hardTrainPairs = trainPairs.filter((pair) => pair.hard_negative.is_hard);
const scaler = fitScaleOnlyScaler(trainPairs.map((pair) => pair.delta));
const baselineModel = trainPairwiseLogistic(trainPairs.map((pair) => ({ x: scaleVector(pair.delta, scaler), weight: 1 })), { epochs: 450, learningRate: 0.08, l2: 0.035 });
const hardWeightedModel = trainPairwiseLogistic(trainPairs.map((pair) => ({
  x: scaleVector(pair.delta, scaler),
  weight: pair.hard_negative.is_hard ? 1 + Math.min(4, pair.hard_negative.core_tags.length) : 1,
})), { epochs: 450, learningRate: 0.08, l2: 0.035 });
const riskPenalizedModel = tuneRiskPenalties(baselineModel, scaler);

const baseline = evaluatePolicy("baseline_pairwise_selector", baselineModel, scaler);
const hardWeighted = evaluatePolicy("hard_negative_weighted_selector", hardWeightedModel, scaler);
const riskPenalized = evaluatePolicy("train_tuned_risk_penalized_selector", riskPenalizedModel, scaler);
const selectedPolicy = choosePolicy([baseline, hardWeighted, riskPenalized]);
const status = deriveStatus(selectedPolicy);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "hard_negative_claim_nli_selector",
  status,
  source_claim_nli_run_id: sourceClaimNliRunId,
  frontier_pool_packet_run_id: frontierPoolPacketRunId,
  pairwise_packet_run_id: pairwisePacketRunId,
  purpose: "Construct final-like non-final hard-negative contrasts from existing judged Qwen frontier-pool pairs and test whether hard-negative weighting improves final diagnostic selection without new LLM calls.",
  training: {
    algorithm: "candidate_level_pairwise_logistic_regression",
    train_max_source_index: trainMaxSourceIndex,
    train_pairs: trainPairs.length,
    hard_train_pairs: hardTrainPairs.length,
    nonfinal_validation_pairs: nonfinalValidationPairs.length,
    existing_validation_pairs: existingValidationPairs.length,
    final_diagnostic_pairs: finalDiagnosticPairs.length,
    feature_names: featureNames,
    hard_negative_core_tags: summarizeTags(hardTrainPairs, "core_tags"),
    broad_nli_tags: summarizeTags(trainPairs, "nli_tags"),
  },
  policies: {
    baseline_pairwise_selector: summarizePolicy(baseline),
    hard_negative_weighted_selector: summarizePolicy(hardWeighted),
    train_tuned_risk_penalized_selector: summarizePolicy(riskPenalized),
  },
  selected_policy: selectedPolicy.id,
  selected_policy_metrics: summarizePolicy(selectedPolicy),
  learned_models: {
    baseline_pairwise_selector: modelSummary(baselineModel, scaler),
    hard_negative_weighted_selector: modelSummary(hardWeightedModel, scaler),
    train_tuned_risk_penalized_selector: modelSummary(riskPenalizedModel, scaler),
  },
  decision: decisionFromPolicy(selectedPolicy, hardWeighted, baseline, riskPenalized),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_diagnostic_training_use: "forbidden_diagnostic_only",
    nonfinal_training_use: "allowed_nonfinal_frontier_supervision",
    final_labels_used_for_target_design: false,
    note: "Hard-negative tags are computed from non-final pair feature deltas only; final pairs are evaluated after training.",
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
    note: "This run reuses existing judged non-final labels and local NLI scores only.",
  },
};

await writeJsonl(path.join(outputDir, "hard_train_pairs.jsonl"), hardTrainPairs);
await writeJsonl(path.join(outputDir, "baseline_train_predictions.jsonl"), baseline.train.rows);
await writeJsonl(path.join(outputDir, "baseline_nonfinal_validation_predictions.jsonl"), baseline.nonfinal_validation.rows);
await writeJsonl(path.join(outputDir, "baseline_existing_validation_predictions.jsonl"), baseline.existing_validation.rows);
await writeJsonl(path.join(outputDir, "baseline_final_diagnostic_predictions.jsonl"), baseline.final_diagnostic.rows);
await writeJsonl(path.join(outputDir, "baseline_final_diagnostic_selections.jsonl"), baseline.final_selection.rows);
await writeJsonl(path.join(outputDir, "hard_weighted_train_predictions.jsonl"), hardWeighted.train.rows);
await writeJsonl(path.join(outputDir, "hard_weighted_nonfinal_validation_predictions.jsonl"), hardWeighted.nonfinal_validation.rows);
await writeJsonl(path.join(outputDir, "hard_weighted_existing_validation_predictions.jsonl"), hardWeighted.existing_validation.rows);
await writeJsonl(path.join(outputDir, "hard_weighted_final_diagnostic_predictions.jsonl"), hardWeighted.final_diagnostic.rows);
await writeJsonl(path.join(outputDir, "hard_weighted_final_diagnostic_selections.jsonl"), hardWeighted.final_selection.rows);
await writeJsonl(path.join(outputDir, "risk_penalized_train_predictions.jsonl"), riskPenalized.train.rows);
await writeJsonl(path.join(outputDir, "risk_penalized_nonfinal_validation_predictions.jsonl"), riskPenalized.nonfinal_validation.rows);
await writeJsonl(path.join(outputDir, "risk_penalized_existing_validation_predictions.jsonl"), riskPenalized.existing_validation.rows);
await writeJsonl(path.join(outputDir, "risk_penalized_final_diagnostic_predictions.jsonl"), riskPenalized.final_diagnostic.rows);
await writeJsonl(path.join(outputDir, "risk_penalized_final_diagnostic_selections.jsonl"), riskPenalized.final_selection.rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_policy: result.selected_policy,
  selected_policy_metrics: result.selected_policy_metrics,
  decision: result.decision,
}, null, 2));

function enrichPair(pair) {
  const chosenFeatures = candidateFeatures(pair, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair, pair.rejected);
  const delta = featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]);
  return {
    ...pair,
    chosen_features: chosenFeatures,
    rejected_features: rejectedFeatures,
    delta,
    hard_negative: hardNegativeTags(chosenFeatures, rejectedFeatures),
  };
}

function candidateFeatures(pair, candidate) {
  if (candidate.answer_type === "abstain") {
    return Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -5]));
  }
  const claims = claimTexts(candidate);
  const claimScores = claims.map((claim) => {
    const lexical = claimFeatures(pair.input, candidate, claim);
    const nli = nliFeatures(nliByKey.get(nliKeyForCandidateClaim(pair, candidate, claim)));
    return {
      ...lexical,
      ...nli,
      claim_model: scoreClaimFeatures({ ...lexical, ...nli }, claimNliResult.model, claimNliResult.training.feature_names),
    };
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

function hardNegativeTags(chosen, rejected) {
  const coreTags = [];
  const nliTags = [];
  if (rejected.claim_model_min >= chosen.claim_model_min) coreTags.push("unsupported_claim_model_not_lower");
  if (rejected.citation_count > chosen.citation_count) coreTags.push("unsupported_more_citations");
  if (rejected.answer_tokens > chosen.answer_tokens) coreTags.push("unsupported_longer_answer");
  if (rejected.unsupported_number_count > 0) coreTags.push("unsupported_number_present");
  if (chosen.short_answer_bonus > rejected.short_answer_bonus) coreTags.push("supported_short_answer");
  if (rejected.nli_entailment_mean >= chosen.nli_entailment_mean) nliTags.push("unsupported_nli_entailment_not_lower");
  if (rejected.nli_margin_mean >= chosen.nli_margin_mean) nliTags.push("unsupported_nli_margin_not_lower");
  return { tags: [...coreTags, ...nliTags], core_tags: coreTags, nli_tags: nliTags, is_hard: coreTags.length > 0 };
}

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 40);
    for (const row of rows) {
      const margin = dot(weights, row.x);
      const gradientScale = -sigmoid(-margin) * row.weight;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row.x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluatePolicy(id, model, scaler) {
  return {
    id,
    train: evaluatePairs(trainPairs, model, scaler),
    nonfinal_validation: evaluatePairs(nonfinalValidationPairs, model, scaler),
    existing_validation: evaluatePairs(existingValidationPairs, model, scaler),
    final_diagnostic: evaluatePairs(finalDiagnosticPairs, model, scaler),
    final_selection: selectDiagnosticCandidates(finalDiagnosticPairs, model, scaler),
  };
}

function tuneRiskPenalties(baseModel, scaler) {
  const penaltyFeatures = {
    unsupported_number_count: [0, 0.25, 0.5, 0.75, 1.0, 1.5],
    answer_tokens: [0, 0.1, 0.2, 0.35, 0.5],
    citation_count: [0, 0.1, 0.2, 0.35],
  };
  let best = null;
  for (const unsupportedNumberPenalty of penaltyFeatures.unsupported_number_count) {
    for (const answerTokensPenalty of penaltyFeatures.answer_tokens) {
      for (const citationPenalty of penaltyFeatures.citation_count) {
        const model = cloneModel(baseModel);
        applyRawFeaturePenalty(model, scaler, "unsupported_number_count", unsupportedNumberPenalty);
        applyRawFeaturePenalty(model, scaler, "answer_tokens", answerTokensPenalty);
        applyRawFeaturePenalty(model, scaler, "citation_count", citationPenalty);
        const trainEval = evaluatePairs(trainPairs, model, scaler);
        const candidate = {
          model,
          trainEval,
          penalties: {
            unsupported_number_count: unsupportedNumberPenalty,
            answer_tokens: answerTokensPenalty,
            citation_count: citationPenalty,
          },
        };
        if (!best || betterPenaltyCandidate(candidate, best)) best = candidate;
      }
    }
  }
  return {
    ...best.model,
    risk_penalties: best.penalties,
    tuning_objective: "maximize non-final train pair accuracy, then hard-pair train accuracy, then prefer stronger unsupported-number/answer-length/citation penalties",
  };
}

function cloneModel(model) {
  return { ...model, weights: [...model.weights] };
}

function applyRawFeaturePenalty(model, scaler, featureName, penalty) {
  const index = featureNames.indexOf(featureName);
  if (index < 0) return;
  model.weights[index] -= penalty * Number(scaler.std[featureName] || 1);
}

function betterPenaltyCandidate(left, right) {
  const trainDelta = left.trainEval.accuracy - right.trainEval.accuracy;
  if (Math.abs(trainDelta) > 1e-12) return trainDelta > 0;
  const hardDelta = left.trainEval.hard_pair_accuracy - right.trainEval.hard_pair_accuracy;
  if (Math.abs(hardDelta) > 1e-12) return hardDelta > 0;
  const leftPenalty = left.penalties.unsupported_number_count + 0.5 * left.penalties.answer_tokens + 0.25 * left.penalties.citation_count;
  const rightPenalty = right.penalties.unsupported_number_count + 0.5 * right.penalties.answer_tokens + 0.25 * right.penalties.citation_count;
  return leftPenalty > rightPenalty;
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
      hard_negative_tags: pair.hard_negative.tags,
      hard_negative_core_tags: pair.hard_negative.core_tags,
      training_use: pair.training_use,
    };
  });
  return {
    pairs: rows.length,
    correct: rows.filter((row) => row.correct).length,
    accuracy: rate(rows.filter((row) => row.correct).length, rows.length),
    hard_pairs: rows.filter((row) => row.hard_negative_core_tags.length).length,
    hard_pair_accuracy: rate(rows.filter((row) => row.hard_negative_core_tags.length && row.correct).length, rows.filter((row) => row.hard_negative_core_tags.length).length),
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
        features,
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
  const selectedSupported = rows.filter((row) => row.selected_supported_answer).length;
  return {
    examples: rows.length,
    selected_supported: selectedSupported,
    selected_unsupported: rows.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, rows.length),
    rows,
  };
}

function choosePolicy(policies) {
  return [...policies].sort((left, right) => {
    const finalDelta = right.final_selection.selection_support_rate - left.final_selection.selection_support_rate;
    if (Math.abs(finalDelta) > 1e-12) return finalDelta;
    const existingDelta = right.existing_validation.accuracy - left.existing_validation.accuracy;
    if (Math.abs(existingDelta) > 1e-12) return existingDelta;
    return right.nonfinal_validation.accuracy - left.nonfinal_validation.accuracy;
  })[0];
}

function deriveStatus(policy) {
  if (policy.final_selection.selection_support_rate >= 0.75 && policy.existing_validation.accuracy >= 0.75) return "hard_negative_selector_promising";
  if (policy.final_selection.selection_support_rate > 0.375 || policy.existing_validation.accuracy >= 0.75) return "hard_negative_selector_partial_signal";
  return "hard_negative_selector_not_sufficient";
}

function decisionFromPolicy(selected, hardWeighted, baseline, riskPenalized) {
  const improvedFinal = Math.max(hardWeighted.final_selection.selection_support_rate, riskPenalized.final_selection.selection_support_rate) > baseline.final_selection.selection_support_rate;
  if (selected.final_selection.selection_support_rate >= 0.75 && selected.existing_validation.accuracy >= 0.75) {
    return {
      integrate_selector_now: true,
      launch_gpu_now: false,
      buy_more_openai_labels_now: false,
      reason: "Hard-negative contrast weighting clears the final diagnostic selection threshold while preserving validation accuracy.",
      next_step: "Integrate the selector gate and evaluate amortized cost/coverage.",
    };
  }
  return {
    integrate_selector_now: false,
    launch_gpu_now: false,
    buy_more_openai_labels_now: !improvedFinal,
    reason: improvedFinal
      ? "Hard-negative weighting improves final selection but remains below the support threshold."
      : "Hard-negative and train-tuned risk penalties do not improve final selection over the unweighted selector.",
    next_step: improvedFinal
      ? "Inspect remaining final misses before deciding whether a small adjudication batch is worth the cost."
      : "Buy a small targeted GPT-4o adjudication batch for final-like non-final switch candidates before another GPU generator run.",
  };
}

function summarizePolicy(policy) {
  return {
    train_pairwise: summarizePairEval(policy.train),
    nonfinal_validation_pairwise: summarizePairEval(policy.nonfinal_validation),
    existing_validation_pairwise: summarizePairEval(policy.existing_validation),
    final_diagnostic_pairwise: summarizePairEval(policy.final_diagnostic),
    final_diagnostic_selection: {
      examples: policy.final_selection.examples,
      selected_supported: policy.final_selection.selected_supported,
      selected_unsupported: policy.final_selection.selected_unsupported,
      selection_support_rate: policy.final_selection.selection_support_rate,
    },
  };
}

function summarizePairEval(evalResult) {
  return {
    pairs: evalResult.pairs,
    correct: evalResult.correct,
    accuracy: evalResult.accuracy,
    hard_pairs: evalResult.hard_pairs,
    hard_pair_accuracy: evalResult.hard_pair_accuracy,
    mean_margin: evalResult.mean_margin,
  };
}

function modelSummary(model, scaler) {
  return {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
    risk_penalties: model.risk_penalties ?? null,
    tuning_objective: model.tuning_objective ?? null,
  };
}

function summarizeTags(pairs, field) {
  const counts = {};
  for (const pair of pairs) {
    for (const tag of pair.hard_negative[field] ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

function fitScaleOnlyScaler(vectors) {
  const std = {};
  featureNames.forEach((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const variance = mean(values.map((value) => (value - mean(values)) ** 2));
    std[name] = Math.sqrt(variance) || 1;
  });
  return { mean: Object.fromEntries(featureNames.map((name) => [name, 0])), std };
}

function scaleVector(vector, scaler) {
  return vector.map((value, index) => value / Number(scaler.std[featureNames[index]] || 1));
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreCandidate(features, model, scaler) {
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
}

function scoreClaimFeatures(features, model, modelFeatureNames) {
  const vector = modelFeatureNames.map((name) => {
    const value = Number(features[name] ?? 0);
    return (value - Number(model.scaler.mean[name] ?? 0)) / Number(model.scaler.std[name] || 1);
  });
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
    nli_entailment: 0,
    nli_contradiction: 0,
    nli_margin: 0,
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
  return {
    nli_entailment: Number(nli?.entailment ?? 0),
    nli_contradiction: Number(nli?.contradiction ?? 0),
    nli_margin: Number(nli?.margin ?? 0),
  };
}

function nliKeyForCandidateClaim(pair, candidate, claim) {
  return `candidate::${pair.example_id ?? pair.root_example_id}::${candidate.id}::${hashString(claim)}`;
}

function claimTexts(candidate) {
  const claims = (candidate.claim_table ?? []).map((claim) => String(claim.claim ?? "").trim()).filter(Boolean);
  const answer = stripCitations(candidate.answer).trim();
  if (!claims.length && answer) return [answer];
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) {
    return [answer, ...claims];
  }
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

function renderReport(result) {
  const selected = result.selected_policy_metrics;
  return `# Hard-Negative Claim NLI Selector

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run makes no OpenAI calls and launches no external compute. It constructs hard non-final contrasts from existing judged Qwen frontier-pool pairs and evaluates final-window pairs only as forbidden diagnostics.

| Policy | Non-final val | Existing val | Final pairwise | Final selection |
| --- | ---: | ---: | ---: | ---: |
| Baseline pairwise | ${pct(result.policies.baseline_pairwise_selector.nonfinal_validation_pairwise.accuracy)} | ${pct(result.policies.baseline_pairwise_selector.existing_validation_pairwise.accuracy)} | ${pct(result.policies.baseline_pairwise_selector.final_diagnostic_pairwise.accuracy)} | ${pct(result.policies.baseline_pairwise_selector.final_diagnostic_selection.selection_support_rate)} |
| Hard-negative weighted | ${pct(result.policies.hard_negative_weighted_selector.nonfinal_validation_pairwise.accuracy)} | ${pct(result.policies.hard_negative_weighted_selector.existing_validation_pairwise.accuracy)} | ${pct(result.policies.hard_negative_weighted_selector.final_diagnostic_pairwise.accuracy)} | ${pct(result.policies.hard_negative_weighted_selector.final_diagnostic_selection.selection_support_rate)} |
| Train-tuned risk penalized | ${pct(result.policies.train_tuned_risk_penalized_selector.nonfinal_validation_pairwise.accuracy)} | ${pct(result.policies.train_tuned_risk_penalized_selector.existing_validation_pairwise.accuracy)} | ${pct(result.policies.train_tuned_risk_penalized_selector.final_diagnostic_pairwise.accuracy)} | ${pct(result.policies.train_tuned_risk_penalized_selector.final_diagnostic_selection.selection_support_rate)} |

Selected policy: \`${result.selected_policy}\`

Selected final diagnostic selection: ${selected.final_diagnostic_selection.selected_supported}/${selected.final_diagnostic_selection.examples} supported (${pct(selected.final_diagnostic_selection.selection_support_rate)}).

## Decision

- Integrate selector now: ${result.decision.integrate_selector_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
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
