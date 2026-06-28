import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const trainNliRunId = args["train-nli"] ?? "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const evalPacketRunId = args["eval-packet"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const evalNliRunId = args["eval-nli"] ?? "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const finalReplayRunId = args["final-replay"] ?? "final-margin-compatible-heldout-eval-321-389-2026-06-28-v1";
const claimNliRunId = "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1";
const runId = args["run-id"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
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
const quantifierTerms = ["all", "every", "only", "none", "always", "never", "total"];
const stopwords = new Set(["the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "but", "not", "can", "may", "its", "into", "than", "then", "also", "been", "their", "there", "which", "while", "using", "used", "use", "true", "false", "answer", "claim", "evidence", "support", "supported"]);

await fs.mkdir(outputDir, { recursive: true });

const trainPacket = await readJson(path.join(runsDir, trainPacketRunId, "result.json"));
const evalPacket = await readJson(path.join(runsDir, evalPacketRunId, "result.json"));
const trainPairsRaw = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const evalPairsRaw = await readJsonl(path.join(runsDir, evalPacketRunId, "heldout_pairwise.jsonl"));
const trainNliRows = await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl"));
const evalNliRows = await readJsonl(path.join(runsDir, evalNliRunId, "claim-nli-scores.jsonl"));
const claimNliResult = await readJson(path.join(runsDir, claimNliRunId, "result.json"));
const finalReplay = await readJson(path.join(runsDir, finalReplayRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const nliByKey = new Map([...trainNliRows, ...evalNliRows].map((row) => [row.unit_key, row.nli]));

const trainPairs = trainPairsRaw.map(enrichPair);
const evalPairs = evalPairsRaw.map(enrichPair);
const scaler = fitScaleOnlyScaler(trainPairs.map((row) => row.delta));
const baselineModel = trainPairwiseLogistic(trainPairs.map((row) => ({
  x: scaleVector(row.delta, scaler),
  weight: 1,
})), { epochs: 700, learningRate: 0.07, l2: 0.04 });
const hardWeightedModel = trainPairwiseLogistic(trainPairs.map((row) => ({
  x: scaleVector(row.delta, scaler),
  weight: row.hard_negative.core_tags.length ? 2.5 : 1,
})), { epochs: 700, learningRate: 0.07, l2: 0.04 });

const baselineTrain = evaluatePairs(trainPairs, baselineModel, scaler);
const baselineEval = evaluatePairs(evalPairs, baselineModel, scaler);
const baselineSelection = selectCandidates(evalPairs, baselineModel, scaler);
const hardTrain = evaluatePairs(trainPairs, hardWeightedModel, scaler);
const hardEval = evaluatePairs(evalPairs, hardWeightedModel, scaler);
const hardSelection = selectCandidates(evalPairs, hardWeightedModel, scaler);
const selected = choosePolicy([
  { id: "nonfinal_broad_pairwise", train: baselineTrain, eval: baselineEval, selection: baselineSelection, model: baselineModel },
  { id: "nonfinal_broad_hard_weighted", train: hardTrain, eval: hardEval, selection: hardSelection, model: hardWeightedModel },
]);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "broad_contrast_selector_transfer",
  status: deriveStatus(selected),
  purpose: "Train broad margin-compatible selectors on existing judged non-final answer contrasts and evaluate transfer to the broad final-window heldout without using final labels for fitting.",
  source_runs: {
    train_packet: trainPacketRunId,
    train_nli: trainNliRunId,
    eval_packet: evalPacketRunId,
    eval_nli: evalNliRunId,
    final_replay: finalReplayRunId,
    claim_nli_verifier: claimNliRunId,
  },
  training: {
    train_pairs: trainPairs.length,
    train_examples: new Set(trainPairs.map((row) => row.example_id)).size,
    eval_pairs: evalPairs.length,
    eval_examples: new Set(evalPairs.map((row) => row.example_id)).size,
    feature_names: featureNames,
    algorithm: "scale_only_pairwise_logistic_regression",
  },
  policies: {
    nonfinal_broad_pairwise: summarizePolicy(baselineTrain, baselineEval, baselineSelection),
    nonfinal_broad_hard_weighted: summarizePolicy(hardTrain, hardEval, hardSelection),
  },
  selected_policy: selected.id,
  selected_policy_metrics: summarizePolicy(selected.train, selected.eval, selected.selection),
  broad_final_baselines: {
    d262_pairwise: finalReplay.metrics?.d262_pairwise,
    hard_negative_pairwise: finalReplay.metrics?.hard_negative_pairwise,
    d280_frozen_pairwise: finalReplay.metrics?.d280_frozen_pairwise,
    d280_frozen_selection: finalReplay.metrics?.d280_frozen_selection,
  },
  learned_model: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, selected.model.weights[index]])),
    scaler,
    epochs: selected.model.epochs,
    learning_rate: selected.model.learningRate,
    l2: selected.model.l2,
  },
  decision: decisionFromSelected(selected, finalReplay),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_used_for_evaluation_only: true,
    train_packet_training_use: trainPacket.leakage_guard?.training_use,
    eval_packet_training_use: evalPacket.leakage_guard?.training_use,
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
    note: "Zero-call selector training over existing labels and local NLI features.",
  },
};

