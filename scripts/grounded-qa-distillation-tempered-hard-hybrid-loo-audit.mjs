import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "tempered-hard-hybrid-loo-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const cleanRunId = "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1";
const frontierRunId = "frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1";
const d262RunId = "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const hardRunId = "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const boundaryRunId = "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1";
const d280RunId = "tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1";
const budgetFile = path.join(experimentDir, "spend", "budget.json");
const weights = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(budgetFile);
const d280 = await readJson(path.join(runsDir, d280RunId, "result.json"));
const cleanRows = await readJsonl(path.join(runsDir, cleanRunId, "selector_pair_strata.jsonl"));
const frontierReplayRows = await readJsonl(path.join(runsDir, frontierRunId, "pair_replay.jsonl"));
const d262ExistingRows = await readJsonl(path.join(runsDir, d262RunId, "existing_validation_pair_predictions.jsonl"));
const hardExistingRows = await readJsonl(path.join(runsDir, hardRunId, "baseline_existing_validation_predictions.jsonl"));
const boundaryExistingRows = await readJsonl(path.join(runsDir, boundaryRunId, "boundary_existing_validation_pair_predictions.jsonl"));

const cleanPairRows = cleanRows.filter((row) => row.stratum === "clean_eval" && row.selector === "d262_pool_pairwise");
const cleanPairIds = new Set(cleanPairRows.map((row) => row.pair_id));
const cleanExampleIds = [...new Set(cleanPairRows.map((row) => row.example_id))];
const hardByPair = new Map(hardExistingRows.map((row) => [row.pair_id, row]));
const boundaryByPair = new Map(boundaryExistingRows.map((row) => [row.pair_id, row]));
const frozenAlphaHard = Number(d280.selected_policy.alpha_hard_negative);
const frozenAlphaBoundary = Number(d280.selected_policy.alpha_boundary);

