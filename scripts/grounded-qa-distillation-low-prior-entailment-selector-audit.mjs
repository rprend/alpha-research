import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const lowPriorPacketRunId = args["low-prior-run"] ?? "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const signalRunId = args["signal-run"] ?? "low-prior-candidate-signal-audit-0-320-to-321-389-2026-06-28-v1";
const trainNliRunId = args["train-nli-run"] ?? "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const finalNliRunId = args["final-nli-run"] ?? "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "low-prior-entailment-selector-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];
const entailmentDeltas = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7];
const entailmentFloors = [0, 0.05, 0.1, 0.2, 0.5, 0.8];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const lowPriorPacket = await readJson(path.join(runsDir, lowPriorPacketRunId, "result.json"));
const lowPriorRows = await readJsonl(path.join(runsDir, lowPriorPacketRunId, "low_prior_rescue_rows.jsonl"));
const signalResult = await readJson(path.join(runsDir, signalRunId, "result.json"));
const trainNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl")));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const finalNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl")));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalRows = buildTemporalPairRows(trainPairs, trainNliByCandidate);
const thresholdGrid = [];
for (const delta of entailmentDeltas) {
  for (const floor of entailmentFloors) {
    thresholdGrid.push(evaluateThresholds({ delta, floor }, nonfinalRows));
  }
}
const selectedThresholds = selectThresholds(thresholdGrid);
const selectedNonfinal = thresholdGrid.find((row) =>
  row.entailment_delta_threshold === selectedThresholds.delta
  && row.entailment_floor === selectedThresholds.floor
);

const finalCandidateById = buildCandidateMap(finalPairs);
const finalThresholdGrid = [];
for (const delta of entailmentDeltas) {
  for (const floor of entailmentFloors) {
    finalThresholdGrid.push(evaluateFinalThresholds({ delta, floor }, finalSelections, finalCandidateById, finalNliByCandidate));
  }
}
finalThresholdGrid.push(evaluateFinalThresholds({ delta: 999, floor: 999 }, finalSelections, finalCandidateById, finalNliByCandidate));
const selectedFinal = finalThresholdGrid.find((row) =>
  row.entailment_delta_threshold === selectedThresholds.delta
  && row.entailment_floor === selectedThresholds.floor
);
const baselineFinal = finalThresholdGrid.find((row) =>
  row.entailment_delta_threshold === 999
  && row.entailment_floor === 999
);
const diagnosticBestFinal = [...finalThresholdGrid].sort((left, right) =>
  right.selected_supported - left.selected_supported
  || left.regressions - right.regressions
  || left.switches - right.switches
  || right.entailment_delta_threshold - left.entailment_delta_threshold
  || right.entailment_floor - left.entailment_floor
)[0];
const diagnosticBestFinalOverride = finalThresholdGrid
  .filter((row) => row.entailment_delta_threshold < 999)
  .sort((left, right) =>
    right.selected_supported - left.selected_supported
    || left.regressions - right.regressions
    || left.switches - right.switches
    || right.entailment_delta_threshold - left.entailment_delta_threshold
    || right.entailment_floor - left.entailment_floor
  )[0];
