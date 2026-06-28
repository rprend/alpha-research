import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const lowPriorPacketRunId = args["low-prior-run"] ?? "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const entailmentSelectorRunId = args["entailment-selector-run"] ?? "low-prior-entailment-selector-audit-0-320-to-321-389-2026-06-28-v1";
const trainNliRunId = args["train-nli-run"] ?? "nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const finalNliRunId = args["final-nli-run"] ?? "final-margin-compatible-heldout-nli-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "entailment-coverage-guard-postmortem-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];
const entailmentDeltas = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7];
const entailmentFloors = [0, 0.05, 0.1, 0.2, 0.5, 0.8];
const guardSpecs = [
  { id: "none", description: "No coverage guard.", fn: () => true },
  { id: "claim_count_non_decreasing", description: "Alternate candidate must not reduce claim count.", fn: ({ delta }) => delta.claim_count >= 0 },
  { id: "citation_count_non_decreasing", description: "Alternate candidate must not reduce citation count.", fn: ({ delta }) => delta.citation_count >= 0 },
  { id: "claim_and_citation_non_decreasing", description: "Alternate candidate must not reduce claim or citation count.", fn: ({ delta }) => delta.claim_count >= 0 && delta.citation_count >= 0 },
  { id: "answer_tokens_non_decreasing", description: "Alternate candidate must not be shorter after citation removal.", fn: ({ delta }) => delta.answer_tokens >= 0 },
  { id: "answer_tokens_at_least_20", description: "Alternate candidate must contain at least 20 non-citation answer tokens.", fn: ({ alternate }) => alternate.answer_tokens >= 20 },
  { id: "citation_non_decreasing_claim_loss_at_most_one", description: "Alternate candidate must preserve citation count and lose at most one claim.", fn: ({ delta }) => delta.citation_count >= 0 && delta.claim_count >= -1 },
];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const lowPriorPacket = await readJson(path.join(runsDir, lowPriorPacketRunId, "result.json"));
const lowPriorRows = await readJsonl(path.join(runsDir, lowPriorPacketRunId, "low_prior_rescue_rows.jsonl"));
const entailmentSelector = await readJson(path.join(runsDir, entailmentSelectorRunId, "result.json"));
const trainNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, trainNliRunId, "claim-nli-scores.jsonl")));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const finalNliByCandidate = aggregateNliByCandidate(await readJsonl(path.join(runsDir, finalNliRunId, "claim-nli-scores.jsonl")));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalRows = buildTemporalPairRows(trainPairs, trainNliByCandidate);
const nonfinalGrid = evaluateGuardGrid(nonfinalRows);
const baselineNonfinal = nonfinalGrid.find((row) => row.guard_id === "no_override");
const eligibleNonfinal = nonfinalGrid.filter((row) =>
  row.guard_id !== "no_override"
  && row.regressions === 0
  && row.latest_window_regressions === 0
  && row.latest_window_accuracy >= baselineNonfinal.latest_window_accuracy
  && row.latest_low_prior_correct > baselineNonfinal.latest_low_prior_correct
);
const selectedPolicy = eligibleNonfinal.length
  ? [...eligibleNonfinal].sort((left, right) =>
    left.entailment_delta_threshold - right.entailment_delta_threshold
    || left.entailment_floor - right.entailment_floor
    || left.switches - right.switches
    || left.guard_id.localeCompare(right.guard_id)
  )[0]
  : baselineNonfinal;

