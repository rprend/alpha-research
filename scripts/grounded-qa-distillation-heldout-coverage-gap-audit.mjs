import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "heldout-coverage-gap-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const budgetFile = path.join(experimentDir, "spend", "budget.json");

const qwenCleanRunId = "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1";
const qwenFrontierRunId = "frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1";
const d280RunId = "tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1";
const d281RunId = "tempered-hard-hybrid-loo-audit-qwen-frontier-pool-2026-06-28-v1";
const crossWindowRunId = "candidate-selector-cross-window-240-320-to-321-389-v1";
const finalAmbiguityRunId = "final-ambiguity-stratification-audit-qwen-frontier-pool-2026-06-28-v1";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(budgetFile);
const qwenClean = await readJson(path.join(runsDir, qwenCleanRunId, "result.json"));
const qwenFrontier = await readJson(path.join(runsDir, qwenFrontierRunId, "result.json"));
const d280 = await readJson(path.join(runsDir, d280RunId, "result.json"));
const d281 = await readJson(path.join(runsDir, d281RunId, "result.json"));
const crossWindow = await readJson(path.join(runsDir, crossWindowRunId, "result.json"));
const crossPredictions = await readJsonl(path.join(runsDir, crossWindowRunId, "predictions.jsonl"));
const finalAmbiguity = await readJson(path.join(runsDir, finalAmbiguityRunId, "result.json"));