const finalSwitches = selectedFinal.selections
  .filter((row) => row.selected_candidate_id !== row.baseline_candidate_id)
  .map((row) => ({
    example_id: row.example_id,
    entailment_delta_threshold: selectedThresholds.delta,
    entailment_floor: selectedThresholds.floor,
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

const promoted = selectedThresholds.delta < 999
  && selectedFinal.selected_supported > baselineFinal.selected_supported
  && selectedFinal.regressions === 0;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "low_prior_entailment_selector_audit",
  status: promoted ? "entailment_selector_candidate_ready_for_replication" : "entailment_selector_not_promoted",
  purpose: "Test whether the D302 candidate-internal nli_entailment_min signal can safely override source-prior rankings without using final labels for selection.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    low_prior_rescue_packet: lowPriorPacketRunId,
    low_prior_candidate_signal: signalRunId,
    nonfinal_nli: trainNliRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
    final_nli: finalNliRunId,
  },
  selected_signal: {
    feature: signalResult.selected_signal?.feature,
    direction: signalResult.selected_signal?.direction,
    nonfinal_correct: signalResult.selected_signal?.nonfinal_correct,
    nonfinal_pairs: signalResult.selected_signal?.nonfinal_pairs,
    final_rows_used_for_selection: false,
  },
  low_prior_packet_summary: {
    rescue_rows: lowPriorPacket.packet_summary?.rescue_rows,
    latest_window_rescue_rows: lowPriorPacket.temporal_transfer?.low_prior_rescue_by_window?.[chronologicalWindows[3]],
    qwen_rejected_rows: lowPriorPacket.packet_summary?.qwen_rejected_rows,
  },
  nonfinal_selection: {
    threshold_grid: thresholdGrid.map(({ rows, ...row }) => row),
    selected_entailment_delta_threshold: selectedThresholds.delta,
    selected_entailment_floor: selectedThresholds.floor,
    selection_rule: "Select the smallest entailment override that improves latest-window low-prior correctness while preserving latest-window total accuracy against the no-override baseline; otherwise disable overrides. Final labels are not used.",
  },
  final_policies: {
    source_prefix_recency_4x: summarizeFinal(baselineFinal),
    selected_entailment_override: summarizeFinal(selectedFinal),
    diagnostic_best_final_thresholds: summarizeFinal(diagnosticBestFinal),
    diagnostic_best_nonbaseline_final_thresholds: summarizeFinal(diagnosticBestFinalOverride),
  },
  comparison: {
    selected_entailment_delta_threshold: selectedThresholds.delta,
    selected_entailment_floor: selectedThresholds.floor,
    baseline_final_supported: baselineFinal.selected_supported,
    selected_final_supported: selectedFinal.selected_supported,
    selected_final_switches: finalSwitches.length,
    selected_final_rescued_misses: finalSwitches.filter((row) => row.switch_direction === "rescued_miss").length,
    selected_final_regressions: finalSwitches.filter((row) => row.switch_direction === "regressed_supported").length,
    nonfinal_latest_baseline_accuracy: thresholdGrid.find((row) => row.entailment_delta_threshold === 999)?.latest_window_accuracy,
    nonfinal_latest_selected_accuracy: selectedNonfinal.latest_window_accuracy,
    nonfinal_latest_baseline_low_prior_correct: thresholdGrid.find((row) => row.entailment_delta_threshold === 999)?.latest_low_prior_correct,
    nonfinal_latest_selected_low_prior_correct: selectedNonfinal.latest_low_prior_correct,
  },
  decision: {
    promote_entailment_selector_now: promoted,
    require_replication_before_paper_claim: promoted,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: promoted
      ? "Replicate the guarded entailment selector on a broader non-final listwise benchmark and then compare cost/correctness against the source-prefix baseline."
      : "Do not promote the current entailment override; inspect failure rows and either strengthen candidate verification or expand non-final supervision before GPU spend.",
    reason: promoted
      ? `The non-final-selected thresholds improve final support from ${baselineFinal.selected_supported}/${baselineFinal.examples} to ${selectedFinal.selected_supported}/${selectedFinal.examples} with ${selectedFinal.regressions} regressions, but this is still a single selector audit.`
      : `The non-final-selected thresholds do not produce a regression-free final improvement over ${baselineFinal.selected_supported}/${baselineFinal.examples}; the D302 pairwise signal is useful but not yet a deployable listwise selector.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_threshold_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    nonfinal_low_prior_rows_training_use: "allowed_nonfinal_low_prior_rescue_training",
    final_policy_training_use: "forbidden_final_window_reporting_only",
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
    note: "Zero-call selector audit over existing source-prior selections and local NLI scores.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_threshold_grid.jsonl"), thresholdGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_nonfinal_pair_predictions.jsonl"), selectedNonfinal.rows);
await writeJsonl(path.join(outputDir, "final_threshold_grid.jsonl"), finalThresholdGrid.map(({ selections, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_final_selections.jsonl"), selectedFinal.selections);
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), finalSwitches);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_signal: result.selected_signal,
  low_prior_packet_summary: result.low_prior_packet_summary,
  nonfinal_selection: {
    selected_entailment_delta_threshold: result.nonfinal_selection.selected_entailment_delta_threshold,
    selected_entailment_floor: result.nonfinal_selection.selected_entailment_floor,
  },
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildTemporalPairRows(pairs, nliByCandidate) {
  const lowPriorPairIds = new Set(lowPriorRows.map((row) => row.pair_id));
  const rows = [];
  for (let index = 1; index < chronologicalWindows.length; index += 1) {
    const trainWindows = chronologicalWindows.slice(0, index);
    const testWindow = chronologicalWindows[index];
    const train = pairs.filter((row) => trainWindows.includes(row.source_inventory_run_id));
    const test = pairs.filter((row) => row.source_inventory_run_id === testWindow);
    const prefixPriors = buildPriors(train, sourcePrefixKey);
    const familyPriors = buildPriors(train, (candidate) => candidate.family ?? "unknown");
    rows.push(...test.map((pair) => {
      const chosenPrior = combinedPrior(pair.chosen, prefixPriors, familyPriors);
      const rejectedPrior = combinedPrior(pair.rejected, prefixPriors, familyPriors);
      const chosenFeatures = candidateFeatures(pair.chosen.id, nliByCandidate);
      const rejectedFeatures = candidateFeatures(pair.rejected.id, nliByCandidate);
      return {
        pair_id: pair.pair_id,
        example_id: pair.example_id,
        source_inventory_run_id: pair.source_inventory_run_id,
        test_window: testWindow,
        train_windows: trainWindows,
        chosen_id: pair.chosen.id,
        rejected_id: pair.rejected.id,
        chosen_family: pair.chosen.family,
        rejected_family: pair.rejected.family,
        chosen_prior: chosenPrior,
        rejected_prior: rejectedPrior,
        chosen_entailment_min: chosenFeatures.nli_entailment_min,
        rejected_entailment_min: rejectedFeatures.nli_entailment_min,
        baseline_source_prior_correct: chosenPrior >= rejectedPrior,
        is_low_prior_rescue_row: lowPriorPairIds.has(pair.pair_id),
      };
    }));
  }
  return rows;
}

function evaluateThresholds({ delta, floor }, rows) {
  const predictions = rows.map((row) => {
    const baselineCandidate = row.chosen_prior >= row.rejected_prior ? "chosen" : "rejected";
    const alternateCandidate = baselineCandidate === "chosen" ? "rejected" : "chosen";
    const baselineEntailment = baselineCandidate === "chosen" ? row.chosen_entailment_min : row.rejected_entailment_min;
    const alternateEntailment = alternateCandidate === "chosen" ? row.chosen_entailment_min : row.rejected_entailment_min;
    const override = alternateEntailment >= floor && alternateEntailment - baselineEntailment >= delta;
    const selectedCandidate = override ? alternateCandidate : baselineCandidate;
    return {
      ...row,
      entailment_delta_threshold: delta,
      entailment_floor: floor,
      baseline_candidate: baselineCandidate,
      selected_candidate: selectedCandidate,
      override,
      correct: selectedCandidate === "chosen",
    };
  });
  const latest = predictions.filter((row) => row.test_window === chronologicalWindows[3]);
  const latestLowPrior = latest.filter((row) => row.is_low_prior_rescue_row);
  return {
    entailment_delta_threshold: delta,
    entailment_floor: floor,
    pairs: predictions.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    switches: predictions.filter((row) => row.override).length,
    rescued_errors: predictions.filter((row) => row.override && row.correct && !row.baseline_source_prior_correct).length,
    regressions: predictions.filter((row) => row.override && !row.correct && row.baseline_source_prior_correct).length,
    latest_window_pairs: latest.length,
    latest_window_correct: latest.filter((row) => row.correct).length,
    latest_window_accuracy: rate(latest.filter((row) => row.correct).length, latest.length),
    latest_window_switches: latest.filter((row) => row.override).length,
    latest_window_regressions: latest.filter((row) => row.override && !row.correct && row.baseline_source_prior_correct).length,
    latest_low_prior_rows: latestLowPrior.length,
    latest_low_prior_correct: latestLowPrior.filter((row) => row.correct).length,
    latest_low_prior_accuracy: rate(latestLowPrior.filter((row) => row.correct).length, latestLowPrior.length),
    rows: predictions,
  };
}

function selectThresholds(grid) {
  const baseline = evaluateThresholds({ delta: 999, floor: 999 }, nonfinalRows);
  thresholdGrid.push(baseline);
  const eligible = grid.filter((row) =>
    row.entailment_delta_threshold < 999
    && row.latest_window_accuracy >= baseline.latest_window_accuracy
    && row.latest_low_prior_correct > baseline.latest_low_prior_correct
    && row.regressions === 0
    && row.latest_window_regressions === 0
  );
  if (!eligible.length) return { delta: 999, floor: 999 };
  const selected = [...eligible].sort((left, right) =>
    left.entailment_delta_threshold - right.entailment_delta_threshold
    || left.entailment_floor - right.entailment_floor
    || left.switches - right.switches
  )[0];
  return { delta: selected.entailment_delta_threshold, floor: selected.entailment_floor };
}

function evaluateFinalThresholds({ delta, floor }, rows, candidateById, nliByCandidate) {
  const selections = rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => {
      const full = candidateById.get(candidate.candidate_id);
      if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
      const features = candidateFeatures(candidate.candidate_id, nliByCandidate);
      return {
        ...candidate,
        ...full,
        candidate_id: candidate.candidate_id,
        reliability_score: Number(candidate.reliability_score),
        raw_broad_selector_score: Number(candidate.raw_broad_selector_score ?? candidate.score ?? 0),
        nli_entailment_min: features.nli_entailment_min,
        nli_margin_min: features.nli_margin_min,
        nli_contradiction_max: features.nli_contradiction_max,
        answer_tokens: contentTokens(full.answer).length,
        claim_count: (full.claim_table ?? []).length,
        citation_count: (full.citations ?? []).length,
        answer_preview: preview(full.answer),
      };
    });
    const baseline = baselinePolicy(candidates);
    const eligibleAlternates = candidates.filter((candidate) =>
      candidate.candidate_id !== baseline.candidate_id
      && candidate.nli_entailment_min >= floor
      && candidate.nli_entailment_min - baseline.nli_entailment_min >= delta
    );
    const selected = eligibleAlternates.length
      ? [...eligibleAlternates].sort((left, right) =>
        right.nli_entailment_min - left.nli_entailment_min
        || right.reliability_score - left.reliability_score
        || right.raw_broad_selector_score - left.raw_broad_selector_score
        || left.candidate_id.localeCompare(right.candidate_id)
      )[0]
      : baseline;
    return {
      example_id: row.example_id,
      entailment_delta_threshold: delta,
      entailment_floor: floor,
      baseline_candidate_id: baseline.candidate_id,
      baseline_supported_answer: baseline.supported_answer,
      selected_candidate_id: selected.candidate_id,
      selected_supported_answer: selected.supported_answer,
      selected_family: selected.family,
      candidate_count: candidates.length,
      supported_candidate_count: candidates.filter((candidate) => candidate.supported_answer).length,
      baseline_features: candidateSummary(baseline),
      selected_features: candidateSummary(selected),
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    entailment_delta_threshold: delta,
    entailment_floor: floor,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    switches: selections.filter((row) => row.selected_candidate_id !== row.baseline_candidate_id).length,
    rescued_misses: selections.filter((row) => row.selected_supported_answer && !row.baseline_supported_answer).length,
    regressions: selections.filter((row) => !row.selected_supported_answer && row.baseline_supported_answer).length,
    selections,
  };
}

function baselinePolicy(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  )[0];
}

function buildPriors(pairs, keyFn) {
  const stats = {};
  for (const pair of pairs) {
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = keyFn(candidate);
      stats[key] ??= { total: 0, chosen: 0, rejected: 0 };
      stats[key].total += 1;
      stats[key][role] += 1;
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([key, row]) => [
    key,
    { ...row, smoothed_supported_rate: (row.chosen + 1) / (row.total + 2) },
  ]));
}

function combinedPrior(candidate, prefixPriors, familyPriors) {
  const prefixPrior = priorFor(sourcePrefixKey(candidate), prefixPriors);
  return prefixPrior === 0.5 ? priorFor(candidate.family ?? "unknown", familyPriors) : prefixPrior;
}

function predictionRunKey(candidate) {
  return candidate.prediction_run_id || (candidate.candidate_id || candidate.id || "").split("::")[1] || "unknown";
}

function sourcePrefixKey(candidate) {
  const runId = predictionRunKey(candidate)
    .replace(/-extended-future-holdout-.*/, "-extended-future-holdout")
    .replace(/-smoke-eval.*/, "-smoke-eval")
    .replace(/-321-389.*/, "-future-window")
    .replace(/-240-320.*/, "-future-window")
    .replace(/-160-240.*/, "-future-window")
    .replace(/-80-160.*/, "-future-window")
    .replace(/-0-80.*/, "-future-window");
  return `${candidate.family ?? "unknown"}:${runId}`;
}

function priorFor(key, priors) {
  return priors[key]?.smoothed_supported_rate ?? 0.5;
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function candidateFeatures(candidateId, nliByCandidate) {
  const nli = nliByCandidate.get(candidateId) ?? { entailment: [], contradiction: [], margin: [] };
  return {
    nli_margin_min: nli.margin.length ? Math.min(...nli.margin) : 0,
    nli_margin_mean: mean(nli.margin),
    nli_entailment_min: nli.entailment.length ? Math.min(...nli.entailment) : 0,
    nli_contradiction_max: nli.contradiction.length ? Math.max(...nli.contradiction) : 0,
    claim_count: nli.margin.length,
  };
}

function aggregateNliByCandidate(rows) {
  const byCandidate = new Map();
  for (const row of rows) {
    const aggregate = byCandidate.get(row.candidate_id) ?? { entailment: [], contradiction: [], margin: [] };
    aggregate.entailment.push(Number(row.nli?.entailment ?? 0));
    aggregate.contradiction.push(Number(row.nli?.contradiction ?? 0));
    aggregate.margin.push(Number(row.nli?.margin ?? 0));
    byCandidate.set(row.candidate_id, aggregate);
  }
  return byCandidate;
}

function candidateSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    nli_entailment_min: candidate.nli_entailment_min,
    nli_margin_min: candidate.nli_margin_min,
    nli_contradiction_max: candidate.nli_contradiction_max,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_preview: candidate.answer_preview,
  };
}

function summarizeFinal(row) {
  return {
    entailment_delta_threshold: row.entailment_delta_threshold,
    entailment_floor: row.entailment_floor,
    examples: row.examples,
    selected_supported: row.selected_supported,
    selected_unsupported: row.selected_unsupported,
    selection_support_rate: rate(row.selected_supported, row.examples),
    switches: row.switches,
    rescued_misses: row.rescued_misses,
    regressions: row.regressions,
  };
}

function contentTokens(text) {
  return String(text ?? "").replace(/\[[^\]]+\]/g, "").split(/\W+/).filter((token) => token.length > 1);
}

function preview(text, limit = 180) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rate(num, den) {
  return den ? num / den : null;
}

function renderReport(result) {
  return `# Low-Prior Entailment Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit tests whether the D302 \`nli_entailment_min\` signal can safely override source-prior rankings. Thresholds are selected only on non-final chronological transfer.

## Non-Final Selection

- Low-prior rescue rows: ${result.low_prior_packet_summary.rescue_rows}
- Latest-window rescue rows: ${result.low_prior_packet_summary.latest_window_rescue_rows}
- Selected entailment delta: ${result.nonfinal_selection.selected_entailment_delta_threshold}
- Selected entailment floor: ${result.nonfinal_selection.selected_entailment_floor}
- Latest baseline accuracy: ${pct(result.comparison.nonfinal_latest_baseline_accuracy)}
- Latest selected accuracy: ${pct(result.comparison.nonfinal_latest_selected_accuracy)}
- Latest baseline low-prior correct: ${result.comparison.nonfinal_latest_baseline_low_prior_correct}
- Latest selected low-prior correct: ${result.comparison.nonfinal_latest_selected_low_prior_correct}

## Final Reporting

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Selected entailment override: ${result.final_policies.selected_entailment_override.selected_supported}/${result.final_policies.selected_entailment_override.examples}
- Diagnostic best final thresholds: ${result.final_policies.diagnostic_best_final_thresholds.selected_supported}/${result.final_policies.diagnostic_best_final_thresholds.examples}
- Diagnostic best non-baseline final thresholds: ${result.final_policies.diagnostic_best_nonbaseline_final_thresholds.selected_supported}/${result.final_policies.diagnostic_best_nonbaseline_final_thresholds.examples}
- Switches at selected thresholds: ${result.comparison.selected_final_switches}
- Rescues at selected thresholds: ${result.comparison.selected_final_rescued_misses}
- Regressions at selected thresholds: ${result.comparison.selected_final_regressions}

## Decision

- Promote entailment selector now: ${result.decision.promote_entailment_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
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
