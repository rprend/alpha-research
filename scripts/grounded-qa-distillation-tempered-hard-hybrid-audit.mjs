import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const cleanRunId = "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1";
const frontierRunId = "frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1";
const d262RunId = "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const hardRunId = "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const boundaryRunId = "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const budgetFile = path.join(experimentDir, "spend", "budget.json");
const weights = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(budgetFile);
const cleanResult = await readJson(path.join(runsDir, cleanRunId, "result.json"));
const cleanRows = await readJsonl(path.join(runsDir, cleanRunId, "selector_pair_strata.jsonl"));
const frontierReplayRows = await readJsonl(path.join(runsDir, frontierRunId, "pair_replay.jsonl"));
const d262ExistingRows = await readJsonl(path.join(runsDir, d262RunId, "existing_validation_pair_predictions.jsonl"));
const hardExistingRows = await readJsonl(path.join(runsDir, hardRunId, "baseline_existing_validation_predictions.jsonl"));
const boundaryExistingRows = await readJsonl(path.join(runsDir, boundaryRunId, "boundary_existing_validation_pair_predictions.jsonl"));

const cleanPairIds = new Set(cleanRows.filter((row) => row.stratum === "clean_eval").map((row) => row.pair_id));
const hardByPair = new Map(hardExistingRows.map((row) => [row.pair_id, row]));
const boundaryByPair = new Map(boundaryExistingRows.map((row) => [row.pair_id, row]));
const gridRows = buildGrid();
const eligibleRows = gridRows.filter((row) => row.existing_validation_correct >= 20 && row.frontier_validation_correct >= 19);
const selectedPolicy = [...eligibleRows].sort(policySort)[0];
const selectedPairRows = d262ExistingRows.map((row) => scoreExistingPair(row, selectedPolicy.alpha_hard_negative, selectedPolicy.alpha_boundary));
const selectedCleanRows = selectedPairRows.filter((row) => cleanPairIds.has(row.pair_id));
const selectedFrontierRows = frontierReplayRows.map((row) => scoreFrontierPair(row, selectedPolicy.alpha_boundary));
const baselineComparison = {
  d262_pool_pairwise_existing: summarizeCorrect(d262ExistingRows),
  d262_pool_pairwise_clean: cleanResult.strata_summary["clean_eval:d262_pool_pairwise"],
  d262_proxy_frontier: summarizeFrontier(frontierReplayRows, "d262_proxy_margin"),
  hard_negative_existing: summarizeCorrect(hardExistingRows),
  hard_negative_clean: summarizeCorrect(hardExistingRows.filter((row) => cleanPairIds.has(row.pair_id))),
  boundary_existing: summarizeCorrect(boundaryExistingRows),
  boundary_clean: summarizeCorrect(boundaryExistingRows.filter((row) => cleanPairIds.has(row.pair_id))),
};
const diagnosis = diagnose(selectedPolicy, baselineComparison);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "tempered_hard_hybrid_audit",
  purpose: "Grid small hard-negative and boundary margin adjustments on non-final validation rows to find a comparable-coverage hybrid candidate without spending more budget.",
  source_runs: {
    clean_validation_slice: cleanRunId,
    frontier_replay: frontierRunId,
    d262_selector: d262RunId,
    hard_negative_selector: hardRunId,
    boundary_selector: boundaryRunId,
  },
  summary: {
    grid_rows: gridRows.length,
    eligible_policy_rows: eligibleRows.length,
    existing_validation_pairs: d262ExistingRows.length,
    clean_validation_pairs: cleanPairIds.size,
    frontier_validation_pairs: frontierReplayRows.length,
  },
  selected_policy: selectedPolicy,
  selected_policy_rows: {
    existing_validation: summarizeScoredRows(selectedPairRows),
    clean_validation: summarizeScoredRows(selectedCleanRows),
    frontier_validation: summarizeScoredRows(selectedFrontierRows),
  },
  baseline_comparison: baselineComparison,
  diagnosis,
  decision: {
    promote_tempered_hard_hybrid_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    use_final_window_rows_for_training_tuning_or_evaluation: false,
    next_step: "Freeze the tempered hard-negative coefficient as a candidate hypothesis and test it on a larger clean non-final heldout before changing the active selector.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: false,
    clean_validation_training_use: "allowed_validation_diagnostic_only",
    frontier_validation_training_use: "allowed_nonfinal_frontier_supervision",
    audit_is_zero_call: true,
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
    note: "This audit reuses existing local selector margins only.",
  },
  artifacts: {
    grid_rows_jsonl: rel(path.join(outputDir, "grid_rows.jsonl")),
    selected_existing_pair_rows_jsonl: rel(path.join(outputDir, "selected_existing_pair_rows.jsonl")),
    selected_frontier_pair_rows_jsonl: rel(path.join(outputDir, "selected_frontier_pair_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "grid_rows.jsonl"), gridRows);
await writeJsonl(path.join(outputDir, "selected_existing_pair_rows.jsonl"), selectedPairRows);
await writeJsonl(path.join(outputDir, "selected_frontier_pair_rows.jsonl"), selectedFrontierRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  selected_policy: result.selected_policy,
  selected_policy_rows: result.selected_policy_rows,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function buildGrid() {
  const rows = [];
  for (const alphaHardNegative of weights) {
    for (const alphaBoundary of weights) {
      const existingRows = d262ExistingRows.map((row) => scoreExistingPair(row, alphaHardNegative, alphaBoundary));
      const cleanScoredRows = existingRows.filter((row) => cleanPairIds.has(row.pair_id));
      const frontierRows = frontierReplayRows.map((row) => scoreFrontierPair(row, alphaBoundary));
      rows.push({
        alpha_hard_negative: alphaHardNegative,
        alpha_boundary: alphaBoundary,
        existing_validation_pairs: existingRows.length,
        existing_validation_correct: existingRows.filter((row) => row.correct).length,
        existing_validation_accuracy: rate(existingRows.filter((row) => row.correct).length, existingRows.length),
        clean_validation_pairs: cleanScoredRows.length,
        clean_validation_correct: cleanScoredRows.filter((row) => row.correct).length,
        clean_validation_accuracy: rate(cleanScoredRows.filter((row) => row.correct).length, cleanScoredRows.length),
        frontier_validation_pairs: frontierRows.length,
        frontier_validation_correct: frontierRows.filter((row) => row.correct).length,
        frontier_validation_accuracy: rate(frontierRows.filter((row) => row.correct).length, frontierRows.length),
        weight_l1: round(Math.abs(alphaHardNegative) + Math.abs(alphaBoundary)),
      });
    }
  }
  return rows;
}

function scoreExistingPair(row, alphaHardNegative, alphaBoundary) {
  const hardMargin = Number(hardByPair.get(row.pair_id)?.margin ?? 0);
  const boundaryMargin = Number(boundaryByPair.get(row.pair_id)?.margin ?? 0);
  const margin = Number(row.margin ?? 0) + alphaHardNegative * hardMargin + alphaBoundary * boundaryMargin;
  return {
    pair_id: row.pair_id,
    example_id: row.example_id,
    stratum: cleanPairIds.has(row.pair_id) ? "clean_eval" : "other_validation",
    alpha_hard_negative: alphaHardNegative,
    alpha_boundary: alphaBoundary,
    d262_margin: round(row.margin ?? 0),
    hard_negative_margin: round(hardMargin),
    boundary_margin: round(boundaryMargin),
    combined_margin: round(margin),
    predicted_preferred: margin >= 0 ? "chosen" : "rejected",
    correct: margin >= 0,
    training_use: row.training_use,
  };
}

function scoreFrontierPair(row, alphaBoundary) {
  const margin = Number(row.d262_proxy_margin ?? 0) + alphaBoundary * Number(row.boundary_margin ?? 0);
  return {
    pair_id: row.pair_id,
    example_id: row.example_id,
    alpha_boundary: alphaBoundary,
    d262_proxy_margin: round(row.d262_proxy_margin ?? 0),
    boundary_margin: round(row.boundary_margin ?? 0),
    combined_margin: round(margin),
    predicted_preferred: margin >= 0 ? "chosen" : "rejected",
    correct: margin >= 0,
    training_use: "allowed_nonfinal_frontier_supervision",
  };
}

function policySort(left, right) {
  return (right.clean_validation_correct - left.clean_validation_correct)
    || (right.frontier_validation_correct - left.frontier_validation_correct)
    || (right.existing_validation_correct - left.existing_validation_correct)
    || (left.weight_l1 - right.weight_l1)
    || (Math.abs(left.alpha_boundary) - Math.abs(right.alpha_boundary))
    || (Math.abs(left.alpha_hard_negative) - Math.abs(right.alpha_hard_negative));
}

function diagnose(selected, baselines) {
  const cleanDelta = Number(selected.clean_validation_correct) - Number(baselines.d262_pool_pairwise_clean.correct);
  const frontierDelta = Number(selected.frontier_validation_correct) - Number(baselines.d262_proxy_frontier.correct);
  return {
    primary_finding: cleanDelta > 0 && frontierDelta >= 0 ? "tempered_hard_negative_candidate_found" : "tempered_hard_negative_candidate_not_ready",
    selected_alpha_hard_negative: selected.alpha_hard_negative,
    selected_alpha_boundary: selected.alpha_boundary,
    selected_clean_delta_vs_d262_pool_pairwise: cleanDelta,
    selected_frontier_delta_vs_d262_proxy: frontierDelta,
    interpretation: cleanDelta > 0 && frontierDelta >= 0
      ? "A small negative hard-negative coefficient improves the clean non-final diagnostic while preserving existing and frontier thresholds, but it was selected on the diagnostic slice and needs a larger heldout before promotion."
      : "The grid did not find a candidate that improves clean validation while preserving frontier validation.",
  };
}

function renderReport(result) {
  return `# Tempered Hard Hybrid Audit

Generated: ${result.generated_at}

This is a zero-call comparable-coverage hybrid audit. It grids small hard-negative and boundary margin adjustments on non-final validation rows only and uses no final-window labels.

## Summary

- Grid rows: ${result.summary.grid_rows}
- Eligible policies preserving existing/frontier thresholds: ${result.summary.eligible_policy_rows}
- Existing validation pairs: ${result.summary.existing_validation_pairs}
- Clean validation pairs: ${result.summary.clean_validation_pairs}
- Frontier validation pairs: ${result.summary.frontier_validation_pairs}

## Selected Candidate

- Alpha hard-negative: ${result.selected_policy.alpha_hard_negative}
- Alpha boundary: ${result.selected_policy.alpha_boundary}
- Existing validation: ${result.selected_policy.existing_validation_correct}/${result.selected_policy.existing_validation_pairs}
- Clean validation: ${result.selected_policy.clean_validation_correct}/${result.selected_policy.clean_validation_pairs}
- Frontier validation: ${result.selected_policy.frontier_validation_correct}/${result.selected_policy.frontier_validation_pairs}

## Baselines

- D262 pool-pairwise clean: ${result.baseline_comparison.d262_pool_pairwise_clean.correct}/${result.baseline_comparison.d262_pool_pairwise_clean.pairs}
- D262 proxy frontier: ${result.baseline_comparison.d262_proxy_frontier.correct}/${result.baseline_comparison.d262_proxy_frontier.pairs}
- Hard-negative clean: ${result.baseline_comparison.hard_negative_clean.correct}/${result.baseline_comparison.hard_negative_clean.pairs}
- Boundary clean: ${result.baseline_comparison.boundary_clean.correct}/${result.baseline_comparison.boundary_clean.pairs}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote tempered hard hybrid now: ${result.decision.promote_tempered_hard_hybrid_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Next step: ${result.decision.next_step}
`;
}

function summarizeCorrect(rows) {
  const correct = rows.filter((row) => row.correct === true).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_abs_margin: round(mean(rows.map((row) => Math.abs(Number(row.margin ?? 0))))),
  };
}

function summarizeScoredRows(rows) {
  const correct = rows.filter((row) => row.correct === true).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_abs_margin: round(mean(rows.map((row) => Math.abs(Number(row.combined_margin ?? 0))))),
  };
}

function summarizeFrontier(rows, marginKey) {
  const correct = rows.filter((row) => Number(row[marginKey] ?? 0) >= 0).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    mean_abs_margin: round(mean(rows.map((row) => Math.abs(Number(row[marginKey] ?? 0))))),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function rate(correct, total) {
  return round(Number(correct) / Math.max(1, Number(total)));
}

function round(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function rel(file) {
  return path.relative(rootDir, file);
}
