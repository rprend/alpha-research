import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const targetedRunId = args["targeted-run"] ?? "targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1";
const preservationRunId = args["preservation-run"] ?? "preservation-pair-mining-audit-0-320-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "preservation-balanced-learner-audit-0-160-to-240-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const validationWindow = "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1";
const overlayAlphas = [0, 0.1, 0.25, 0.5, 1, 2];
const preservationWeights = [0, 0.05, 0.1, 0.25, 0.5, 1];
const featureNames = [
  "log_answer_tokens",
  "log_claim_count",
  "log_citation_count",
  "empty_answer",
  "jsonish_answer",
  "citation_only_answer",
  "abstention_phrase",
];

await fs.mkdir(outputDir, { recursive: true });

const targetedRows = await readJsonl(path.join(runsDir, targetedRunId, "targeted_train_contrast_packet.jsonl"));
const preservationRows = await readJsonl(path.join(runsDir, preservationRunId, "preservation_pairs.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const trainContrastRows = targetedRows.filter((row) => row.source_inventory_run_id !== validationWindow).map(contrastToExample);
const validationContrastRows = targetedRows.filter((row) => row.source_inventory_run_id === validationWindow).map(contrastToExample);
const trainPreservationRows = preservationRows.filter((row) => row.source_inventory_run_id !== validationWindow).map(preservationToExample);
const validationPreservationRows = preservationRows.filter((row) => row.source_inventory_run_id === validationWindow).map(preservationToExample);
const scaler = fitScaler(trainContrastRows.map((row) => row.delta).concat(trainPreservationRows.map((row) => row.delta)));

const grid = preservationWeights.map((preservationWeight) => {
  const model = trainPairwiseWithPreservation({
    contrastRows: trainContrastRows.map((row) => ({ x: scaleCentered(row.delta, scaler), weight: 1 })),
    preservationRows: trainPreservationRows.map((row) => ({ x: scaleUncentered(row.delta, scaler), weight: preservationWeight })),
    epochs: 1000,
    learningRate: 0.08,
    l2: 0.08,
  });
  const trainContrastEval = evaluateContrastPairs("train_contrast_0_160", trainContrastRows, model, scaler);
  const validationContrastEval = evaluateContrastPairs("validation_contrast_240_320", validationContrastRows, model, scaler);
  const trainPreservationEval = evaluatePreservationPairs("train_preservation_0_160", trainPreservationRows, model, scaler);
  const validationPreservationEval = evaluatePreservationPairs("validation_preservation_240_320", validationPreservationRows, model, scaler);
  return {
    preservation_weight: preservationWeight,
    model,
    train_contrast: summarizeContrastEval(trainContrastEval),
    validation_contrast: summarizeContrastEval(validationContrastEval),
    train_preservation: summarizePreservationEval(trainPreservationEval),
    validation_preservation: summarizePreservationEval(validationPreservationEval),
    train_contrast_rows: trainContrastEval.rows,
    validation_contrast_rows: validationContrastEval.rows,
    train_preservation_rows: trainPreservationEval.rows,
    validation_preservation_rows: validationPreservationEval.rows,
  };
});

const selectedGridRow = selectPreservationWeight(grid);
const selectedModel = selectedGridRow.model;
const finalCandidateById = buildCandidateMap(finalPairs);
const alphaGrid = overlayAlphas.map((alpha) => evaluateFinalOverlay(alpha, finalSelections, finalCandidateById, selectedModel, scaler));
const selectedAlpha = selectAlpha(selectedGridRow);
const selectedFinal = alphaGrid.find((row) => row.alpha === selectedAlpha);
const finalSwitches = selectedFinal.selections
  .filter((row) => row.selected_candidate_id !== row.baseline_candidate_id)
  .map((row) => ({
    example_id: row.example_id,
    alpha: selectedAlpha,
    baseline_candidate_id: row.baseline_candidate_id,
    selected_candidate_id: row.selected_candidate_id,
    baseline_supported_answer: row.baseline_supported_answer,
    selected_supported_answer: row.selected_supported_answer,
    switch_direction: row.selected_supported_answer && !row.baseline_supported_answer
      ? "rescued_miss"
      : !row.selected_supported_answer && row.baseline_supported_answer
        ? "regressed_supported"
        : "neutral_or_still_wrong",
    baseline_features: row.baseline_features,
    selected_features: row.selected_features,
  }));

const baselineFinal = alphaGrid.find((row) => row.alpha === 0);
const status = selectedAlpha > 0 && selectedFinal.selected_supported > baselineFinal.selected_supported
  ? "preservation_balanced_overlay_improved_final_requires_followup"
  : selectedAlpha > 0
    ? "preservation_balanced_overlay_selected_without_final_lift_not_promoted"
    : "preservation_balanced_overlay_disabled_not_promoted";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "preservation_balanced_learner_audit",
  status,
  purpose: "Test whether mined same-label preservation pairs stabilize a bounded pairwise learner trained on non-final targeted contrasts.",
  source_runs: {
    targeted_packet: targetedRunId,
    preservation_pairs: preservationRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
  },
  packet_composition: {
    targeted_pairs: targetedRows.length,
    preservation_pairs: preservationRows.length,
    train_contrast_pairs: trainContrastRows.length,
    validation_contrast_pairs: validationContrastRows.length,
    train_preservation_pairs: trainPreservationRows.length,
    validation_preservation_pairs: validationPreservationRows.length,
    preservation_label_counts: countBy(preservationRows.map((row) => row.preservation_label)),
    preservation_windows: countBy(preservationRows.map((row) => row.source_inventory_run_id)),
  },
  training: {
    algorithm: "pairwise_logistic_with_same_label_preservation_penalty",
    feature_names: featureNames,
    preservation_weight_grid: preservationWeights,
    selected_preservation_weight: selectedGridRow.preservation_weight,
    selected_overlay_alpha: selectedAlpha,
    train_windows: sortedUnique(trainContrastRows.concat(trainPreservationRows).map((row) => row.source_inventory_run_id)),
    validation_window: validationWindow,
    model_selection_rule: "Select the preservation weight with validation contrast accuracy at least the no-preservation baseline when possible, then minimize validation same-label absolute score margin; otherwise use the best validation contrast accuracy. Final labels are not used.",
    alpha_selection_rule: "Select the smallest positive alpha only when validation contrast accuracy is at least 0.80, validation preservation mean absolute margin is at most 0.25, and train contrast accuracy is at least 0.55; otherwise select 0. Final labels are not used.",
  },
  model: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, selectedModel.weights[index]])),
    scaler,
    epochs: selectedModel.epochs,
    learning_rate: selectedModel.learningRate,
    l2: selectedModel.l2,
  },
  temporal_transfer: {
    selected_train_contrast: selectedGridRow.train_contrast,
    selected_validation_contrast: selectedGridRow.validation_contrast,
    selected_train_preservation: selectedGridRow.train_preservation,
    selected_validation_preservation: selectedGridRow.validation_preservation,
    no_preservation_baseline: grid.find((row) => row.preservation_weight === 0)?.validation_contrast,
  },
  final_policies: {
    source_prefix_recency_4x: summarizeFinalGrid(baselineFinal),
    preservation_balanced_overlay: summarizeFinalGrid(selectedFinal),
  },
  comparison: {
    baseline_selected_supported: baselineFinal.selected_supported,
    selected_overlay_supported: selectedFinal.selected_supported,
    selected_overlay_switches: finalSwitches.length,
    selected_overlay_rescued_misses: finalSwitches.filter((row) => row.switch_direction === "rescued_miss").length,
    selected_overlay_regressions: finalSwitches.filter((row) => row.switch_direction === "regressed_supported").length,
    train_accuracy_threshold_met: selectedGridRow.train_contrast.accuracy >= 0.55,
    validation_accuracy_threshold_met: selectedGridRow.validation_contrast.accuracy >= 0.8,
    validation_preservation_margin_threshold_met: selectedGridRow.validation_preservation.mean_abs_margin <= 0.25,
  },
  decision: {
    promote_preservation_balanced_overlay_now: selectedAlpha > 0 && selectedFinal.selected_supported > baselineFinal.selected_supported && finalSwitches.every((row) => row.switch_direction !== "regressed_supported"),
    keep_preservation_pairs_for_training: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: selectedAlpha > 0 && selectedFinal.selected_supported > baselineFinal.selected_supported
      ? "Run a preregistered cross-window replication before promoting this overlay because the final window was reporting-only."
      : "Use preservation pairs as a regularization diagnostic, but inspect whether the shallow feature set is too weak before renting GPU or buying more labels.",
    reason: selectedAlpha > 0
      ? "The non-final selection rule allowed a nonzero overlay; final reporting determines whether this is a genuine lift or only a diagnostic switch."
      : "The preservation-regularized learner did not pass the non-final safety gates for overlay selection, so the time-aware source-prefix selector remains the deployable baseline.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_alpha_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    target_packet_training_use: "allowed_nonfinal_targeted_post_training_data",
    preservation_pairs_training_use: "allowed_nonfinal_same_label_preservation_data",
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
    note: "Zero-call local learner audit over existing non-final contrast and preservation packets.",
  },
};