const sourceRows = buildSourceRows();
const compatibleRows = sourceRows.filter((row) => row.d280_margin_compatible === true || row.d280_margin_compatible === "partial_boundary_only");
const largeCompatibleRows = compatibleRows.filter((row) => row.clean_or_eval_units >= 40);
const largeIncompatibleRows = sourceRows.filter((row) => !row.d280_margin_compatible && row.clean_or_eval_units >= 40);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "heldout_coverage_gap_audit",
  purpose: "Inventory existing heldout evidence after D281 and decide whether D280 can be validated without new labels or a new margin-compatible heldout packet.",
  source_runs: {
    qwen_clean_slice: qwenCleanRunId,
    qwen_frontier_replay: qwenFrontierRunId,
    d280_candidate: d280RunId,
    d281_loo_stability: d281RunId,
    temporal_cross_window_selector: crossWindowRunId,
    final_ambiguity_stratification: finalAmbiguityRunId,
  },
  summary: {
    sources_inventoried: sourceRows.length,
    d280_margin_compatible_sources: compatibleRows.length,
    large_d280_margin_compatible_sources: largeCompatibleRows.length,
    large_temporal_scaffold_sources_not_margin_compatible: largeIncompatibleRows.length,
    largest_margin_compatible_units: maxNumber(compatibleRows.map((row) => row.clean_or_eval_units)),
    largest_temporal_incompatible_units: maxNumber(largeIncompatibleRows.map((row) => row.clean_or_eval_units)),
  },
  source_summary: Object.fromEntries(sourceRows.map((row) => [row.source_id, row])),
  diagnosis: diagnose(sourceRows, largeCompatibleRows, largeIncompatibleRows),
  decision: {
    promote_d280_or_d281_selector_now: false,
    treat_321_389_as_d280_validation: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    next_step: "Build or identify a margin-compatible clean non-final heldout packet before selector promotion; use the 321-389 temporal window only for scaffold-level claims, not D280 validation.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_selector_validation: false,
    temporal_window_used_as_inventory_only: true,
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
    note: "This audit reads existing run metadata, predictions, and already-paid judgments only.",
  },
  artifacts: {
    source_inventory_jsonl: rel(path.join(outputDir, "source_inventory.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "source_inventory.jsonl"), sourceRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, sourceRows);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function buildSourceRows() {
  const temporalCorrect = crossPredictions.filter((row) => row.scores?.overall_correct === true).length;
  const temporalSupportedAnswers = crossPredictions.filter((row) => row.scores?.supported_answer === true).length;
  const temporalAnswered = crossPredictions.filter((row) => row.prediction?.answer_type === "grounded_answer").length;
  return [
    {
      source_id: "qwen_clean_nonfinal_slice",
      source_run_id: qwenCleanRunId,
      split_or_window: "expanded-qwen-existing-validation-clean",
      clean_or_eval_units: Number(qwenClean.summary.clean_eval_pairs),
      examples: Number(qwenClean.summary.clean_eval_examples),
      label_kind: "pairwise_supported_over_unsupported",
      d280_margin_compatible: true,
      temporal_or_paper_separate: false,
      ambiguity_screened: true,
      result: `D262 ${qwenClean.strata_summary["clean_eval:d262_pool_pairwise"].correct}/${qwenClean.strata_summary["clean_eval:d262_pool_pairwise"].pairs}; D280 ${d280.selected_policy.clean_validation_correct}/${d280.selected_policy.clean_validation_pairs}`,
      limitation: "The D280 coefficient was selected on this small clean diagnostic slice.",
    },
    {
      source_id: "qwen_frontier_replay",
      source_run_id: qwenFrontierRunId,
      split_or_window: "qwen-nonfinal-frontier-validation",
      clean_or_eval_units: Number(qwenFrontier.summary.frontier_validation_pairs),
      examples: null,
      label_kind: "pairwise_frontier_supported_over_unsupported",
      d280_margin_compatible: "partial_boundary_only",
      temporal_or_paper_separate: false,
      ambiguity_screened: false,
      result: `D262 proxy ${qwenFrontier.selector_summary.d262_proxy_hard_negative_baseline.correct}/${qwenFrontier.selector_summary.d262_proxy_hard_negative_baseline.pairs}; D280 boundary coefficient leaves this at ${d280.selected_policy.frontier_validation_correct}/${d280.selected_policy.frontier_validation_pairs}`,
      limitation: "Hard-negative alpha cannot be replayed independently here because D262 proxy already is the hard-negative baseline.",
    },
    {
      source_id: "d281_leave_one_clean_example_out",
      source_run_id: d281RunId,
      split_or_window: "qwen-clean-slice-internal-loo",
      clean_or_eval_units: Number(d281.summary.clean_pairs),
      examples: Number(d281.summary.clean_examples),
      label_kind: "internal_stability_check",
      d280_margin_compatible: true,
      temporal_or_paper_separate: false,
      ambiguity_screened: true,
      result: `LOO-selected ${d281.summary.loo_selected_heldout_correct}/${d281.summary.loo_selected_heldout_pairs}; frozen D280 ${d281.summary.frozen_d280_heldout_correct}/${d281.summary.frozen_d280_heldout_pairs}`,
      limitation: "Not an external heldout; one fold does not reselect the frozen D280 policy.",
    },
    {
      source_id: "temporal_321_389_candidate_selector",
      source_run_id: crossWindowRunId,
      split_or_window: "extended-future-holdout-321-389",
      clean_or_eval_units: Number(crossWindow.eval_split.examples),
      examples: Number(crossWindow.eval_split.examples),
      label_kind: "judged_answer_or_abstention_correctness",
      d280_margin_compatible: false,
      temporal_or_paper_separate: true,
      ambiguity_screened: false,
      result: `Cross-window selected rule overall ${crossWindow.selected_rule_metrics.eval.overall_judged_correct_rate}; answered ${temporalAnswered}/${crossPredictions.length}; supported answers ${temporalSupportedAnswers}; overall correct ${temporalCorrect}/${crossPredictions.length}`,
      limitation: "Large and temporally held out, but it is a direct/risk/guard scaffold selector, not a Qwen pairwise-margin candidate selector.",
    },
    {
      source_id: "final_qwen_diagnostic_clean_stratum",
      source_run_id: finalAmbiguityRunId,
      split_or_window: "qwen-final-diagnostic-clean-only",
      clean_or_eval_units: Number(finalAmbiguity.summary.clean_examples),
      examples: Number(finalAmbiguity.summary.clean_examples),
      label_kind: "final_diagnostic_selection_support",
      d280_margin_compatible: false,
      temporal_or_paper_separate: true,
      ambiguity_screened: true,
      result: "D262, boundary, and selected hybrid all 3/5 on clean final diagnostic.",
      limitation: "Final-window rows are diagnostic-only and too small for selector promotion.",
    },
  ];
}

function diagnose(rows, largeCompatibleRows, largeIncompatibleRows) {
  return {
    primary_finding: largeCompatibleRows.length ? "margin_compatible_heldout_available" : "margin_compatible_heldout_gap",
    margin_compatible_sources: rows.filter((row) => row.d280_margin_compatible === true).map((row) => row.source_id),
    large_temporal_noncompatible_sources: largeIncompatibleRows.map((row) => row.source_id),
    interpretation: largeCompatibleRows.length
      ? "A large D280-compatible heldout exists and should be used before any promotion decision."
      : "The repository has a larger temporal heldout for scaffold-level claims, but no large clean D280-compatible pairwise-margin heldout; using the 321-389 temporal selector as D280 validation would conflate different tasks.",
  };
}

function maxNumber(values) {
  return Math.max(0, ...values.map(Number).filter(Number.isFinite));
}

function renderReport(result, rows) {
  return `# Heldout Coverage Gap Audit

Generated: ${result.generated_at}

This is a zero-call heldout inventory audit. It checks whether existing artifacts can validate the D280/D281 tempered hard-negative selector without new labels or compute.

## Summary

- Sources inventoried: ${result.summary.sources_inventoried}
- D280 margin-compatible sources: ${result.summary.d280_margin_compatible_sources}
- Large D280 margin-compatible sources: ${result.summary.large_d280_margin_compatible_sources}
- Large temporal scaffold sources not margin-compatible: ${result.summary.large_temporal_scaffold_sources_not_margin_compatible}
- Largest margin-compatible units: ${result.summary.largest_margin_compatible_units}
- Largest temporal incompatible units: ${result.summary.largest_temporal_incompatible_units}

## Inventory

${rows.map((row) => `- ${row.source_id}: units ${row.clean_or_eval_units}, margin-compatible ${row.d280_margin_compatible}, temporal/paper-separate ${row.temporal_or_paper_separate}; ${row.limitation}`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote D280/D281 selector now: ${result.decision.promote_d280_or_d281_selector_now ? "yes" : "no"}
- Treat 321-389 as D280 validation: ${result.decision.treat_321_389_as_d280_validation ? "yes" : "no"}
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

function rel(file) {
  return path.relative(rootDir, file);
}
