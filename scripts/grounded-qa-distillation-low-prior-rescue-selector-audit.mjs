import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const lowPriorPacketRunId = args["low-prior-run"] ?? "low-prior-rescue-packet-audit-0-320-to-321-389-2026-06-28-v1";
const timeAwareRunId = args["time-aware-run"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
const finalPacketRunId = args["final-packet-run"] ?? "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "low-prior-rescue-selector-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];
const qwenBoosts = [0, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const lowPriorPacket = await readJson(path.join(runsDir, lowPriorPacketRunId, "result.json"));
const lowPriorRows = await readJsonl(path.join(runsDir, lowPriorPacketRunId, "low_prior_rescue_rows.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, timeAwareRunId, "source_prefix_recency_4x_final_selections.jsonl"));
const finalPairs = await readJsonl(path.join(runsDir, finalPacketRunId, "heldout_pairwise.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const nonfinalRows = buildTemporalPairRows(trainPairs);
const boostGrid = qwenBoosts.map((boost) => evaluateBoost(boost, nonfinalRows));
const selectedBoost = selectBoost(boostGrid);
const finalCandidateById = buildCandidateMap(finalPairs);
const finalBoostGrid = qwenBoosts.map((boost) => evaluateFinalBoost(boost, finalSelections, finalCandidateById));
const selectedFinal = finalBoostGrid.find((row) => row.qwen_boost === selectedBoost);
const baselineFinal = finalBoostGrid.find((row) => row.qwen_boost === 0);
const finalSwitches = selectedFinal.selections
  .filter((row) => row.selected_candidate_id !== row.baseline_candidate_id)
  .map((row) => ({
    example_id: row.example_id,
    qwen_boost: selectedBoost,
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
  artifact_type: "low_prior_rescue_selector_audit",
  status: selectedBoost > 0 ? "qwen_boost_selected_requires_replication" : "qwen_boost_anti_transfer_not_promoted",
  purpose: "Test whether the D300 low-prior rescue packet supports a guarded Qwen-family boost, using non-final chronological transfer for selection and final labels only for reporting.",
  source_runs: {
    nonfinal_train_packet: trainPacketRunId,
    low_prior_rescue_packet: lowPriorPacketRunId,
    time_aware_source_prefix: timeAwareRunId,
    final_packet: finalPacketRunId,
  },
  low_prior_packet_summary: {
    rescue_rows: lowPriorPacket.packet_summary?.rescue_rows,
    latest_window_rescue_rows: lowPriorPacket.temporal_transfer?.low_prior_rescue_by_window?.["nonfinal-contrast-source-inventory-240-320-2026-06-28-v1"],
    qwen_rejected_rows: lowPriorPacket.packet_summary?.qwen_rejected_rows,
    final_misses_with_qwen_supported_candidate: lowPriorPacket.final_analogy?.final_misses_with_qwen_supported_candidate,
  },
  nonfinal_selection: {
    qwen_boost_grid: boostGrid.map(({ rows, ...row }) => row),
    selected_qwen_boost: selectedBoost,
    selection_rule: "Select the smallest nonzero Qwen boost only if latest non-final window accuracy is not below the no-boost baseline and latest-window low-prior rescue correctness improves; otherwise select 0. Final labels are not used.",
  },
  final_policies: {
    source_prefix_recency_4x: summarizeFinal(baselineFinal),
    selected_qwen_boost: summarizeFinal(selectedFinal),
    diagnostic_best_final_boost: summarizeFinal([...finalBoostGrid].sort((left, right) =>
      right.selected_supported - left.selected_supported
      || left.regressions - right.regressions
      || left.qwen_boost - right.qwen_boost
    )[0]),
  },
  comparison: {
    selected_boost: selectedBoost,
    baseline_final_supported: baselineFinal.selected_supported,
    selected_final_supported: selectedFinal.selected_supported,
    selected_final_switches: finalSwitches.length,
    selected_final_rescued_misses: finalSwitches.filter((row) => row.switch_direction === "rescued_miss").length,
    selected_final_regressions: finalSwitches.filter((row) => row.switch_direction === "regressed_supported").length,
    nonfinal_latest_baseline_accuracy: boostGrid.find((row) => row.qwen_boost === 0).latest_window_accuracy,
    nonfinal_latest_selected_accuracy: boostGrid.find((row) => row.qwen_boost === selectedBoost).latest_window_accuracy,
  },
  decision: {
    promote_low_prior_rescue_selector_now: false,
    keep_low_prior_packet_for_diagnostics: true,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: selectedBoost > 0
      ? "Replicate the selected boost on a broader non-final listwise packet before any final-window claim."
      : "Do not use family-level Qwen rescue. Mine deployable candidate-internal signals that distinguish supported low-prior candidates from unsupported Qwen overclaims.",
    reason: selectedBoost > 0
      ? "A nonzero family boost passed the non-final rule, but it is still too coarse for promotion."
      : "The obvious Qwen-family rescue rule anti-transfers on the latest non-final window where Qwen is usually the unsupported side, so final Qwen-supported misses require candidate-internal support features rather than a family prior override.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_boost_selection: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    low_prior_packet_training_use: "allowed_nonfinal_low_prior_rescue_training",
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
    note: "Zero-call selector audit over existing non-final pairs and final selection artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "nonfinal_boost_grid.jsonl"), boostGrid.map(({ rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_nonfinal_pair_predictions.jsonl"), boostGrid.find((row) => row.qwen_boost === selectedBoost).rows);
await writeJsonl(path.join(outputDir, "final_boost_grid.jsonl"), finalBoostGrid.map(({ selections, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_final_selections.jsonl"), selectedFinal.selections);
await writeJsonl(path.join(outputDir, "selected_final_switches.jsonl"), finalSwitches);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  low_prior_packet_summary: result.low_prior_packet_summary,
  nonfinal_selection: result.nonfinal_selection,
  final_policies: result.final_policies,
  comparison: result.comparison,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function buildTemporalPairRows(pairs) {
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
        source_inventory_run_id: pair.source_inventory_run_id,
        test_window: testWindow,
        train_windows: trainWindows,
        chosen_id: pair.chosen.id,
        rejected_id: pair.rejected.id,
        chosen_family: pair.chosen.family,
        rejected_family: pair.rejected.family,
        chosen_prior: chosenPrior,
        rejected_prior: rejectedPrior,
        baseline_source_prior_correct: chosenPrior >= rejectedPrior,
        is_low_prior_rescue_row: lowPriorRows.some((row) => row.pair_id === pair.pair_id),
      };
    }));
  }
  return rows;
}

function evaluateBoost(boost, rows) {
  const predictions = rows.map((row) => {
    const chosenScore = row.chosen_prior + (isQwen(row.chosen_family) ? boost : 0);
    const rejectedScore = row.rejected_prior + (isQwen(row.rejected_family) ? boost : 0);
    return {
      ...row,
      qwen_boost: boost,
      chosen_score: chosenScore,
      rejected_score: rejectedScore,
      predicted_chosen: chosenScore >= rejectedScore,
      correct: chosenScore >= rejectedScore,
    };
  });
  const latest = predictions.filter((row) => row.test_window === chronologicalWindows[3]);
  const latestLowPrior = latest.filter((row) => row.is_low_prior_rescue_row);
  return {
    qwen_boost: boost,
    pairs: predictions.length,
    correct: predictions.filter((row) => row.correct).length,
    accuracy: rate(predictions.filter((row) => row.correct).length, predictions.length),
    latest_window_pairs: latest.length,
    latest_window_correct: latest.filter((row) => row.correct).length,
    latest_window_accuracy: rate(latest.filter((row) => row.correct).length, latest.length),
    latest_low_prior_rows: latestLowPrior.length,
    latest_low_prior_correct: latestLowPrior.filter((row) => row.correct).length,
    latest_low_prior_accuracy: rate(latestLowPrior.filter((row) => row.correct).length, latestLowPrior.length),
    rows: predictions,
  };
}

function selectBoost(grid) {
  const baseline = grid.find((row) => row.qwen_boost === 0);
  const eligible = grid.filter((row) =>
    row.qwen_boost > 0
    && row.latest_window_accuracy >= baseline.latest_window_accuracy
    && row.latest_low_prior_correct > baseline.latest_low_prior_correct
  );
  return eligible.length ? eligible.sort((left, right) => left.qwen_boost - right.qwen_boost)[0].qwen_boost : 0;
}

function evaluateFinalBoost(boost, rows, candidateById) {
  const selections = rows.map((row) => {
    const candidates = row.ranked_candidates.map((candidate) => {
      const full = candidateById.get(candidate.candidate_id);
      if (!full) throw new Error(`Missing final candidate details for ${candidate.candidate_id}`);
      return {
        ...candidate,
        ...full,
        candidate_id: candidate.candidate_id,
        reliability_score: Number(candidate.reliability_score),
        raw_broad_selector_score: Number(candidate.raw_broad_selector_score ?? candidate.score ?? 0),
        qwen_boost_score: isQwen(candidate.family) ? boost : 0,
        boosted_score: Number(candidate.reliability_score) + (isQwen(candidate.family) ? boost : 0),
        answer_tokens: contentTokens(full.answer).length,
        claim_count: (full.claim_table ?? []).length,
        citation_count: (full.citations ?? []).length,
        answer_preview: preview(full.answer),
      };
    });
    const baseline = baselinePolicy(candidates);
    const selected = [...candidates].sort((left, right) =>
      right.boosted_score - left.boosted_score
      || right.raw_broad_selector_score - left.raw_broad_selector_score
      || left.candidate_id.localeCompare(right.candidate_id)
    )[0];
    return {
      example_id: row.example_id,
      qwen_boost: boost,
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
    qwen_boost: boost,
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

function isQwen(family) {
  return /^qwen/i.test(String(family ?? ""));
}

function buildCandidateMap(pairs) {
  const candidateById = new Map();
  for (const pair of pairs) {
    candidateById.set(pair.chosen.id, pair.chosen);
    candidateById.set(pair.rejected.id, pair.rejected);
  }
  return candidateById;
}

function candidateSummary(candidate) {
  return {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    supported_answer: candidate.supported_answer,
    reliability_score: candidate.reliability_score,
    raw_broad_selector_score: candidate.raw_broad_selector_score,
    qwen_boost_score: candidate.qwen_boost_score,
    boosted_score: candidate.boosted_score,
    answer_tokens: candidate.answer_tokens,
    claim_count: candidate.claim_count,
    citation_count: candidate.citation_count,
    answer_preview: candidate.answer_preview,
  };
}

function summarizeFinal(row) {
  return {
    qwen_boost: row.qwen_boost,
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

function rate(num, den) {
  return den ? num / den : null;
}

function renderReport(result) {
  return `# Low-Prior Rescue Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit tests the obvious family-level rescue suggested by the final misses: boost Qwen-family candidates. The boost is selected only from non-final chronological transfer.

## Non-Final Selection

- Low-prior rescue rows: ${result.low_prior_packet_summary.rescue_rows}
- Latest-window rescue rows: ${result.low_prior_packet_summary.latest_window_rescue_rows}
- Selected Qwen boost: ${result.nonfinal_selection.selected_qwen_boost}
- Latest baseline accuracy: ${pct(result.comparison.nonfinal_latest_baseline_accuracy)}
- Latest selected accuracy: ${pct(result.comparison.nonfinal_latest_selected_accuracy)}

## Final Reporting

- Baseline source-prefix selector: ${result.final_policies.source_prefix_recency_4x.selected_supported}/${result.final_policies.source_prefix_recency_4x.examples}
- Selected boost selector: ${result.final_policies.selected_qwen_boost.selected_supported}/${result.final_policies.selected_qwen_boost.examples}
- Diagnostic best final boost: ${result.final_policies.diagnostic_best_final_boost.selected_supported}/${result.final_policies.diagnostic_best_final_boost.examples}
- Switches at selected boost: ${result.comparison.selected_final_switches}
- Regressions at selected boost: ${result.comparison.selected_final_regressions}

## Decision

- Promote low-prior rescue selector now: ${result.decision.promote_low_prior_rescue_selector_now ? "yes" : "no"}
- Keep low-prior packet for diagnostics: ${result.decision.keep_low_prior_packet_for_diagnostics ? "yes" : "no"}
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
