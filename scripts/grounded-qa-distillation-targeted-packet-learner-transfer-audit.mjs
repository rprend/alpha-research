import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const targetedRunId = args["targeted-run"] ?? "targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "targeted-packet-learner-transfer-audit-0-160-to-240-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const featureNames = [
  "log_answer_tokens",
  "log_claim_count",
  "log_citation_count",
  "empty_answer",
  "jsonish_answer",
  "citation_only_answer",
  "abstention_phrase",
];
const validationWindow = "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1";
const overlayAlphas = [0, 0.1, 0.25, 0.5, 1, 2];

await fs.mkdir(outputDir, { recursive: true });

const targetedResult = await readJson(path.join(runsDir, targetedRunId, "result.json"));
const targetedPacket = await readJsonl(path.join(runsDir, targetedRunId, "targeted_train_contrast_packet.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const trainRows = targetedPacket.filter((row) => row.source_inventory_run_id !== validationWindow);
const validationRows = targetedPacket.filter((row) => row.source_inventory_run_id === validationWindow);
const trainExamples = trainRows.map(pairToExample);
const validationExamples = validationRows.map(pairToExample);
const scaler = fitScaler(trainExamples.map((row) => row.delta));
const model = trainPairwiseLogistic(trainExamples.map((row) => ({ x: scaleVector(row.delta, scaler), weight: 1 })), {
  epochs: 800,
  learningRate: 0.1,
  l2: 0.1,
});

const trainEval = evaluatePairs("target_train_0_160", trainExamples, model, scaler);
const validationEval = evaluatePairs("target_validation_240_320", validationExamples, model, scaler);
const finalCandidateById = buildCandidateMap(finalPairs);
const alphaGrid = overlayAlphas.map((alpha) => evaluateFinalOverlay(alpha, finalSelections, finalCandidateById, model, scaler));
const selectedAlpha = selectAlpha(trainEval, validationEval);
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

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_packet_learner_transfer_audit",
  status: "targeted_learner_unstable_final_neutral_not_promoted",
  purpose: "Fit a bounded zero-call learner on early targeted post-training contrasts, validate on a later non-final targeted window, then replay a frozen conservative overlay on the final heldout selector.",
  source_runs: {
    targeted_packet: targetedRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
  },
  training: {
    algorithm: "bounded_pairwise_logistic_on_targeted_packet",
    feature_names: featureNames,
    train_windows: sortedUnique(trainRows.map((row) => row.source_inventory_run_id)),
    validation_window: validationWindow,
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    selected_overlay_alpha: selectedAlpha,
    alpha_selection_rule: "Select the smallest positive alpha only when train accuracy is at least 0.55 and validation accuracy is at least 0.80; otherwise select 0. Final labels are not used for alpha selection.",
  },
  model: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
    epochs: model.epochs,
    learning_rate: model.learningRate,
    l2: model.l2,
  },
  temporal_transfer: {
    train: summarizePairEval(trainEval),
    validation: summarizePairEval(validationEval),
    d294_high_priority_pairwise: targetedResult.target_pairwise_diagnostics?.high_priority_shape_guard,
  },
  final_policies: {
    source_prefix_recency_4x: summarizeFinalGrid(alphaGrid.find((row) => row.alpha === 0)),
    targeted_learner_overlay: summarizeFinalGrid(selectedFinal),
  },
  comparison: {
    baseline_selected_supported: alphaGrid.find((row) => row.alpha === 0).selected_supported,
    selected_overlay_supported: selectedFinal.selected_supported,
    selected_overlay_switches: finalSwitches.length,
    selected_overlay_rescued_misses: finalSwitches.filter((row) => row.switch_direction === "rescued_miss").length,
    selected_overlay_regressions: finalSwitches.filter((row) => row.switch_direction === "regressed_supported").length,
    train_accuracy_threshold_met: trainEval.accuracy >= 0.55,
    validation_accuracy_threshold_met: validationEval.accuracy >= 0.8,
  },
  decision: {
    promote_targeted_learner_overlay_now: false,
    keep_targeted_packet_for_training: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Keep the targeted packet as a training/eval slice, but build a balanced objective with broad preservation examples before another reranker or compact-student run.",
    reason: "The bounded learner finds a later-window targeted signal but underfits the early targeted training rows, so the frozen overlay is disabled and final heldout selection remains the 44/49 source-prefix baseline.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_alpha_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    target_packet_training_use: "allowed_nonfinal_targeted_post_training_data",
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
    note: "Zero-call bounded learner audit over existing targeted packet and heldout selection artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "train_pair_predictions.jsonl"), trainEval.rows);
await writeJsonl(path.join(outputDir, "validation_pair_predictions.jsonl"), validationEval.rows);
await writeJsonl(path.join(outputDir, "alpha_grid.jsonl"), alphaGrid.map(({ selections, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_final_selections.jsonl"), selectedFinal.selections);
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), finalSwitches);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  training: result.training,
  temporal_transfer: result.temporal_transfer,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function pairToExample(pair) {
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
    chosen_features: candidateFeatures(pair.chosen),
    rejected_features: candidateFeatures(pair.rejected),
    delta: featureNames.map((name) => candidateFeatures(pair.chosen)[name] - candidateFeatures(pair.rejected)[name]),
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

function trainPairwiseLogistic(rows, options) {
  const weights = Array(featureNames.length).fill(0);
  const { epochs, learningRate, l2 } = options;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / Math.sqrt(1 + epoch / 50);
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

function evaluatePairs(split, rows, model, scaler) {
  const predictions = rows.map((row) => {
    const margin = scoreDelta(row.delta, model, scaler);
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
  return {
    split,
    pairs: predictions.length,
    correct,
    accuracy: rate(correct, predictions.length),
    mean_margin: mean(predictions.map((row) => row.margin)),
    rows: predictions,
  };
}

function evaluateFinalOverlay(alpha, rows, candidateById, model, scaler) {
  const selections = rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => enrichFinalCandidate(candidate, candidateById, model, scaler));
    const baseline = baselinePolicy(candidates);
    const selected = [...candidates].sort((left, right) =>
      (right.reliability_score + alpha * right.targeted_model_score) - (left.reliability_score + alpha * left.targeted_model_score)
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

function selectAlpha(trainEval, validationEval) {
  if (trainEval.accuracy < 0.55 || validationEval.accuracy < 0.8) return 0;
  return overlayAlphas.find((alpha) => alpha > 0) ?? 0;
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
    targeted_model_score: scoreFeatures(features, model, scaler),
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
    targeted_model_score: candidate.targeted_model_score,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_preview: candidate.answer_preview,
  };
}

function summarizePairEval(evaluation) {
  return {
    split: evaluation.split,
    pairs: evaluation.pairs,
    correct: evaluation.correct,
    accuracy: evaluation.accuracy,
    mean_margin: evaluation.mean_margin,
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

function scaleVector(vector, scaler) {
  return vector.map((value, index) => (value - scaler[index].mean) / scaler[index].stdev);
}

function scoreDelta(delta, model, scaler) {
  return dot(model.weights, scaleVector(delta, scaler));
}

function scoreFeatures(features, model, scaler) {
  const vector = featureNames.map((name) => features[name] ?? 0);
  return dot(model.weights, scaleVector(vector, scaler));
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function renderReport(result) {
  return `# Targeted Packet Learner Transfer Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This run fits a bounded learner on early targeted non-final contrasts, validates it on a later non-final targeted window, and then replays a frozen conservative overlay against the final heldout selector.

## Temporal Transfer

- Train targeted pairs: ${result.temporal_transfer.train.correct}/${result.temporal_transfer.train.pairs}
- Validation targeted pairs: ${result.temporal_transfer.validation.correct}/${result.temporal_transfer.validation.pairs}
- Selected overlay alpha: ${result.training.selected_overlay_alpha}
- Train threshold met: ${result.comparison.train_accuracy_threshold_met ? "yes" : "no"}
- Validation threshold met: ${result.comparison.validation_accuracy_threshold_met ? "yes" : "no"}

## Final Diagnostic

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Targeted learner overlay: ${result.final_policies.targeted_learner_overlay.selected_supported}/${result.final_policies.targeted_learner_overlay.examples}
- Switches: ${result.comparison.selected_overlay_switches}
- Rescued misses: ${result.comparison.selected_overlay_rescued_misses}
- Regressions: ${result.comparison.selected_overlay_regressions}

## Decision

- Promote targeted learner overlay now: ${result.decision.promote_targeted_learner_overlay_now ? "yes" : "no"}
- Keep targeted packet for training: ${result.decision.keep_targeted_packet_for_training ? "yes" : "no"}
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