await writeJsonl(path.join(outputDir, "weight_grid.jsonl"), grid.map(({ model, train_contrast_rows, validation_contrast_rows, train_preservation_rows, validation_preservation_rows, ...row }) => ({
  ...row,
  model: { weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])) },
})));
await writeJsonl(path.join(outputDir, "train_contrast_predictions.jsonl"), selectedGridRow.train_contrast_rows);
await writeJsonl(path.join(outputDir, "validation_contrast_predictions.jsonl"), selectedGridRow.validation_contrast_rows);
await writeJsonl(path.join(outputDir, "train_preservation_predictions.jsonl"), selectedGridRow.train_preservation_rows);
await writeJsonl(path.join(outputDir, "validation_preservation_predictions.jsonl"), selectedGridRow.validation_preservation_rows);
await writeJsonl(path.join(outputDir, "alpha_grid.jsonl"), alphaGrid.map(({ selections, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_final_selections.jsonl"), selectedFinal.selections);
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), finalSwitches);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  packet_composition: result.packet_composition,
  temporal_transfer: result.temporal_transfer,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function contrastToExample(pair) {
  const chosenFeatures = candidateFeatures(pair.chosen);
  const rejectedFeatures = candidateFeatures(pair.rejected);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    delta: featureNames.map((name) => chosenFeatures[name] - rejectedFeatures[name]),
  };
}

function preservationToExample(pair) {
  const leftFeatures = candidateFeatures(pair.left);
  const rightFeatures = candidateFeatures(pair.right);
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    preservation_label: pair.preservation_label,
    left_id: pair.left.id,
    right_id: pair.right.id,
    delta: featureNames.map((name) => leftFeatures[name] - rightFeatures[name]),
  };
}

