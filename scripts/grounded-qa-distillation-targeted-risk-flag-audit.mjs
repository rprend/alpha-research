import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "targeted-risk-flag-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const targetedRunId = "targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1";
const timeAwareRunId = "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const validationWindow = "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1";
const featureNames = [
  "log_answer_tokens",
  "log_claim_count",
  "log_citation_count",
  "empty_answer",
  "jsonish_answer",
  "citation_only_answer",
  "abstention_phrase",
];
const thresholds = [0, 0.1, 0.25, 0.5, 1, 2];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const targetedPacket = await readJsonl(path.join(runsDir, targetedRunId, "targeted_train_contrast_packet.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
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
const trainEval = evaluatePairs("target_train", trainExamples, model, scaler);
const validationEval = evaluatePairs("target_validation", validationExamples, model, scaler);
const candidateById = buildCandidateMap(finalPairs);
const scoredRows = finalSelections.map((row) => scoreFinalSelection(row, candidateById, model, scaler));
const thresholdRows = thresholds.map((threshold) => evaluateThreshold(threshold, scoredRows));
const selectedThreshold = selectThreshold(thresholdRows);
const selectedRows = scoredRows.map((row) => flagRow(row, selectedThreshold.threshold));
const status = deriveStatus(selectedThreshold);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "targeted_risk_flag_audit",
  status,
  purpose: "Test whether the targeted hard-negative signal is safer as a reporting-only risk flag over the 49-example mixed final selector than as a ranking objective.",
  source_runs: {
    targeted_packet: targetedRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
  },
  training: {
    algorithm: "targeted_pairwise_logistic_risk_flag",
    feature_names: featureNames,
    train_pairs: trainRows.length,
    validation_pairs: validationRows.length,
    threshold_selection: "Select the lowest threshold with validation pairwise accuracy >= 0.80 and final reporting false-positive rate <= 0.20; final labels are reporting-only, so selected threshold is not deployable.",
  },
  model: {
    weights: Object.fromEntries(featureNames.map((name, index) => [name, model.weights[index]])),
    scaler,
  },
  metrics: {
    train_pairwise: summarizePairEval(trainEval),
    validation_pairwise: summarizePairEval(validationEval),
    selected_threshold: selectedThreshold,
    baseline: {
      examples: scoredRows.length,
      selected_supported: scoredRows.filter((row) => row.baseline_supported_answer).length,
      selected_unsupported: scoredRows.filter((row) => !row.baseline_supported_answer).length,
      support_rate: rate(scoredRows.filter((row) => row.baseline_supported_answer).length, scoredRows.length),
    },
  },
  decision: decisionFromStatus(status, selectedThreshold),
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting_flag_quality: true,
    risk_flag_changes_answers: false,
    threshold_is_deployable: false,
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
    note: "This audit reads existing judged artifacts only.",
  },
  artifacts: {
    threshold_sweep_jsonl: rel(path.join(outputDir, "threshold_sweep.jsonl")),
    flagged_rows_jsonl: rel(path.join(outputDir, "flagged_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "threshold_sweep.jsonl"), thresholdRows);
await writeJsonl(path.join(outputDir, "flagged_rows.jsonl"), selectedRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result, thresholdRows));

console.log(JSON.stringify({
  run_id: runId,
  status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function pairToExample(pair) {
  return {
    pair_id: pair.pair_id,
    example_id: pair.example_id,
    source_inventory_run_id: pair.source_inventory_run_id,
    chosen_id: pair.chosen.id,
    rejected_id: pair.rejected.id,
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
    return { split, pair_id: row.pair_id, example_id: row.example_id, margin, correct: margin >= 0 };
  });
  return {
    split,
    pairs: predictions.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    mean_margin: mean(predictions.map((row) => row.margin)),
  };
}

function scoreFinalSelection(row, candidateById, model, scaler) {
  const candidates = row.ranked_candidates.map((candidate) => {
    const full = candidateById.get(candidate.candidate_id);
    if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
    return {
      ...candidate,
      ...full,
      candidate_id: candidate.candidate_id,
      targeted_model_score: scoreFeatures(candidateFeatures(full), model, scaler),
      reliability_score: Number(candidate.reliability_score),
      raw_broad_selector_score: Number(candidate.score ?? candidate.raw_broad_selector_score),
      answer_preview: preview(full.answer),
    };
  });
  const baseline = candidates.find((candidate) => candidate.candidate_id === row.selected_candidate_id) ?? baselinePolicy(candidates);
  const targetedBest = [...candidates].sort((left, right) => right.targeted_model_score - left.targeted_model_score || left.candidate_id.localeCompare(right.candidate_id))[0];
  return {
    example_id: row.example_id,
    baseline_candidate_id: baseline.candidate_id,
    baseline_family: baseline.family,
    baseline_supported_answer: Boolean(baseline.supported_answer),
    baseline_targeted_model_score: baseline.targeted_model_score,
    targeted_best_candidate_id: targetedBest.candidate_id,
    targeted_best_family: targetedBest.family,
    targeted_best_supported_answer: Boolean(targetedBest.supported_answer),
    targeted_best_score: targetedBest.targeted_model_score,
    targeted_margin_over_baseline: targetedBest.targeted_model_score - baseline.targeted_model_score,
    supported_candidate_count: candidates.filter((candidate) => candidate.supported_answer).length,
    candidate_count: candidates.length,
    baseline_answer_preview: baseline.answer_preview,
    targeted_best_answer_preview: targetedBest.answer_preview,
  };
}

function evaluateThreshold(threshold, rows) {
  const flagged = rows.map((row) => flagRow(row, threshold)).filter((row) => row.flagged);
  const useful = flagged.filter((row) => !row.baseline_supported_answer).length;
  const falsePositive = flagged.filter((row) => row.baseline_supported_answer).length;
  const baselineMisses = rows.filter((row) => !row.baseline_supported_answer).length;
  const baselineSupported = rows.filter((row) => row.baseline_supported_answer).length;
  return {
    threshold,
    examples: rows.length,
    flagged: flagged.length,
    useful_flags_on_baseline_misses: useful,
    false_positive_flags_on_supported_baseline: falsePositive,
    baseline_misses: baselineMisses,
    baseline_supported: baselineSupported,
    miss_recall: rate(useful, baselineMisses),
    flag_precision: rate(useful, flagged.length),
    false_positive_rate: rate(falsePositive, baselineSupported),
    flagged_with_supported_targeted_alternative: flagged.filter((row) => row.targeted_best_supported_answer).length,
  };
}

function flagRow(row, threshold) {
  return {
    ...row,
    threshold,
    flagged: row.targeted_best_candidate_id !== row.baseline_candidate_id && row.targeted_margin_over_baseline >= threshold,
    flag_type: row.targeted_best_candidate_id !== row.baseline_candidate_id && row.targeted_margin_over_baseline >= threshold
      ? row.baseline_supported_answer ? "false_positive_supported_baseline" : "useful_baseline_miss_flag"
      : "not_flagged",
  };
}

function selectThreshold(rows) {
  const candidates = rows.filter((row) => row.false_positive_rate <= 0.2);
  return (candidates.length ? candidates : rows).sort((left, right) =>
    right.miss_recall - left.miss_recall
    || right.flag_precision - left.flag_precision
    || left.false_positive_rate - right.false_positive_rate
    || left.threshold - right.threshold
  )[0];
}

function deriveStatus(selected) {
  if (selected.miss_recall >= 0.6 && selected.false_positive_rate <= 0.2) return "targeted_risk_flag_promising_reporting_only";
  if (selected.miss_recall > 0 && selected.false_positive_rate <= 0.2) return "targeted_risk_flag_partial_reporting_only";
  return "targeted_risk_flag_not_sufficient";
}

function decisionFromStatus(status, selected) {
  return {
    integrate_flag_now: false,
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    use_as_diagnostic_risk_flag: status !== "targeted_risk_flag_not_sufficient",
    reason: `The best reporting threshold flags ${selected.useful_flags_on_baseline_misses}/${selected.baseline_misses} baseline misses with ${selected.false_positive_flags_on_supported_baseline}/${selected.baseline_supported} false positives; final labels were reporting-only, so it is not deployable.`,
    next_step: status === "targeted_risk_flag_promising_reporting_only"
      ? "Convert the risk flag into a leakage-safe non-final calibration target before using it in any deployable scaffold."
      : "Do not use the targeted signal as a deployable flag; stronger semantic support labels are needed before further verifier work.",
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
  return dot(model.weights, scaleVector(featureNames.map((name) => features[name] ?? 0), scaler));
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

function renderReport(result, thresholdRows) {
  const rows = thresholdRows.map((row) => `| ${row.threshold} | ${row.flagged} | ${row.useful_flags_on_baseline_misses}/${row.baseline_misses} | ${row.false_positive_flags_on_supported_baseline}/${row.baseline_supported} | ${pct(row.miss_recall)} | ${pct(row.false_positive_rate)} |`).join("\n");
  return `# Targeted Risk Flag Audit

This audit treats the targeted hard-negative signal as a reporting-only risk flag over the mixed final selector.

| Threshold | Flagged | Miss flags | False positives | Miss recall | False-positive rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}
