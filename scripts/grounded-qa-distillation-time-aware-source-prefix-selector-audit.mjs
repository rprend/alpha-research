import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const sourcePrefixRunId = args["source-prefix-run"] ?? "source-prefix-reliability-audit-0-320-to-321-389-2026-06-28-v1";
const temporalStressRunId = args["temporal-stress-run"] ?? "family-prior-temporal-stress-audit-0-320-to-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1";
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
const sourcePrefixAudit = await readJson(path.join(runsDir, sourcePrefixRunId, "result.json"));
const temporalStress = await readJson(path.join(runsDir, temporalStressRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const finalPolicies = [
  evaluateFinalPolicy("source_prefix_all_windows", trainPairs),
  evaluateFinalPolicy("source_prefix_last_nonempty_window", trainPairs.filter((row) => row.source_inventory_run_id === chronologicalWindows[3])),
  evaluateFinalPolicy("source_prefix_recency_2x", trainPairs, recencyWeights(2)),
  evaluateFinalPolicy("source_prefix_recency_4x", trainPairs, recencyWeights(4)),
  evaluateFinalPolicy("source_prefix_recency_8x", trainPairs, recencyWeights(8)),
];
const prefixRows = [];
for (let index = 1; index < chronologicalWindows.length; index += 1) {
  const trainWindows = chronologicalWindows.slice(0, index);
  const testWindow = chronologicalWindows[index];
  const train = trainPairs.filter((row) => trainWindows.includes(row.source_inventory_run_id));
  const test = trainPairs.filter((row) => row.source_inventory_run_id === testWindow);
  prefixRows.push(evaluatePairSplit(`prefix_source_prefix:${trainWindows.join("+")}=>${testWindow}`, train, test, {
    train_windows: trainWindows,
    test_window: testWindow,
  }));
}
const selectedPolicy = finalPolicies.find((row) => row.policy === "source_prefix_recency_4x");
const weak240 = prefixRows.find((row) => row.test_window === chronologicalWindows[3]);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "time_aware_source_prefix_selector_audit",
  status: "time_aware_source_prefix_partial_not_promoted",
  purpose: "Preregister a zero-call time-aware source-prefix listwise selector and compare final selection with temporal stress behavior.",
  source_runs: {
    train_packet: trainPacketRunId,
    transfer_selector: transferRunId,
    source_prefix_audit: sourcePrefixRunId,
    family_temporal_stress_audit: temporalStressRunId,
  },
  preregistered_selector: {
    selected_policy: selectedPolicy.policy,
    source_key: "normalized source prefix with broad family fallback",
    recency_weight_factor: 4,
    tie_break: ["reliability_score desc", "raw_broad_selector_score desc", "candidate_id asc"],
    final_labels_used_for_training_or_tuning: false,
  },
  final_policies: Object.fromEntries(finalPolicies.map((row) => [row.policy, summarizeSelection(row)])),
  prefix_temporal_stress: summarizeSplitRows(prefixRows),
  comparison: {
    committed_family_prior_selected_supported: temporalStress.diagnosis?.committed_family_prior_selection?.selected_supported,
    source_prefix_audit_selected_supported: sourcePrefixAudit.selected_policy?.selected_supported,
    selected_time_aware_source_prefix_supported: selectedPolicy.selected_supported,
    family_prior_prefix_240_320_correct: temporalStress.diagnosis?.weak_window_prefix_pairwise?.correct,
    source_prefix_prefix_240_320_correct: weak240?.correct,
    source_prefix_prefix_240_320_pairs: weak240?.pairs,
  },
  decision: {
    promote_time_aware_source_prefix_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Use time-aware normalized source-prefix reliability as one feature, but add evidence/claim features before any promoted selector or paid labeling run.",
    reason: "The time-aware source-prefix selector preserves 44/49 final support and improves the hard temporal prefix split from 1/20 to 7/20, but that stress result is still too weak for a robust evolving-KB claim.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    deployable_selector_claim_allowed: false,
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
    note: "Zero-call time-aware source-prefix audit over existing labels and selection artifacts.",
  },
};

for (const policy of finalPolicies) {
  await writeJsonl(path.join(outputDir, `${policy.policy}_final_selections.jsonl`), policy.selections);
}
await writeJsonl(path.join(outputDir, "prefix_temporal_pairwise.jsonl"), prefixRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  selected_policy: result.preregistered_selector,
  final_policies: result.final_policies,
  prefix_temporal_stress: result.prefix_temporal_stress,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function evaluateFinalPolicy(policy, train, weights = {}) {
  const priors = buildPriors(train, sourcePrefixKey, weights);
  const familyPriors = buildPriors(train, (candidate) => candidate.family ?? "unknown", weights);
  const selections = finalSelections.map((row) => {
    const ranked = row.ranked_candidates
      .map((candidate) => {
        const key = sourcePrefixKey(candidate);
        const directPrior = priorFor(key, priors);
        const fallbackPrior = priorFor(candidate.family ?? "unknown", familyPriors);
        return {
          ...candidate,
          source_reliability_key: key,
          direct_prior: directPrior,
          fallback_prior: fallbackPrior,
          reliability_score: directPrior === 0.5 ? fallbackPrior : directPrior,
          raw_broad_selector_score: Number(candidate.score),
        };
      })
      .sort((left, right) =>
        right.reliability_score - left.reliability_score
        || right.raw_broad_selector_score - left.raw_broad_selector_score
        || left.candidate_id.localeCompare(right.candidate_id)
      );
    return {
      example_id: row.example_id,
      policy,
      selected_candidate_id: ranked[0]?.candidate_id ?? null,
      selected_family: ranked[0]?.family ?? null,
      selected_key: ranked[0]?.source_reliability_key ?? null,
      selected_supported_answer: ranked[0]?.supported_answer ?? false,
      direct_prior_known: ranked[0]?.direct_prior !== 0.5,
      selected_reliability_score: ranked[0]?.reliability_score ?? null,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    policy,
    train_pairs: train.length,
    priors,
    family_fallback_priors: familyPriors,
    selections,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    unknown_top_count: selections.filter((row) => !row.direct_prior_known).length,
    selected_family_counts: countBy(selections.map((row) => row.selected_family ?? "unknown")),
  };
}

function evaluatePairSplit(splitId, train, test, extra) {
  const priors = buildPriors(train, sourcePrefixKey);
  let correct = 0;
  for (const row of test) {
    if (priorFor(sourcePrefixKey(row.chosen), priors) >= priorFor(sourcePrefixKey(row.rejected), priors)) correct += 1;
  }
  return {
    split_id: splitId,
    ...extra,
    train_pairs: train.length,
    pairs: test.length,
    correct,
    accuracy: rate(correct, test.length),
    prior_key_count: Object.keys(priors).length,
    family_priors: priors,
  };
}

function buildPriors(pairs, keyFn, weights = {}) {
  const stats = {};
  for (const pair of pairs) {
    const weight = weights[pair.source_inventory_run_id] ?? 1;
    for (const [role, candidate] of [["chosen", pair.chosen], ["rejected", pair.rejected]]) {
      const key = keyFn(candidate);
      stats[key] ??= { total: 0, chosen: 0, rejected: 0 };
      stats[key].total += weight;
      stats[key][role] += weight;
    }
  }
  return Object.fromEntries(Object.entries(stats).map(([key, row]) => [
    key,
    { ...row, smoothed_supported_rate: (row.chosen + 1) / (row.total + 2) },
  ]));
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

function recencyWeights(factor) {
  return Object.fromEntries(chronologicalWindows.map((window, index) => [window, Math.pow(factor, index)]));
}

function priorFor(key, priors) {
  return priors[key]?.smoothed_supported_rate ?? 0.5;
}

function summarizeSelection(policy) {
  return {
    policy: policy.policy,
    examples: policy.examples,
    train_pairs: policy.train_pairs,
    selected_supported: policy.selected_supported,
    selected_unsupported: policy.selected_unsupported,
    selection_support_rate: rate(policy.selected_supported, policy.examples),
    unknown_top_count: policy.unknown_top_count,
    selected_family_counts: policy.selected_family_counts,
    prior_key_count: Object.keys(policy.priors).length,
  };
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
  const selected = result.final_policies[result.preregistered_selector.selected_policy];
  const weak = result.comparison;
  return `# Time-Aware Source-Prefix Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit preregisters a recency-weighted normalized source-prefix selector and evaluates it against final-window selection and non-final chronological stress.

## Selection

- Selected policy: ${result.preregistered_selector.selected_policy}
- Final selection: ${selected.selected_supported}/${selected.examples} supported
- Source-prefix audit baseline: ${weak.source_prefix_audit_selected_supported}/49 supported
- Family-prior baseline: ${weak.committed_family_prior_selected_supported}/49 supported
- Hard prefix split, family prior: ${weak.family_prior_prefix_240_320_correct}/20
- Hard prefix split, source prefix: ${weak.source_prefix_prefix_240_320_correct}/${weak.source_prefix_prefix_240_320_pairs}

## Decision

- Promote time-aware source-prefix selector now: ${result.decision.promote_time_aware_source_prefix_selector_now ? "yes" : "no"}
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