function candidateFeatures(candidate) {
  const tokens = contentTokens(candidate.answer);
  const text = String(candidate.answer ?? "");
  return {
    log_answer_tokens: Math.log1p(tokens.length),
    log_claim_count: Math.log1p((candidate.claim_table ?? []).length),
    log_citation_count: Math.log1p((candidate.citations ?? []).length),
    empty_answer: tokens.length ? 0 : 1,
    jsonish_answer: /^\s*[{[]/.test(text) ? 1 : 0,
    citation_only_answer: tokens.length === 0 && (candidate.citations ?? []).length > 0 ? 1 : 0,
    abstention_phrase: /\b(insufficient|not reported|not enough|cannot determine)\b/i.test(text) ? 1 : 0,
  };
}

function trainPairwiseWithPreservation({ contrastRows, preservationRows, epochs, learningRate, l2 }) {
  const weights = Array(featureNames.length).fill(0);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 50);
    for (const row of contrastRows) {
      const margin = dot(weights, row.x);
      const gradientScale = -sigmoid(-margin) * row.weight;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (gradientScale * row.x[index] + l2 * weights[index]);
      }
    }
    for (const row of preservationRows) {
      if (row.weight === 0) continue;
      const margin = dot(weights, row.x);
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] -= rate * (2 * row.weight * margin * row.x[index] + l2 * weights[index]);
      }
    }
  }
  return { weights, epochs, learningRate, l2 };
}

function evaluateContrastPairs(split, rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDeltaCentered(row.delta, model, scaler);
    return {
      split,
      pair_id: row.pair_id,
      example_id: row.example_id,
      source_inventory_run_id: row.source_inventory_run_id,
      chosen_id: row.chosen_id,
      rejected_id: row.rejected_id,
      margin,
      predicted_chosen: margin >= 0,
      correct: margin >= 0,
    };
  });
  const correct = predictions.filter((row) => row.correct).length;
  return { split, pairs: predictions.length, correct, accuracy: rate(correct, predictions.length), mean_margin: mean(predictions.map((row) => row.margin)), rows: predictions };
}