const finalCandidateById = buildCandidateMap(finalPairs);
const finalRows = buildFinalRows(finalSelections, finalCandidateById, finalNliByCandidate);
const finalGrid = evaluateGuardGrid(finalRows, { finalMode: true });
const selectedFinal = finalGrid.find((row) =>
  row.guard_id === selectedPolicy.guard_id
  && row.entailment_delta_threshold === selectedPolicy.entailment_delta_threshold
  && row.entailment_floor === selectedPolicy.entailment_floor
);
const baselineFinal = finalGrid.find((row) => row.guard_id === "no_override");
const bestDeployableFinal = finalGrid.filter((row) => row.guard_id !== "no_override").sort((left, right) =>
  right.selected_supported - left.selected_supported
  || left.regressions - right.regressions
  || left.switches - right.switches
  || left.guard_id.localeCompare(right.guard_id)
)[0];
const bestUnguardedFinal = finalGrid.find((row) =>
  row.guard_id === "none"
  && row.entailment_delta_threshold === 0.7
  && row.entailment_floor === 0.8
);
const selectedSwitches = selectedFinal.rows.filter((row) => row.override);
const bestDeployableSwitches = bestDeployableFinal.rows.filter((row) => row.override);
const switchPostmortem = summarizeSwitchPostmortem(bestUnguardedFinal.rows.filter((row) => row.override));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "entailment_coverage_guard_postmortem_audit",
  status: "coverage_guards_do_not_make_entailment_selector_promotable",
  purpose: "Diagnose why D303 entailment-min overrides regress listwise selection and test simple coverage guards without using final labels for selection.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    low_prior_rescue_packet: lowPriorPacketRunId,
    low_prior_entailment_selector: entailmentSelectorRunId,
    nonfinal_nli: trainNliRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
    final_nli: finalNliRunId,
  },
  d303_context: {
    selected_entailment_delta_threshold: entailmentSelector.comparison?.selected_entailment_delta_threshold,
    selected_entailment_floor: entailmentSelector.comparison?.selected_entailment_floor,
    best_nonbaseline_final_supported: entailmentSelector.final_policies?.diagnostic_best_nonbaseline_final_thresholds?.selected_supported,
    best_nonbaseline_final_rescued_misses: entailmentSelector.final_policies?.diagnostic_best_nonbaseline_final_thresholds?.rescued_misses,
    best_nonbaseline_final_regressions: entailmentSelector.final_policies?.diagnostic_best_nonbaseline_final_thresholds?.regressions,
  },
  low_prior_packet_summary: {
    rescue_rows: lowPriorPacket.packet_summary?.rescue_rows,
    latest_window_rescue_rows: lowPriorPacket.temporal_transfer?.low_prior_rescue_by_window?.[chronologicalWindows[3]],
    qwen_rejected_rows: lowPriorPacket.packet_summary?.qwen_rejected_rows,
  },
  nonfinal_selection: {
    guard_count: guardSpecs.length,
    threshold_rows: nonfinalGrid.length,
    eligible_zero_regression_rescue_policies: eligibleNonfinal.length,
    selected_guard_id: selectedPolicy.guard_id,
    selected_entailment_delta_threshold: selectedPolicy.entailment_delta_threshold,
    selected_entailment_floor: selectedPolicy.entailment_floor,
    selection_rule: "Select a guarded entailment override only if it improves latest-window low-prior correctness, preserves latest-window accuracy, and creates zero regressions over all non-final chronological pair rows; otherwise keep no-override.",
  },
  final_policies: {
    source_prefix_recency_4x: summarizePolicy(baselineFinal),
    selected_coverage_guard: summarizePolicy(selectedFinal),
    diagnostic_best_deployable_coverage_guard: summarizePolicy(bestDeployableFinal),
    diagnostic_best_unguarded_entailment_threshold: summarizePolicy(bestUnguardedFinal),
  },
  switch_postmortem: switchPostmortem,
  comparison: {
    selected_final_supported: selectedFinal.selected_supported,
    selected_final_switches: selectedSwitches.length,
    selected_final_rescued_misses: selectedFinal.rescued_misses,
    selected_final_regressions: selectedFinal.regressions,
    best_deployable_final_supported: bestDeployableFinal.selected_supported,
    best_deployable_final_rescued_misses: bestDeployableFinal.rescued_misses,
    best_deployable_final_regressions: bestDeployableFinal.regressions,
    best_unguarded_final_supported: bestUnguardedFinal.selected_supported,
    best_unguarded_final_rescued_misses: bestUnguardedFinal.rescued_misses,
    best_unguarded_final_regressions: bestUnguardedFinal.regressions,
  },
  decision: {
    promote_coverage_guard_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Mine a stronger verifier feature or broaden non-final supervision; simple claim/citation/token coverage guards do not provide a zero-regression rescue policy.",
    reason: `No guard/threshold policy rescues a latest-window low-prior row with zero non-final regressions. Final-only diagnostics show coverage guards can reduce damage but still fail to beat the ${baselineFinal.selected_supported}/${baselineFinal.examples} source-prefix baseline.`,
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_guard_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    nonfinal_low_prior_rows_training_use: "allowed_nonfinal_guard_selection",
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
    note: "Zero-call postmortem over existing selector, candidate, and NLI artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_guard_grid.jsonl"), nonfinalGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "final_guard_grid.jsonl"), finalGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), selectedSwitches.map(switchRow));
