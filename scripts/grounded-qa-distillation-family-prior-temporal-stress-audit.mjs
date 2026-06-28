import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const familyPriorRunId = args["family-prior-run"] ?? "family-prior-listwise-audit-0-320-to-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "family-prior-temporal-stress-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const chronologicalWindows = [
  "nonfinal-contrast-source-inventory-0-80-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-80-160-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-160-240-2026-06-28-v1",
  "nonfinal-contrast-source-inventory-240-320-2026-06-28-v1",
];

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, transferRunId, "final_selections.jsonl"));
const familyPrior = await readJson(path.join(runsDir, familyPriorRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const windowCounts = chronologicalWindows.map((window) => ({
  window,
  pairs: trainPairs.filter((row) => row.source_inventory_run_id === window).length,
}));
const leaveOneWindowOut = chronologicalWindows.map((window) => {
  const train = trainPairs.filter((row) => row.source_inventory_run_id !== window);
  const test = trainPairs.filter((row) => row.source_inventory_run_id === window);
  return evaluatePairSplit(`loo:${window}`, train, test);
});
const prefixRows = [];
for (let index = 1; index < chronologicalWindows.length; index += 1) {
  const trainWindows = chronologicalWindows.slice(0, index);
  const testWindow = chronologicalWindows[index];
  prefixRows.push(evaluatePairSplit(
    `prefix:${trainWindows.join("+")}=>${testWindow}`,
    trainPairs.filter((row) => trainWindows.includes(row.source_inventory_run_id)),
    trainPairs.filter((row) => row.source_inventory_run_id === testWindow),
    { train_windows: trainWindows, test_window: testWindow },
  ));
}
const familyPriorTieSensitivity = evaluateFinalTieSensitivity(buildFamilyPriors(trainPairs), finalSelections);
const recencyRows = [
  evaluateFinalPolicy("all_nonfinal", trainPairs, finalSelections),
  evaluateFinalPolicy("first_two_windows_only", trainPairs.filter((row) => chronologicalWindows.slice(0, 2).includes(row.source_inventory_run_id)), finalSelections),
  evaluateFinalPolicy("last_nonempty_window_only", trainPairs.filter((row) => row.source_inventory_run_id === chronologicalWindows[3]), finalSelections),
  evaluateFinalPolicy("recency_weight_2x", trainPairs, finalSelections, recencyWeights(2)),
  evaluateFinalPolicy("recency_weight_4x", trainPairs, finalSelections, recencyWeights(4)),
  evaluateFinalPolicy("recency_weight_8x", trainPairs, finalSelections, recencyWeights(8)),
];

const prefix240 = prefixRows.find((row) => row.test_window === chronologicalWindows[3]);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "family_prior_temporal_stress_audit",
  status: "family_prior_temporal_shift_not_promoted",
  purpose: "Stress-test whether the source-family prior behind the listwise selector is temporally stable under evolving knowledge-base windows.",
  source_runs: {
    train_packet: trainPacketRunId,
    transfer_selector: transferRunId,
    family_prior_audit: familyPriorRunId,
  },
  window_counts: windowCounts,
  leave_one_window_out: summarizeSplitRows(leaveOneWindowOut),
  prefix_temporal: summarizeSplitRows(prefixRows),
  final_tie_sensitivity: familyPriorTieSensitivity,
  final_recency_policies: recencyRows,
  diagnosis: {
    late_window_shift_detected: Number(prefix240?.correct ?? 0) <= 1 && Number(prefix240?.pairs ?? 0) === 20,
    weak_window: chronologicalWindows[3],
    weak_window_prefix_pairwise: prefix240,
    committed_family_prior_selection: familyPrior.final_selection,
  },
  decision: {
    promote_family_prior_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Keep source reliability, but make it explicitly time-aware and preregister tie handling before any new labels or GPU training.",
    reason: "The final-window gain is real as an audit result, but early-window priors fail on the 240-320 window, showing that stationary source reliability is not robust enough for a paper claim about evolving knowledge bases.",
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
    note: "Zero-call temporal stress audit over existing labels and selection artifacts.",
  },
};

await writeJsonl(path.join(outputDir, "leave_one_window_out_pairwise.jsonl"), leaveOneWindowOut);
await writeJsonl(path.join(outputDir, "prefix_temporal_pairwise.jsonl"), prefixRows);
await writeJsonl(path.join(outputDir, "final_recency_policy_selections.jsonl"), recencyRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  prefix_temporal: result.prefix_temporal,
  final_tie_sensitivity: result.final_tie_sensitivity,
  final_recency_policies: result.final_recency_policies.map((row) => ({
    policy: row.policy,
    selected_supported: row.selected_supported,
    examples: row.examples,
  })),
  decision: result.decision,
}, null, 2));

function evaluatePairSplit(splitId, train, test, extra = {}) {
  const priors = buildFamilyPriors(train);
  let correct = 0;
  for (const row of test) {
    if (priorFor(row.chosen.family, priors) >= priorFor(row.rejected.family, priors)) correct += 1;
  }
  return {
    split_id: splitId,
    ...extra,
    train_pairs: train.length,
    pairs: test.length,
    correct,
    accuracy: rate(correct, test.length),
    family_priors: priors,
  };
}

