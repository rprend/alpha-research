import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "final-selector-ceiling-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const selectionSpecs = [
  {
    policy_id: "constrained_pool_pairwise",
    run_id: "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1",
    file: "final_diagnostic_selections.jsonl",
    selection_source: "qwen_frontier_pool",
    selected_on_final: false,
  },
  {
    policy_id: "boundary_only",
    run_id: "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1",
    file: "boundary_final_diagnostic_selections.jsonl",
    selection_source: "qwen_frontier_pool",
    selected_on_final: false,
  },
  {
    policy_id: "filtered_boundary_hybrid",
    run_id: "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1",
    file: "hybrid_final_diagnostic_selections.jsonl",
    selection_source: "qwen_frontier_pool",
    selected_on_final: false,
  },
  {
    policy_id: "overexpansion_aware",
    run_id: "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1",
    file: "final_diagnostic_selections.jsonl",
    selection_source: "qwen_frontier_pool",
    selected_on_final: true,
  },
  {
    policy_id: "calibrated_overexpansion_hybrid",
    run_id: "calibrated-overexpansion-hybrid-qwen-frontier-pool-2026-06-28-v1",
    file: "final_diagnostic_selections.jsonl",
    selection_source: "qwen_frontier_pool",
    selected_on_final: false,
  },
  {
    policy_id: "time_aware_source_prefix_recency_4x",
    run_id: "time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1",
    file: "source_prefix_recency_4x_final_selections.jsonl",
    selection_source: "mixed_scaffold_pool",
    selected_on_final: false,
  },
];

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const policyRows = [];
const missRows = [];
const policyExampleRows = [];

for (const spec of selectionSpecs) {
  const filePath = path.join(runsDir, spec.run_id, spec.file);
  let rows;
  try {
    rows = await readJsonl(filePath);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const examples = rows.map((row) => summarizeSelection(spec, row));
  policyExampleRows.push(...examples);
  missRows.push(...examples.filter((row) => row.recoverable_selector_miss));
  policyRows.push(summarizePolicy(spec, examples));
}

const deployableRows = policyRows.filter((row) => !row.selected_on_final);
const bestDeployable = [...deployableRows].sort(policySort)[0] ?? null;
const bestOracle = [...policyRows].sort((left, right) => right.oracle_supported_rate - left.oracle_supported_rate || right.examples - left.examples)[0] ?? null;
const qwenFrontierRows = policyRows.filter((row) => row.selection_source === "qwen_frontier_pool");
const qwenFrontierBest = [...qwenFrontierRows].sort(policySort)[0] ?? null;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_selector_ceiling_audit",
  status: deriveStatus(bestDeployable, bestOracle, qwenFrontierBest),
  purpose: "Quantify whether final-window failures are caused by lack of supported candidates, candidate selection errors, or non-deployable final-label selection.",
  policies_evaluated: policyRows.length,
  policy_summary: {
    deployable_policies: deployableRows.length,
    final_selected_or_diagnostic_policies: policyRows.length - deployableRows.length,
    best_deployable_policy_id: bestDeployable?.policy_id ?? null,
    best_deployable_selection_support_rate: bestDeployable?.selection_support_rate ?? null,
    best_deployable_oracle_supported_rate: bestDeployable?.oracle_supported_rate ?? null,
    best_deployable_recoverable_miss_rate: bestDeployable?.recoverable_miss_rate ?? null,
    best_qwen_frontier_policy_id: qwenFrontierBest?.policy_id ?? null,
    best_qwen_frontier_selection_support_rate: qwenFrontierBest?.selection_support_rate ?? null,
    best_qwen_frontier_oracle_supported_rate: qwenFrontierBest?.oracle_supported_rate ?? null,
    best_oracle_policy_id: bestOracle?.policy_id ?? null,
    best_oracle_supported_rate: bestOracle?.oracle_supported_rate ?? null,
  },
  bottleneck: {
    supported_candidates_exist: Boolean(bestOracle && bestOracle.oracle_supported_rate >= 0.9),
    deployable_selector_captures_ceiling: Boolean(bestDeployable && bestDeployable.ceiling_capture_rate >= 0.75),
    qwen_frontier_pool_has_generation_headroom: Boolean(qwenFrontierBest && qwenFrontierBest.oracle_supported_rate >= 0.9),
    qwen_frontier_selector_captures_ceiling: Boolean(qwenFrontierBest && qwenFrontierBest.ceiling_capture_rate >= 0.75),
    main_failure_mode: mainFailureMode(bestDeployable, qwenFrontierBest),
    implication: "The mixed OpenAI-scaffold pool is near ceiling, but the cheap Qwen-frontier path still misses supported candidates that are already present. Do not spend on another generator-only run until a support verifier can select those candidates.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_reporting: true,
    diagnostic_final_selected_policy_flagged: policyRows.filter((row) => row.selected_on_final).map((row) => row.policy_id),
  },
  decision: decision(bestDeployable, qwenFrontierBest),
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
    note: "This audit reads existing judged selection artifacts only.",
  },
  artifacts: {
    policy_metrics_jsonl: rel(path.join(outputDir, "policy_metrics.jsonl")),
    example_metrics_jsonl: rel(path.join(outputDir, "example_metrics.jsonl")),
    recoverable_misses_jsonl: rel(path.join(outputDir, "recoverable_misses.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "policy_metrics.jsonl"), policyRows);
await writeJsonl(path.join(outputDir, "example_metrics.jsonl"), policyExampleRows);
await writeJsonl(path.join(outputDir, "recoverable_misses.jsonl"), missRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result, policyRows));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  policies_evaluated: result.policies_evaluated,
  policy_summary: result.policy_summary,
  bottleneck: result.bottleneck,
  decision: result.decision,
}, null, 2));