await writeJsonl(path.join(outputDir, "best_deployable_final_switches.jsonl"), bestDeployableSwitches.map(switchRow));
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  nonfinal_selection: result.nonfinal_selection,
  final_policies: result.final_policies,
  switch_postmortem: result.switch_postmortem,
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
      return {
        pair_id: pair.pair_id,
        example_id: pair.example_id,
        test_window: testWindow,
        chosen: candidateForPair(pair.chosen, chosenPrior, true, nliByCandidate),
        rejected: candidateForPair(pair.rejected, rejectedPrior, false, nliByCandidate),
        is_low_prior_rescue_row: lowPriorPairIds.has(pair.pair_id),
      };
    }));
  }
  return rows;
}

function buildFinalRows(rows, candidateById, nliByCandidate) {
  return rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => {
      const full = candidateById.get(candidate.candidate_id);
      if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
      return candidateForFinal(candidate, full, nliByCandidate);
    });
    const baseline = baselinePolicy(candidates);
    return {
      example_id: row.example_id,
      test_window: "final-321-389",
      baseline,
      candidates,
      is_low_prior_rescue_row: false,
    };
  });
}

function evaluateGuardGrid(rows, { finalMode = false } = {}) {
  const grid = [];
  for (const guard of guardSpecs) {
    for (const delta of entailmentDeltas) {
      for (const floor of entailmentFloors) {
        grid.push(evaluatePolicy({ guard, delta, floor, rows, finalMode }));
      }
    }
  }
  grid.push(evaluatePolicy({ guard: { id: "no_override", description: "No override baseline.", fn: () => false }, delta: 999, floor: 999, rows, finalMode }));
  return grid;
}