await writeJsonl(path.join(outputDir, "train_pair_predictions.jsonl"), selected.train.rows);
await writeJsonl(path.join(outputDir, "final_pair_predictions.jsonl"), selected.eval.rows);
await writeJsonl(path.join(outputDir, "final_selections.jsonl"), selected.selection.rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  selected_policy: result.selected_policy,
  selected_policy_metrics: result.selected_policy_metrics,
  decision: result.decision,
}, null, 2));

function enrichPair(pair) {
  const chosenFeatures = candidateFeatures(pair, pair.chosen);
  const rejectedFeatures = candidateFeatures(pair, pair.rejected);
  return {
    ...pair,
    chosen_features: chosenFeatures.features,
    rejected_features: rejectedFeatures.features,
    delta: featureNames.map((name) => chosenFeatures.features[name] - rejectedFeatures.features[name]),
    hard_negative: hardNegativeTags(chosenFeatures.features, rejectedFeatures.features),
    missing_nli_scores: chosenFeatures.missing_nli_scores + rejectedFeatures.missing_nli_scores,
  };
}

function candidateFeatures(pair, candidate) {
  if (candidate.answer_type === "abstain") {
    return {
      missing_nli_scores: 0,
      features: Object.fromEntries(featureNames.map((name) => [name, name === "short_answer_bonus" ? 0 : -5])),
    };
  }
  const claims = claimTexts(candidate);
  let missing = 0;
  const claimScores = claims.map((claim) => {
    const lexical = claimFeatures(pair.input, candidate, claim);
    const key = nliKeyForCandidateClaim(pair, candidate, claim);
    const nli = nliFeatures(nliByKey.get(key));
    if (!nliByKey.has(key)) missing += 1;
    return {
      ...lexical,
      ...nli,
      claim_model: scoreClaimFeatures({ ...lexical, ...nli }, claimNliResult.model, claimNliResult.training.feature_names),
    };
  });
  return {
    missing_nli_scores: missing,
    features: {
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
    },
  };
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

function evaluatePairs(pairs, model, scaler) {
  const rows = pairs.map((pair) => {
    const margin = scoreDelta(pair.delta, model, scaler);
    return {
      pair_id: pair.pair_id,
      example_id: pair.example_id,
      source_index: pair.source_index,
      predicted_preferred: margin >= 0 ? "chosen" : "rejected",
      correct: margin >= 0,
      margin,
      chosen_id: pair.chosen.id,
      rejected_id: pair.rejected.id,
      hard_negative_tags: pair.hard_negative.tags,
      hard_negative_core_tags: pair.hard_negative.core_tags,
      missing_nli_scores: pair.missing_nli_scores,
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

function selectCandidates(pairs, model, scaler) {
  const byExample = new Map();
  for (const pair of pairs) {
    if (!byExample.has(pair.example_id)) byExample.set(pair.example_id, new Map());
    const candidates = byExample.get(pair.example_id);
    for (const [role, candidate, features] of [["chosen", pair.chosen, pair.chosen_features], ["rejected", pair.rejected, pair.rejected_features]]) {
      if (!candidates.has(candidate.id)) {
        candidates.set(candidate.id, {
          example_id: pair.example_id,
          candidate_id: candidate.id,
          family: candidate.family,
          supported_answer: role === "chosen",
          score: scoreCandidate(features, model, scaler),
        });
      }
      if (role === "chosen") candidates.get(candidate.id).supported_answer = true;
    }
  }
  const rows = [...byExample.entries()].map(([exampleId, candidateMap]) => {
    const ranked = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    return {
      example_id: exampleId,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      candidate_count: ranked.length,
      supported_candidate_count: ranked.filter((row) => row.supported_answer).length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return { rows, ...summarizeSelections(rows) };
}

function choosePolicy(policies) {
  return [...policies].sort((left, right) =>
    (right.selection.selection_support_rate - left.selection.selection_support_rate)
    || (right.eval.accuracy - left.eval.accuracy)
    || (right.train.accuracy - left.train.accuracy)
  )[0];
}

function deriveStatus(selected) {
  if (selected.eval.accuracy >= 0.65 && selected.selection.selection_support_rate >= 0.75) return "broad_selector_transfer_promising";
  return "broad_selector_transfer_not_sufficient";
}

function decisionFromSelected(selected, finalReplay) {
  const beatsD262 = selected.eval.correct > Number(finalReplay.metrics?.d262_pairwise?.correct ?? 0);
  return {
    promote_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    beats_d262_pairwise_on_final_heldout: beatsD262,
    reason: beatsD262 && selected.selection.selection_support_rate < 0.5
      ? "The non-final contrast selector improves pairwise ranking over D262 but collapses candidate selection, so it is useful only as a ranking signal."
      : beatsD262
        ? "The non-final contrast selector beats D262 pairwise on final heldout, but promotion still requires independent validation and a candidate-selection rule."
        : "The non-final contrast selector does not beat D262 on the broad final heldout.",
  };
}

function summarizePolicy(train, evalResult, selection) {
  return {
    train_pairwise: summarizePairEval(train),
    final_pairwise: summarizePairEval(evalResult),
    final_selection: {
      examples: selection.examples,
      selected_supported: selection.selected_supported,
      selected_unsupported: selection.selected_unsupported,
      selection_support_rate: selection.selection_support_rate,
      examples_with_supported_candidate: selection.examples_with_supported_candidate,
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

function claimFeatures(input, candidate, claim) {
  const evidenceById = new Map((input.compact_retrieved_evidence_pack ?? []).map((row) => [row.evidence_id, row]));
  const citedIds = (candidate.citations ?? []).map((id) => String(id).replace(/^\[/, "").replace(/\]$/, ""));
  const citedText = citedIds.map((id) => evidenceById.get(id)?.text ?? "").join(" ");
  const packText = (input.compact_retrieved_evidence_pack ?? []).map((row) => row.text).join(" ");
  const claimTokens = contentTokens(claim);
  const citedTokens = contentTokens(citedText);
  const packTokens = contentTokens(packText);
  const questionTokens = contentTokens(input.question);
  const citedSentences = splitSentences(citedText).map((sentence) => contentTokens(sentence));
  const unsupportedTokens = unsupportedContentTokens(claimTokens, citedTokens, questionTokens);
  const claimNumbers = numberTokens(claim).map(normalizeNumber);
  const citedNumbers = new Set(numberTokens(citedText).map(normalizeNumber));
  const questionNumbers = new Set(numberTokens(input.question).map(normalizeNumber));
  const unsupportedNumbers = claimNumbers.filter((number) => !citedNumbers.has(number) && !questionNumbers.has(number)).length;
  return {
    claim_cited_token_coverage: tokenCoverage(claimTokens, citedTokens),
    claim_pack_token_coverage: tokenCoverage(claimTokens, packTokens),
    claim_best_sentence_coverage: maxCoverage(claimTokens, citedSentences),
    unsupported_claim_token_rate: claimTokens.length ? unsupportedTokens.length / claimTokens.length : 0,
    numeric_supported_rate: claimNumbers.length ? (claimNumbers.length - unsupportedNumbers) / claimNumbers.length : 1,
    unsupported_number_count: Math.log1p(unsupportedNumbers),
    unsupported_comparative_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, comparativeTerms).length),
    unsupported_quantifier_count: Math.log1p(unsupportedTerms(claim, citedText, input.question, quantifierTerms).length),
    question_claim_overlap: tokenCoverage(questionTokens, claimTokens),
    question_cited_overlap: tokenCoverage(questionTokens, citedTokens),
    claim_token_count: Math.log1p(claimTokens.length),
    citation_count: Math.log1p(citedIds.length),
    inline_complete: inlineComplete(candidate) ? 1 : 0,
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
  if (answer && answer.length <= 180 && !claims.some((claim) => normalizedText(claim) === normalizedText(answer))) return [answer, ...claims];
  return claims;
}

function inlineComplete(candidate) {
  const answer = String(candidate.answer ?? "");
  const citations = candidate.citations ?? [];
  return citations.length > 0 && citations.every((id) => answer.includes(`[${id}]`));
}

function maxCoverage(tokens, sentenceTokens) {
  if (!tokens.length || !sentenceTokens.length) return 0;
  return Math.max(...sentenceTokens.map((sentence) => tokenCoverage(tokens, sentence)));
}

function tokenCoverage(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size) return 0;
  return [...left].filter((token) => right.has(token)).length / left.size;
}

function unsupportedContentTokens(tokens, citedTokens, questionTokens) {
  const cited = new Set(citedTokens);
  const question = new Set(questionTokens);
  return [...new Set(tokens)].filter((token) => !cited.has(token) && !question.has(token));
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

function splitSentences(value) {
  return String(value ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
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
  return `# Broad Contrast Selector Transfer

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run trains on non-final judged answer contrasts only and evaluates on the broad final heldout.

## Selected Policy

- Policy: ${result.selected_policy}
- Train: ${result.selected_policy_metrics.train_pairwise.correct}/${result.selected_policy_metrics.train_pairwise.pairs}
- Final pairwise: ${result.selected_policy_metrics.final_pairwise.correct}/${result.selected_policy_metrics.final_pairwise.pairs}
- Final selection: ${result.selected_policy_metrics.final_selection.selected_supported}/${result.selected_policy_metrics.final_selection.examples}

## Baseline

- D262 final pairwise: ${result.broad_final_baselines.d262_pairwise.correct}/${result.broad_final_baselines.d262_pairwise.pairs}
- Frozen D280 final pairwise: ${result.broad_final_baselines.d280_frozen_pairwise.correct}/${result.broad_final_baselines.d280_frozen_pairwise.pairs}

## Decision

- Promote selector now: ${result.decision.promote_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
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