function evaluatePreservationPairs(split, rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDeltaUncentered(row.delta, model, scaler);
    return {
      split,
      pair_id: row.pair_id,
      example_id: row.example_id,
      source_inventory_run_id: row.source_inventory_run_id,
      preservation_label: row.preservation_label,
      left_id: row.left_id,
      right_id: row.right_id,
      margin,
      abs_margin: Math.abs(margin),
      within_0p25: Math.abs(margin) <= 0.25,
      within_0p50: Math.abs(margin) <= 0.5,
    };
  });
  return {
    split,
    pairs: predictions.length,
    mean_abs_margin: mean(predictions.map((row) => row.abs_margin)),
    within_0p25: predictions.filter((row) => row.within_0p25).length,
    within_0p50: predictions.filter((row) => row.within_0p50).length,
    rows: predictions,
  };
}

function selectPreservationWeight(rows) {
  const baseline = rows.find((row) => row.preservation_weight === 0);
  const baselineAccuracy = baseline?.validation_contrast.accuracy ?? 0;
  const eligible = rows.filter((row) => row.validation_contrast.accuracy >= baselineAccuracy);
  const candidates = eligible.length ? eligible : rows;
  return [...candidates].sort((left, right) =>
    left.validation_preservation.mean_abs_margin - right.validation_preservation.mean_abs_margin
    || right.validation_contrast.accuracy - left.validation_contrast.accuracy
    || left.preservation_weight - right.preservation_weight
  )[0];
}

function selectAlpha(row) {
  if (row.train_contrast.accuracy < 0.55) return 0;
  if (row.validation_contrast.accuracy < 0.8) return 0;
  if (row.validation_preservation.mean_abs_margin > 0.25) return 0;
  return overlayAlphas.find((alpha) => alpha > 0) ?? 0;
}

function evaluateFinalOverlay(alpha, rows, candidateById, model, scaler) {
  const selections = rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => enrichFinalCandidate(candidate, candidateById, model, scaler));
    const baseline = baselinePolicy(candidates);
    const selected = [...candidates].sort((left, right) =>
      (right.reliability_score + alpha * right.preservation_balanced_model_score) - (left.reliability_score + alpha * left.preservation_balanced_model_score)
      || right.raw_broad_selector_score - left.raw_broad_selector_score
      || left.candidate_id.localeCompare(right.candidate_id)
    )[0];
    return {
      example_id: row.example_id,
      alpha,
      baseline_candidate_id: baseline.candidate_id,
      baseline_supported_answer: baseline.supported_answer,
      selected_candidate_id: selected.candidate_id,
      selected_supported_answer: selected.supported_answer,
      selected_family: selected.family,
      candidate_count: candidates.length,
      supported_candidate_count: candidates.filter((candidate) => candidate.supported_answer).length,
      baseline_features: finalCandidateSummary(baseline),
      selected_features: finalCandidateSummary(selected),
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    alpha,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    switches: selections.filter((row) => row.selected_candidate_id !== row.baseline_candidate_id).length,
    rescued_misses: selections.filter((row) => row.selected_supported_answer && !row.baseline_supported_answer).length,
    regressions: selections.filter((row) => !row.selected_supported_answer && row.baseline_supported_answer).length,
    selections,
  };
}

function enrichFinalCandidate(candidate, candidateById, model, scaler) {
  const full = candidateById.get(candidate.candidate_id);
  if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
  const features = candidateFeatures(full);
  return {
    ...candidate,
    ...full,
    candidate_id: candidate.candidate_id,
    reliability_score: Number(candidate.reliability_score),
    raw_broad_selector_score: Number(candidate.score),
    preservation_balanced_model_score: scoreFeatures(features, model, scaler),
    answer_tokens: contentTokens(full.answer).length,
    claim_count: (full.claim_table ?? []).length,
    citation_count: (full.citations ?? []).length,
    answer_preview: preview(full.answer),
  };
}

function baselinePolicy(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  )[0];
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function finalCandidateSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    preservation_balanced_model_score: candidate.preservation_balanced_model_score,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_preview: candidate.answer_preview,
  };
}