const foldRows = cleanExampleIds.map((exampleId) => auditFold(exampleId));
const frozenHeldoutPairRows = cleanPairRows.map((row) => scoreExistingPair(d262ExistingRows.find((pair) => pair.pair_id === row.pair_id), frozenAlphaHard, frozenAlphaBoundary, "frozen_d280"));
const selectedHeldoutPairs = foldRows.flatMap((row) => row.selected_heldout_pair_rows);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "tempered_hard_hybrid_loo_audit",
  purpose: "Stress-test the D280 tempered hard-negative coefficient with leave-one-clean-example-out selection using existing non-final rows only.",
  source_runs: {
    d280_candidate: d280RunId,
    clean_validation_slice: cleanRunId,
    frontier_replay: frontierRunId,
    d262_selector: d262RunId,
    hard_negative_selector: hardRunId,
    boundary_selector: boundaryRunId,
  },
  summary: {
    clean_examples: cleanExampleIds.length,
    clean_pairs: cleanPairIds.size,
    folds: foldRows.length,
    folds_reselecting_frozen_policy: foldRows.filter((row) => row.selected_alpha_hard_negative === frozenAlphaHard && row.selected_alpha_boundary === frozenAlphaBoundary).length,
    loo_selected_heldout_correct: selectedHeldoutPairs.filter((row) => row.correct).length,
    loo_selected_heldout_pairs: selectedHeldoutPairs.length,
    frozen_d280_heldout_correct: frozenHeldoutPairRows.filter((row) => row.correct).length,
    frozen_d280_heldout_pairs: frozenHeldoutPairRows.length,
    d262_heldout_correct: cleanPairRows.filter((row) => selectorCleanRow(row, "d262_pool_pairwise")?.correct === true).length,
  },
  frozen_policy: {
    alpha_hard_negative: frozenAlphaHard,
    alpha_boundary: frozenAlphaBoundary,
    source: d280RunId,
  },
  fold_summary: summarizeFolds(foldRows),
  diagnosis: diagnose(foldRows, selectedHeldoutPairs, frozenHeldoutPairRows),
  decision: {
    promote_tempered_hard_hybrid_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    use_final_window_rows_for_training_tuning_or_evaluation: false,
    next_step: "Do not deploy the D280 coefficient until it is confirmed on a larger temporally separate clean heldout; use LOO instability as the reason to keep it hypothesis-only.",
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
    note: "This LOO audit reuses existing local selector margins only.",
  },
  artifacts: {
    fold_rows_jsonl: rel(path.join(outputDir, "fold_rows.jsonl")),
    selected_heldout_pair_rows_jsonl: rel(path.join(outputDir, "selected_heldout_pair_rows.jsonl")),
    frozen_heldout_pair_rows_jsonl: rel(path.join(outputDir, "frozen_heldout_pair_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "fold_rows.jsonl"), foldRows.map(({ selected_heldout_pair_rows, ...row }) => row));
await writeJsonl(path.join(outputDir, "selected_heldout_pair_rows.jsonl"), selectedHeldoutPairs);
await writeJsonl(path.join(outputDir, "frozen_heldout_pair_rows.jsonl"), frozenHeldoutPairRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, foldRows);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  fold_summary: result.fold_summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function auditFold(heldoutExampleId) {
  const heldoutPairIds = new Set(cleanPairRows.filter((row) => row.example_id === heldoutExampleId).map((row) => row.pair_id));
  const trainPairIds = new Set([...cleanPairIds].filter((pairId) => !heldoutPairIds.has(pairId)));
  const selected = selectPolicy(trainPairIds);
  const heldoutPairRows = d262ExistingRows
    .filter((row) => heldoutPairIds.has(row.pair_id))
    .map((row) => scoreExistingPair(row, selected.alpha_hard_negative, selected.alpha_boundary, "loo_selected"));
  const frozenHeldoutRows = d262ExistingRows
    .filter((row) => heldoutPairIds.has(row.pair_id))
    .map((row) => scoreExistingPair(row, frozenAlphaHard, frozenAlphaBoundary, "frozen_d280"));
  return {
    heldout_example_id: heldoutExampleId,
    heldout_pairs: heldoutPairIds.size,
    train_clean_pairs: trainPairIds.size,
    selected_alpha_hard_negative: selected.alpha_hard_negative,
    selected_alpha_boundary: selected.alpha_boundary,
    selected_train_clean_correct: selected.clean_validation_correct,
    selected_existing_validation_correct: selected.existing_validation_correct,
    selected_frontier_validation_correct: selected.frontier_validation_correct,
    selected_heldout_correct: heldoutPairRows.filter((row) => row.correct).length,
    frozen_d280_heldout_correct: frozenHeldoutRows.filter((row) => row.correct).length,
    d262_heldout_correct: [...heldoutPairIds].filter((pairId) => selectorCleanRow({ pair_id: pairId }, "d262_pool_pairwise")?.correct === true).length,
    reselected_frozen_policy: selected.alpha_hard_negative === frozenAlphaHard && selected.alpha_boundary === frozenAlphaBoundary,
    selected_heldout_pair_rows: heldoutPairRows,
  };
}

function selectPolicy(trainPairIds) {
  const rows = [];
  for (const alphaHardNegative of weights) {
    for (const alphaBoundary of weights) {
      const existingRows = d262ExistingRows.map((row) => scoreExistingPair(row, alphaHardNegative, alphaBoundary, "grid"));
      const trainCleanRows = existingRows.filter((row) => trainPairIds.has(row.pair_id));
      const frontierRows = frontierReplayRows.map((row) => scoreFrontierPair(row, alphaBoundary));
      const row = {
        alpha_hard_negative: alphaHardNegative,
        alpha_boundary: alphaBoundary,
        existing_validation_correct: existingRows.filter((item) => item.correct).length,
        clean_validation_correct: trainCleanRows.filter((item) => item.correct).length,
        clean_validation_pairs: trainCleanRows.length,
        frontier_validation_correct: frontierRows.filter((item) => item.correct).length,
        weight_l1: round(Math.abs(alphaHardNegative) + Math.abs(alphaBoundary)),
      };
      if (row.existing_validation_correct >= 20 && row.frontier_validation_correct >= 19) rows.push(row);
    }
  }
  rows.sort((left, right) => (right.clean_validation_correct - left.clean_validation_correct)
    || (right.frontier_validation_correct - left.frontier_validation_correct)
    || (right.existing_validation_correct - left.existing_validation_correct)
    || (left.weight_l1 - right.weight_l1)
    || (Math.abs(left.alpha_boundary) - Math.abs(right.alpha_boundary))
    || (Math.abs(left.alpha_hard_negative) - Math.abs(right.alpha_hard_negative)));
  if (!rows[0]) throw new Error("No LOO policy satisfied existing/frontier thresholds.");
  return rows[0];
}

function scoreExistingPair(row, alphaHardNegative, alphaBoundary, selector) {
  if (!row) throw new Error("Missing existing pair row.");
  const hardMargin = Number(hardByPair.get(row.pair_id)?.margin ?? 0);
  const boundaryMargin = Number(boundaryByPair.get(row.pair_id)?.margin ?? 0);
  const margin = Number(row.margin ?? 0) + alphaHardNegative * hardMargin + alphaBoundary * boundaryMargin;
  return {
    pair_id: row.pair_id,
    example_id: row.example_id,
    selector,
    alpha_hard_negative: alphaHardNegative,
    alpha_boundary: alphaBoundary,
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
    combined_margin: round(margin),
    correct: margin >= 0,
  };
}

function selectorCleanRow(row, selector) {
  return cleanRows.find((candidate) => candidate.pair_id === row.pair_id && candidate.selector === selector);
}

function summarizeFolds(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.selected_alpha_hard_negative}:${row.selected_alpha_boundary}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  return {
    selected_policy_counts: Object.fromEntries([...grouped.entries()].sort()),
    fold_heldout_correct: rows.reduce((sum, row) => sum + row.selected_heldout_correct, 0),
    fold_heldout_pairs: rows.reduce((sum, row) => sum + row.heldout_pairs, 0),
    frozen_heldout_correct: rows.reduce((sum, row) => sum + row.frozen_d280_heldout_correct, 0),
    d262_heldout_correct: rows.reduce((sum, row) => sum + row.d262_heldout_correct, 0),
  };
}

function diagnose(folds, selectedRows, frozenRows) {
  const selectedCorrect = selectedRows.filter((row) => row.correct).length;
  const frozenCorrect = frozenRows.filter((row) => row.correct).length;
  const foldsReselectingFrozen = folds.filter((row) => row.reselected_frozen_policy).length;
  return {
    primary_finding: foldsReselectingFrozen === folds.length ? "tempered_policy_stable_under_loo" : "tempered_policy_not_stable_under_loo",
    folds_reselecting_frozen_policy: foldsReselectingFrozen,
    folds: folds.length,
    loo_selected_heldout_correct: selectedCorrect,
    frozen_d280_heldout_correct: frozenCorrect,
    interpretation: foldsReselectingFrozen === folds.length
      ? "Every clean-example holdout reselects the D280 coefficient, but a larger temporal holdout is still required before promotion."
      : "The fixed D280 coefficient remains high-scoring, but the coefficient-selection rule depends on the small clean diagnostic slice and does not reliably reselect the same policy under leave-one-example-out.",
  };
}

function renderReport(result, foldRows) {
  return `# Tempered Hard Hybrid LOO Audit

Generated: ${result.generated_at}

This is a zero-call leave-one-clean-example-out stability audit. It uses no final-window labels and makes no OpenAI or GPU calls.

## Summary

- Clean examples: ${result.summary.clean_examples}
- Clean pairs: ${result.summary.clean_pairs}
- Folds reselecting frozen D280 policy: ${result.summary.folds_reselecting_frozen_policy}/${result.summary.folds}
- LOO-selected heldout pair correctness: ${result.summary.loo_selected_heldout_correct}/${result.summary.loo_selected_heldout_pairs}
- Frozen D280 heldout pair correctness: ${result.summary.frozen_d280_heldout_correct}/${result.summary.frozen_d280_heldout_pairs}
- D262 heldout pair correctness: ${result.summary.d262_heldout_correct}/${result.summary.frozen_d280_heldout_pairs}

## Fold Policies

${foldRows.map((row) => `- ${row.heldout_example_id}: alpha_hard=${row.selected_alpha_hard_negative}, alpha_boundary=${row.selected_alpha_boundary}, heldout ${row.selected_heldout_correct}/${row.heldout_pairs}, frozen ${row.frozen_d280_heldout_correct}/${row.heldout_pairs}, D262 ${row.d262_heldout_correct}/${row.heldout_pairs}`).join("\n")}

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

function round(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function rel(file) {
  return path.relative(rootDir, file);
}