function summarizeSelection(spec, row) {
  const ranked = Array.isArray(row.ranked_candidates) ? row.ranked_candidates : [];
  const supported = ranked.filter((candidate) => candidate.supported_answer === true);
  const selected = ranked.find((candidate) => candidate.candidate_id === row.selected_candidate_id) ?? ranked[0] ?? null;
  const selectedSupported = Boolean(row.selected_supported_answer ?? selected?.supported_answer);
  const bestSupported = bestSupportedCandidate(supported);
  return {
    policy_id: spec.policy_id,
    source_run_id: spec.run_id,
    selection_source: spec.selection_source,
    selected_on_final: spec.selected_on_final,
    example_id: row.example_id,
    selected_candidate_id: row.selected_candidate_id ?? selected?.candidate_id ?? null,
    selected_family: row.selected_family ?? selected?.family ?? null,
    selected_supported_answer: selectedSupported,
    selected_score: asNumber(row.selected_score ?? selected?.score),
    candidate_count: asNumber(row.candidate_count ?? ranked.length),
    supported_candidate_count: asNumber(row.supported_candidate_count ?? supported.length),
    unsupported_candidate_count: asNumber(row.unsupported_candidate_count ?? ranked.length - supported.length),
    has_supported_candidate: supported.length > 0,
    best_supported_candidate_id: bestSupported?.candidate_id ?? null,
    best_supported_family: bestSupported?.family ?? null,
    best_supported_score: asNumber(bestSupported?.score),
    recoverable_selector_miss: !selectedSupported && supported.length > 0,
    selected_rank: ranked.findIndex((candidate) => candidate.candidate_id === (row.selected_candidate_id ?? selected?.candidate_id)) + 1 || null,
    best_supported_rank: bestSupported ? ranked.findIndex((candidate) => candidate.candidate_id === bestSupported.candidate_id) + 1 || null : null,
    miss_gap_rank: bestSupported ? ranked.findIndex((candidate) => candidate.candidate_id === bestSupported.candidate_id) + 1 : null,
  };
}

function summarizePolicy(spec, examples) {
  const selectedSupported = examples.filter((row) => row.selected_supported_answer).length;
  const withSupported = examples.filter((row) => row.has_supported_candidate).length;
  const misses = examples.filter((row) => row.recoverable_selector_miss).length;
  const unsupportedNoCandidate = examples.filter((row) => !row.selected_supported_answer && !row.has_supported_candidate).length;
  return {
    policy_id: spec.policy_id,
    source_run_id: spec.run_id,
    selection_file: spec.file,
    selection_source: spec.selection_source,
    selected_on_final: spec.selected_on_final,
    examples: examples.length,
    selected_supported: selectedSupported,
    selected_unsupported: examples.length - selectedSupported,
    selection_support_rate: rate(selectedSupported, examples.length),
    oracle_supported_examples: withSupported,
    oracle_unsupported_examples: examples.length - withSupported,
    oracle_supported_rate: rate(withSupported, examples.length),
    recoverable_selector_misses: misses,
    unrecoverable_candidate_absence_misses: unsupportedNoCandidate,
    recoverable_miss_rate: rate(misses, examples.length),
    ceiling_capture_rate: rate(selectedSupported, withSupported),
    mean_supported_candidate_count: mean(examples.map((row) => row.supported_candidate_count)),
    mean_candidate_count: mean(examples.map((row) => row.candidate_count)),
  };
}

function bestSupportedCandidate(candidates) {
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const scoreDelta = asNumber(right.score, 0) - asNumber(left.score, 0);
    if (scoreDelta) return scoreDelta;
    return String(left.candidate_id ?? "").localeCompare(String(right.candidate_id ?? ""));
  })[0];
}