function evaluateFinalPolicy(policy, train, finalRows, weights = {}) {
  const priors = buildFamilyPriors(train, weights);
  const selections = selectFinal(finalRows, priors, "raw_then_id");
  return {
    policy,
    train_pairs: train.length,
    family_priors: priors,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    selected_family_counts: countBy(selections.map((row) => row.selected_family ?? "unknown")),
  };
}

function evaluateFinalTieSensitivity(priors, finalRows) {
  const policies = ["raw_only", "id_only", "raw_then_id", "id_then_raw"];
  return Object.fromEntries(policies.map((policy) => {
    const selections = selectFinal(finalRows, priors, policy);
    return [policy, {
      examples: selections.length,
      selected_supported: selections.filter((row) => row.selected_supported_answer).length,
      selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
      selected_family_counts: countBy(selections.map((row) => row.selected_family ?? "unknown")),
    }];
  }));
}

function selectFinal(rows, priors, tiePolicy) {
  return rows.map((row) => {
    const ranked = row.ranked_candidates
      .map((candidate, index) => ({
        ...candidate,
        original_rank: index,
        family_prior_score: priorFor(candidate.family, priors),
        raw_broad_selector_score: Number(candidate.score),
      }))
      .sort((left, right) => compareCandidates(left, right, tiePolicy));
    return {
      example_id: row.example_id,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
    };
  });
}

function compareCandidates(left, right, tiePolicy) {
  let delta = right.family_prior_score - left.family_prior_score;
  if (delta) return delta;
  if (tiePolicy === "raw_only") return left.original_rank - right.original_rank;
  if (tiePolicy === "id_only") return left.candidate_id.localeCompare(right.candidate_id);
  if (tiePolicy === "raw_then_id") {
    delta = right.raw_broad_selector_score - left.raw_broad_selector_score;
    if (delta) return delta;
    return left.candidate_id.localeCompare(right.candidate_id);
  }
  if (tiePolicy === "id_then_raw") {
    delta = left.candidate_id.localeCompare(right.candidate_id);
    if (delta) return delta;
    return right.raw_broad_selector_score - left.raw_broad_selector_score;
  }
  return 0;
}

function buildFamilyPriors(pairs, weights = {}) {
  const stats = {};
  for (const pair of pairs) {
    const weight = weights[pair.source_inventory_run_id] ?? 1;
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const family = candidate.family ?? "unknown";
      stats[family] ??= { total: 0, chosen: 0, rejected: 0 };
      stats[family].total += weight;
      stats[family][role] += weight;
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([family, row]) => [
    family,
    {
      ...row,
      smoothed_supported_rate: (row.chosen + 1) / (row.total + 2),
    },
  ]));
}

function recencyWeights(factor) {
  return Object.fromEntries(chronologicalWindows.map((window, index) => [window, Math.pow(factor, index)]));
}

function priorFor(family, priors) {
  return priors[family]?.smoothed_supported_rate ?? 0.5;
}

function summarizeSplitRows(rows) {
  const nonempty = rows.filter((row) => row.pairs > 0);
  const totalPairs = nonempty.reduce((sum, row) => sum + row.pairs, 0);
  const totalCorrect = nonempty.reduce((sum, row) => sum + row.correct, 0);
  return {
    splits: rows.length,
    nonempty_splits: nonempty.length,
    total_pairs: totalPairs,
    total_correct: totalCorrect,
    micro_accuracy: rate(totalCorrect, totalPairs),
    min_nonempty_accuracy: nonempty.length ? Math.min(...nonempty.map((row) => row.accuracy)) : null,
    rows,
  };
}

function renderReport(result) {
  const weak = result.diagnosis.weak_window_prefix_pairwise;
  return `# Family-Prior Temporal Stress Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit stress-tests whether non-final source-family reliability is stable enough for an evolving-KB selector claim.

## Temporal Stress

- Leave-one-window-out micro accuracy: ${result.leave_one_window_out.total_correct}/${result.leave_one_window_out.total_pairs}
- Prefix temporal micro accuracy: ${result.prefix_temporal.total_correct}/${result.prefix_temporal.total_pairs}
- Prefix into 240-320: ${weak.correct}/${weak.pairs}
- Committed final family-prior selection: ${result.diagnosis.committed_family_prior_selection.selected_supported}/${result.diagnosis.committed_family_prior_selection.examples}
- Tie sensitivity on final selection: raw-only ${result.final_tie_sensitivity.raw_only.selected_supported}/${result.final_tie_sensitivity.raw_only.examples}, raw-then-id ${result.final_tie_sensitivity.raw_then_id.selected_supported}/${result.final_tie_sensitivity.raw_then_id.examples}

## Decision

- Promote family-prior selector now: ${result.decision.promote_family_prior_selector_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
- Reason: ${result.decision.reason}
`;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
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