function summarizeContrastEval(evaluation) {
  return { split: evaluation.split, pairs: evaluation.pairs, correct: evaluation.correct, accuracy: evaluation.accuracy, mean_margin: evaluation.mean_margin };
}

function summarizePreservationEval(evaluation) {
  return {
    split: evaluation.split,
    pairs: evaluation.pairs,
    mean_abs_margin: evaluation.mean_abs_margin,
    within_0p25: evaluation.within_0p25,
    within_0p50: evaluation.within_0p50,
    within_0p25_rate: rate(evaluation.within_0p25, evaluation.pairs),
    within_0p50_rate: rate(evaluation.within_0p50, evaluation.pairs),
  };
}

function summarizeFinalGrid(row) {
  return {
    alpha: row.alpha,
    examples: row.examples,
    selected_supported: row.selected_supported,
    selected_unsupported: row.selected_unsupported,
    selection_support_rate: rate(row.selected_supported, row.examples),
    switches: row.switches,
    rescued_misses: row.rescued_misses,
    regressions: row.regressions,
  };
}

function fitScaler(vectors) {
  return featureNames.map((name, index) => {
    const values = vectors.map((vector) => vector[index]);
    const avg = mean(values);
    const variance = mean(values.map((value) => (value - avg) ** 2));
    return { feature: name, mean: avg, stdev: Math.sqrt(variance) || 1 };
  });
}

function scaleCentered(vector, scaler) {
  return vector.map((value, index) => (value - scaler[index].mean) / scaler[index].stdev);
}

function scaleUncentered(vector, scaler) {
  return vector.map((value, index) => value / scaler[index].stdev);
}

function scoreDeltaCentered(delta, model, scaler) {
  return dot(model.weights, scaleCentered(delta, scaler));
}

function scoreDeltaUncentered(delta, model, scaler) {
  return dot(model.weights, scaleUncentered(delta, scaler));
}

function scoreFeatures(features, model, scaler) {
  return dot(model.weights, scaleCentered(featureNames.map((name) => features[name] ?? 0), scaler));
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Preservation-Balanced Learner Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run combines targeted supported-over-unsupported contrasts with mined same-label preservation pairs. The goal is to test whether post-training data can teach a cheap selector to prefer grounded concise answers while preserving equivalence among already-correct or already-incorrect candidates.

## Packet Composition

- Targeted contrast pairs: ${result.packet_composition.targeted_pairs}
- Preservation pairs: ${result.packet_composition.preservation_pairs}
- Train contrast pairs: ${result.packet_composition.train_contrast_pairs}
- Validation contrast pairs: ${result.packet_composition.validation_contrast_pairs}
- Train preservation pairs: ${result.packet_composition.train_preservation_pairs}
- Validation preservation pairs: ${result.packet_composition.validation_preservation_pairs}

## Non-Final Selection

- Selected preservation weight: ${result.training.selected_preservation_weight}
- Train contrast: ${result.temporal_transfer.selected_train_contrast.correct}/${result.temporal_transfer.selected_train_contrast.pairs}
- Validation contrast: ${result.temporal_transfer.selected_validation_contrast.correct}/${result.temporal_transfer.selected_validation_contrast.pairs}
- Train preservation mean abs margin: ${result.temporal_transfer.selected_train_preservation.mean_abs_margin.toFixed(4)}
- Validation preservation mean abs margin: ${result.temporal_transfer.selected_validation_preservation.mean_abs_margin.toFixed(4)}
- Selected overlay alpha: ${result.training.selected_overlay_alpha}

## Final Reporting

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Preservation-balanced overlay: ${result.final_policies.preservation_balanced_overlay.selected_supported}/${result.final_policies.preservation_balanced_overlay.examples}
- Switches: ${result.comparison.selected_overlay_switches}
- Rescued misses: ${result.comparison.selected_overlay_rescued_misses}
- Regressions: ${result.comparison.selected_overlay_regressions}

## Decision

- Promote preservation-balanced overlay now: ${result.decision.promote_preservation_balanced_overlay_now ? "yes" : "no"}
- Keep preservation pairs for training: ${result.decision.keep_preservation_pairs_for_training ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(num, den) {
  return den ? num / den : null;
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