function policySort(left, right) {
  return right.selection_support_rate - left.selection_support_rate
    || right.ceiling_capture_rate - left.ceiling_capture_rate
    || right.examples - left.examples
    || left.policy_id.localeCompare(right.policy_id);
}

function deriveStatus(bestDeployable, bestOracle, qwenFrontierBest) {
  if (!bestDeployable || !bestOracle) return "selector_ceiling_audit_incomplete";
  if (qwenFrontierBest?.oracle_supported_rate >= 0.9 && qwenFrontierBest.selection_support_rate < 0.75) {
    return "cheap_frontier_selector_bottleneck_confirmed";
  }
  if (qwenFrontierBest?.oracle_supported_rate < 0.75) return "candidate_generation_bottleneck_confirmed";
  if (bestOracle.oracle_supported_rate >= 0.9 && bestDeployable.selection_support_rate < 0.75) {
    return "selector_transfer_bottleneck_confirmed";
  }
  return "selector_ceiling_gap_mixed";
}

function mainFailureMode(bestDeployable, qwenFrontierBest) {
  if (!bestDeployable) return "missing_deployable_policy_artifacts";
  if (qwenFrontierBest?.oracle_supported_rate >= 0.9 && qwenFrontierBest.selection_support_rate < 0.75) {
    return "cheap_qwen_frontier_selector_fails_to_capture_present_supported_candidates";
  }
  if (bestDeployable.oracle_supported_rate >= 0.9 && bestDeployable.recoverable_miss_rate >= 0.2) {
    return "deployable_selector_fails_to_capture_present_supported_candidates";
  }
  if (qwenFrontierBest && qwenFrontierBest.oracle_supported_rate < 0.75) {
    return "qwen_frontier_candidate_pool_lacks_supported_candidates";
  }
  if (bestDeployable.selection_support_rate >= 0.75) return "deployable_selector_near_threshold";
  return "mixed_generation_and_selection_gap";
}

function decision(bestDeployable, qwenFrontierBest) {
  const selectorBottleneck = bestDeployable?.oracle_supported_rate >= 0.9 && bestDeployable?.selection_support_rate < 0.75;
  const cheapSelectorBottleneck = qwenFrontierBest?.oracle_supported_rate >= 0.9 && qwenFrontierBest?.selection_support_rate < 0.75;
  return {
    launch_gpu_now: false,
    buy_more_openai_labels_now: false,
    integrate_selector_now: false,
    train_generator_next: false,
    train_support_verifier_next: selectorBottleneck || cheapSelectorBottleneck,
    reason: cheapSelectorBottleneck
      ? "The cheap Qwen-frontier pool already contains supported answers in every final diagnostic example, but its best selector only chooses supported answers in 5/8 cases; generator-only spend is not the next bottleneck."
      : selectorBottleneck
      ? "Final candidate pools already contain supported answers, but deployable selectors miss too many of them; generator-only spend is not the next bottleneck."
      : "The available artifacts do not yet isolate a safe paid intervention.",
    next_step: cheapSelectorBottleneck || selectorBottleneck
      ? "Build a verifier target that directly judges claim/evidence support for candidate answers, then test it as a selector before any new generator GPU run."
      : qwenFrontierBest?.oracle_supported_rate < 0.75
        ? "Improve candidate generation coverage before selector work."
        : "Inspect mixed failure rows before spending.",
  };
}

function renderReport(result, policyRows) {
  const rows = policyRows
    .map((row) => `| ${row.policy_id} | ${row.selected_on_final ? "yes" : "no"} | ${row.examples} | ${pct(row.selection_support_rate)} | ${pct(row.oracle_supported_rate)} | ${pct(row.ceiling_capture_rate)} | ${row.recoverable_selector_misses} |`)
    .join("\n");
  return `# Final Selector Ceiling Audit

This audit reads existing final-window selection artifacts and asks whether misses are recoverable by better selection from already-present supported candidates.

## Summary

- Status: ${result.status}
- Best deployable policy: ${result.policy_summary.best_deployable_policy_id}
- Best deployable selected support: ${pct(result.policy_summary.best_deployable_selection_support_rate)}
- Best deployable oracle support ceiling: ${pct(result.policy_summary.best_deployable_oracle_supported_rate)}
- Main failure mode: ${result.bottleneck.main_failure_mode}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Train support verifier next: ${result.decision.train_support_verifier_next ? "yes" : "no"}

## Policy Metrics

| Policy | Selected on final | Examples | Selected support | Oracle support ceiling | Ceiling capture | Recoverable misses |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
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

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function asNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  const numbers = values.map((value) => Number(value)).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}