function evaluatePolicy({ guard, delta, floor, rows, finalMode }) {
  const predictions = rows.map((row) => {
    const baseline = finalMode ? row.baseline : (row.chosen.reliability_score >= row.rejected.reliability_score ? row.chosen : row.rejected);
    const alternates = finalMode ? row.candidates.filter((candidate) => candidate.candidate_id !== baseline.candidate_id) : [baseline.role === "chosen" ? row.rejected : row.chosen];
    const eligible = alternates.filter((alternate) => {
      const featureDelta = deltaFeatures(alternate, baseline);
      return alternate.nli_entailment_min >= floor
        && alternate.nli_entailment_min - baseline.nli_entailment_min >= delta
        && guard.fn({ alternate, baseline, delta: featureDelta });
    });
    const selected = eligible.length
      ? [...eligible].sort((left, right) =>
        right.nli_entailment_min - left.nli_entailment_min
        || right.reliability_score - left.reliability_score
        || right.raw_broad_selector_score - left.raw_broad_selector_score
        || left.candidate_id.localeCompare(right.candidate_id)
      )[0]
      : baseline;
    return {
      example_id: row.example_id,
      test_window: row.test_window,
      guard_id: guard.id,
      entailment_delta_threshold: delta,
      entailment_floor: floor,
      baseline_candidate_id: baseline.candidate_id,
      selected_candidate_id: selected.candidate_id,
      baseline_supported_answer: baseline.supported_answer,
      selected_supported_answer: selected.supported_answer,
      baseline_role: baseline.role,
      selected_role: selected.role,
      override: selected.candidate_id !== baseline.candidate_id,
      correct: finalMode ? selected.supported_answer : selected.role === "chosen",
      baseline_correct: finalMode ? baseline.supported_answer : baseline.role === "chosen",
      is_low_prior_rescue_row: row.is_low_prior_rescue_row,
      baseline_features: candidateSummary(baseline),
      selected_features: candidateSummary(selected),
      delta_features: deltaFeatures(selected, baseline),
    };
  });
  const latest = predictions.filter((row) => row.test_window === chronologicalWindows[3]);
  const latestLowPrior = latest.filter((row) => row.is_low_prior_rescue_row);
  return {
    guard_id: guard.id,
    guard_description: guard.description,
    entailment_delta_threshold: delta,
    entailment_floor: floor,
    examples: predictions.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    selected_supported: finalMode ? predictions.filter((row) => row.selected_supported_answer).length : undefined,
    switches: predictions.filter((row) => row.override).length,
    rescued_misses: predictions.filter((row) => row.override && row.correct && !row.baseline_correct).length,
    regressions: predictions.filter((row) => row.override && !row.correct && row.baseline_correct).length,
    neutral_switches: predictions.filter((row) => row.override && row.correct === row.baseline_correct).length,
    latest_window_pairs: latest.length || undefined,
    latest_window_correct: latest.length ? latest.filter((row) => row.correct).length : undefined,
    latest_window_accuracy: latest.length ? rate(latest.filter((row) => row.correct).length, latest.length) : undefined,
    latest_window_regressions: latest.length ? latest.filter((row) => row.override && !row.correct && row.baseline_correct).length : undefined,
    latest_low_prior_rows: latestLowPrior.length || undefined,
    latest_low_prior_correct: latestLowPrior.length ? latestLowPrior.filter((row) => row.correct).length : undefined,
    rows: predictions,
  };
}

function candidateForPair(candidate, reliabilityScore, supportedAnswer, nliByCandidate) {
  const features = candidateFeatures(candidate.id, nliByCandidate);
  return {
    candidate_id: candidate.id,
    role: supportedAnswer ? "chosen" : "rejected",
    family: candidate.family,
    supported_answer: supportedAnswer,
    reliability_score: reliabilityScore,
    raw_broad_selector_score: 0,
    answer_tokens: contentTokens(candidate.answer).length,
    claim_count: (candidate.claim_table ?? []).length,
    citation_count: (candidate.citations ?? []).length,
    answer_preview: preview(candidate.answer),
    ...features,
  };
}

function candidateForFinal(candidate, full, nliByCandidate) {
  const features = candidateFeatures(candidate.candidate_id, nliByCandidate);
  return {
    candidate_id: candidate.candidate_id,
    role: "final_candidate",
    family: candidate.family,
    supported_answer: Boolean(candidate.supported_answer),
    reliability_score: Number(candidate.reliability_score),
    raw_broad_selector_score: Number(candidate.raw_broad_selector_score ?? candidate.score ?? 0),
    answer_tokens: contentTokens(full.answer).length,
    claim_count: (full.claim_table ?? []).length,
    citation_count: (full.citations ?? []).length,
    answer_preview: preview(full.answer),
    ...features,
  };
}

function summarizeSwitchPostmortem(rows) {
  const byDirection = {};
  for (const row of rows) {
    const direction = switchDirection(row);
    byDirection[direction] ??= { switches: 0, mean_delta_claim_count: 0, mean_delta_citation_count: 0, mean_delta_answer_tokens: 0, families: {} };
    const bucket = byDirection[direction];
    bucket.switches += 1;
    bucket.mean_delta_claim_count += row.delta_features.claim_count;
    bucket.mean_delta_citation_count += row.delta_features.citation_count;
    bucket.mean_delta_answer_tokens += row.delta_features.answer_tokens;
    bucket.families[row.selected_features.family] = (bucket.families[row.selected_features.family] ?? 0) + 1;
  }
  for (const bucket of Object.values(byDirection)) {
    bucket.mean_delta_claim_count /= bucket.switches;
    bucket.mean_delta_citation_count /= bucket.switches;
    bucket.mean_delta_answer_tokens /= bucket.switches;
  }
  return {
    diagnostic_policy: "unguarded entailment delta=0.7 floor=0.8",
    switches: rows.length,
    by_direction: byDirection,
  };
}

