import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const trainPacketRunId = args["train-packet-run"] ?? "nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1";
const transferRunId = args["transfer-run"] ?? "broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1";
const familyPriorRunId = args["family-prior-run"] ?? "family-prior-listwise-audit-0-320-to-321-389-2026-06-28-v1";
const temporalStressRunId = args["temporal-stress-run"] ?? "family-prior-temporal-stress-audit-0-320-to-321-389-2026-06-28-v1";
const runId = args["run-id"] ?? "source-prefix-reliability-audit-0-320-to-321-389-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const trainPairs = await readJsonl(path.join(runsDir, trainPacketRunId, "train_pairwise.jsonl"));
const finalSelections = await readJsonl(path.join(runsDir, transferRunId, "final_selections.jsonl"));
const familyPrior = await readJson(path.join(runsDir, familyPriorRunId, "result.json"));
const temporalStress = await readJson(path.join(runsDir, temporalStressRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const policies = [
  evaluatePolicy("family", (candidate) => candidate.family ?? "unknown", null),
  evaluatePolicy("exact_prediction_run_with_family_fallback", predictionRunKey, (candidate) => candidate.family ?? "unknown"),
  evaluatePolicy("source_prefix_with_family_fallback", sourcePrefixKey, (candidate) => candidate.family ?? "unknown"),
];
const selectedPolicy = policies.find((row) => row.policy === "source_prefix_with_family_fallback");

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "source_prefix_reliability_audit",
  status: "source_prefix_promising_not_promoted",
  purpose: "Test whether finer deployable source identity improves time-aware source reliability beyond broad family priors.",
  source_runs: {
    train_packet: trainPacketRunId,
    transfer_selector: transferRunId,
    family_prior_audit: familyPriorRunId,
    temporal_stress_audit: temporalStressRunId,
  },
  policies: Object.fromEntries(policies.map((row) => [row.policy, summarizePolicy(row)])),
  selected_policy: summarizePolicy(selectedPolicy),
  comparison: {
    committed_family_prior_selected_supported: familyPrior.final_selection?.selected_supported,
    source_prefix_selected_supported: selectedPolicy.selected_supported,
    delta_vs_committed_family_prior: selectedPolicy.selected_supported - Number(familyPrior.final_selection?.selected_supported ?? 0),
    exact_run_unknown_top_count: policies.find((row) => row.policy === "exact_prediction_run_with_family_fallback")?.unknown_top_count,
    source_prefix_unknown_top_count: selectedPolicy.unknown_top_count,
    temporal_stress_status: temporalStress.status,
  },
  decision: {
    promote_source_prefix_selector_now: false,
    buy_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Use normalized source-prefix reliability as a candidate feature in a preregistered time-aware listwise selector, but do not treat exact run IDs as transferable.",
    reason: "Exact run priors cannot transfer to unseen future runs, while normalized source prefixes improve final selection slightly and reduce misses, but the temporal stress caveat from D289 still applies.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_reporting_selection_correctness: true,
    source_prefix_uses_final_prediction_run_names_only_as_deployable_metadata: true,
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
    note: "Zero-call source-prefix audit over existing labels and selection artifacts.",
  },
};

for (const policy of policies) {
  await writeJsonl(path.join(outputDir, `${policy.policy}_final_selections.jsonl`), policy.selections);
}
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  policies: result.policies,
  comparison: result.comparison,
  decision: result.decision,
}, null, 2));

function evaluatePolicy(policy, keyFn, fallbackKeyFn) {
  const priors = buildPriors(trainPairs, keyFn);
  const fallbackPriors = fallbackKeyFn ? buildPriors(trainPairs, fallbackKeyFn) : {};
  const selections = finalSelections.map((row) => {
    const ranked = row.ranked_candidates
      .map((candidate) => {
        const key = keyFn(candidate);
        const directPrior = priorFor(key, priors);
        const fallbackKey = fallbackKeyFn ? fallbackKeyFn(candidate) : null;
        const fallbackPrior = fallbackKey ? priorFor(fallbackKey, fallbackPriors) : 0.5;
        return {
          ...candidate,
          source_reliability_key: key,
          fallback_reliability_key: fallbackKey,
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
      selected_direct_prior: ranked[0]?.direct_prior ?? null,
      selected_fallback_prior: ranked[0]?.fallback_prior ?? null,
      selected_reliability_score: ranked[0]?.reliability_score ?? null,
      direct_prior_known: ranked[0]?.direct_prior !== 0.5,
      candidate_count: ranked.length,
      ranked_candidates: ranked,
    };
  }).sort((left, right) => left.example_id.localeCompare(right.example_id));
  return {
    policy,
    priors,
    fallback_priors: fallbackPriors,
    selections,
    examples: selections.length,
    selected_supported: selections.filter((row) => row.selected_supported_answer).length,
    selected_unsupported: selections.filter((row) => !row.selected_supported_answer).length,
    unknown_top_count: selections.filter((row) => !row.direct_prior_known).length,
    selected_key_counts: countBy(selections.map((row) => row.selected_key ?? "unknown")),
    selected_family_counts: countBy(selections.map((row) => row.selected_family ?? "unknown")),
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

function summarizePolicy(policy) {
  return {
    policy: policy.policy,
    examples: policy.examples,
    selected_supported: policy.selected_supported,
    selected_unsupported: policy.selected_unsupported,
    selection_support_rate: rate(policy.selected_supported, policy.examples),
    unknown_top_count: policy.unknown_top_count,
    selected_key_counts: policy.selected_key_counts,
    selected_family_counts: policy.selected_family_counts,
    prior_key_count: Object.keys(policy.priors).length,
  };
}

function renderReport(result) {
  return `# Source-Prefix Reliability Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit tests whether deployable source identity should be represented as exact prediction-run IDs, broad families, or normalized source prefixes.

## Selection

- Family prior: ${result.policies.family.selected_supported}/${result.policies.family.examples} supported
- Exact run with family fallback: ${result.policies.exact_prediction_run_with_family_fallback.selected_supported}/${result.policies.exact_prediction_run_with_family_fallback.examples} supported; unknown tops ${result.policies.exact_prediction_run_with_family_fallback.unknown_top_count}
- Source prefix with family fallback: ${result.policies.source_prefix_with_family_fallback.selected_supported}/${result.policies.source_prefix_with_family_fallback.examples} supported; unknown tops ${result.policies.source_prefix_with_family_fallback.unknown_top_count}
- Delta vs committed family prior: ${signed(result.comparison.delta_vs_committed_family_prior)}

## Decision

- Promote source-prefix selector now: ${result.decision.promote_source_prefix_selector_now ? "yes" : "no"}
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
  return den ? num / den : 0;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
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