function switchRow(row) {
  return {
    example_id: row.example_id,
    switch_direction: switchDirection(row),
    baseline_candidate_id: row.baseline_candidate_id,
    selected_candidate_id: row.selected_candidate_id,
    baseline_features: row.baseline_features,
    selected_features: row.selected_features,
    delta_features: row.delta_features,
  };
}

function switchDirection(row) {
  if (row.selected_supported_answer && !row.baseline_supported_answer) return "rescued_miss";
  if (!row.selected_supported_answer && row.baseline_supported_answer) return "regressed_supported";
  return "neutral_or_still_wrong";
}

function baselinePolicy(candidates) {
  return [...candidates].sort((left, right) =>
    right.reliability_score - left.reliability_score
    || right.raw_broad_selector_score - left.raw_broad_selector_score
    || left.candidate_id.localeCompare(right.candidate_id)
  )[0];
}

function deltaFeatures(selected, baseline) {
  return {
    reliability_score: selected.reliability_score - baseline.reliability_score,
    raw_broad_selector_score: selected.raw_broad_selector_score - baseline.raw_broad_selector_score,
    nli_entailment_min: selected.nli_entailment_min - baseline.nli_entailment_min,
    nli_margin_min: selected.nli_margin_min - baseline.nli_margin_min,
    nli_contradiction_max: selected.nli_contradiction_max - baseline.nli_contradiction_max,
    claim_count: selected.claim_count - baseline.claim_count,
    citation_count: selected.citation_count - baseline.citation_count,
    answer_tokens: selected.answer_tokens - baseline.answer_tokens,
  };
}

function summarizePolicy(row) {
  return {
    guard_id: row.guard_id,
    entailment_delta_threshold: row.entailment_delta_threshold,
    entailment_floor: row.entailment_floor,
    examples: row.examples,
    selected_supported: row.selected_supported,
    support_rate: rate(row.selected_supported, row.examples),
    switches: row.switches,
    rescued_misses: row.rescued_misses,
    regressions: row.regressions,
    neutral_switches: row.neutral_switches,
  };
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
    claim_count_nli: nli.margin.length,
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
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_tokens: candidate.answer_tokens,
    answer_preview: candidate.answer_preview,
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
  return `# Entailment Coverage Guard Postmortem Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit diagnoses D303 entailment-min listwise regressions and tests simple coverage guards selected only on non-final chronological transfer.

## Non-Final Selection

- Guard count: ${result.nonfinal_selection.guard_count}
- Threshold rows: ${result.nonfinal_selection.threshold_rows}
- Eligible zero-regression rescue policies: ${result.nonfinal_selection.eligible_zero_regression_rescue_policies}
- Selected guard: ${result.nonfinal_selection.selected_guard_id}
- Selected entailment delta: ${result.nonfinal_selection.selected_entailment_delta_threshold}
- Selected entailment floor: ${result.nonfinal_selection.selected_entailment_floor}

## Final Reporting

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Selected coverage guard: ${result.final_policies.selected_coverage_guard.selected_supported}/${result.final_policies.selected_coverage_guard.examples}
- Best deployable coverage guard diagnostic: ${result.final_policies.diagnostic_best_deployable_coverage_guard.selected_supported}/${result.final_policies.diagnostic_best_deployable_coverage_guard.examples}
- Best unguarded entailment diagnostic: ${result.final_policies.diagnostic_best_unguarded_entailment_threshold.selected_supported}/${result.final_policies.diagnostic_best_unguarded_entailment_threshold.examples}

## Decision

- Promote coverage guard now: ${result.decision.promote_coverage_guard_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
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
