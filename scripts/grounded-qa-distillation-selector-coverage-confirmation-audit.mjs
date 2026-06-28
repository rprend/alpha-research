import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "selector-coverage-confirmation-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

const predictionSpecs = [
  {
    selector: "d262_pool_pairwise",
    family: "d262",
    slice: "existing_validation",
    file: "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1/existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "d262_constrained",
    family: "d262",
    slice: "existing_validation",
    file: "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1/constrained_existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "d272_boundary_only",
    family: "boundary",
    slice: "existing_validation",
    file: "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1/boundary_existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "d272_selected_hybrid",
    family: "boundary",
    slice: "existing_validation",
    file: "filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1/hybrid_existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "qwen_label_ranker",
    family: "qwen_label",
    slice: "existing_validation",
    file: "qwen-label-support-ranker-2026-06-28-v1/validation_pair_predictions.jsonl",
  },
  {
    selector: "qwen_contrast_verifier",
    family: "qwen_contrast",
    slice: "existing_validation",
    file: "qwen-contrast-verifier-frontier-pool-2026-06-28-v1/validation_pair_predictions.jsonl",
  },
  {
    selector: "claim_nli_support_verifier",
    family: "claim_nli",
    slice: "existing_validation",
    file: "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1/existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "hard_negative_baseline",
    family: "hard_negative",
    slice: "existing_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/baseline_existing_validation_predictions.jsonl",
  },
  {
    selector: "hard_negative_hard_weighted",
    family: "hard_negative",
    slice: "existing_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/hard_weighted_existing_validation_predictions.jsonl",
  },
  {
    selector: "hard_negative_risk_penalized",
    family: "hard_negative",
    slice: "existing_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/risk_penalized_existing_validation_predictions.jsonl",
  },
  {
    selector: "overexpansion_aware",
    family: "overexpansion",
    slice: "existing_validation",
    file: "overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1/existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "calibrated_overexpansion_hybrid",
    family: "overexpansion",
    slice: "existing_validation",
    file: "calibrated-overexpansion-hybrid-qwen-frontier-pool-2026-06-28-v1/existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "conditional_overexpansion_gate",
    family: "overexpansion",
    slice: "existing_validation",
    file: "conditional-overexpansion-gate-qwen-frontier-pool-2026-06-28-v1/existing_validation_pair_predictions.jsonl",
  },
  {
    selector: "qwen_contrast_verifier",
    family: "qwen_contrast",
    slice: "frontier_pool_validation",
    file: "qwen-contrast-verifier-frontier-pool-2026-06-28-v1/frontier_pool_validation_contrast_predictions.jsonl",
  },
  {
    selector: "claim_nli_support_verifier",
    family: "claim_nli",
    slice: "frontier_pool_validation",
    file: "claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1/nonfinal_validation_pair_predictions.jsonl",
  },
  {
    selector: "hard_negative_baseline",
    family: "hard_negative",
    slice: "frontier_pool_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/baseline_nonfinal_validation_predictions.jsonl",
  },
  {
    selector: "hard_negative_hard_weighted",
    family: "hard_negative",
    slice: "frontier_pool_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/hard_weighted_nonfinal_validation_predictions.jsonl",
  },
  {
    selector: "hard_negative_risk_penalized",
    family: "hard_negative",
    slice: "frontier_pool_validation",
    file: "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1/risk_penalized_nonfinal_validation_predictions.jsonl",
  },
  {
    selector: "qwen_contrast_verifier",
    family: "qwen_contrast",
    slice: "qwen_reference_validation",
    file: "qwen-contrast-verifier-frontier-pool-2026-06-28-v1/qwen_validation_contrast_predictions.jsonl",
  },
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const cleanSliceResult = await readJson(path.join(runsDir, "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1", "result.json"));
const rows = [];
for (const spec of predictionSpecs) {
  const file = path.join(runsDir, spec.file);
  const predictions = await readJsonl(file);
  rows.push({
    selector: spec.selector,
    family: spec.family,
    slice: spec.slice,
    source_file: spec.file,
    ...summarizePredictions(predictions),
  });
}

const sliceSummary = summarizeBySlice(rows);
const familySummary = summarizeByFamily(rows);
const selectedHybridCoverage = rows.find((row) => row.selector === "d272_selected_hybrid" && row.slice === "existing_validation");
const frontierRows = rows.filter((row) => row.slice === "frontier_pool_validation");
const bestFrontier = [...frontierRows].sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)[0] ?? null;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "selector_coverage_confirmation_audit",
  purpose: "Confirm whether the D276 selected-hybrid signal is supported by broader zero-call held-out selector evidence, and map which selector families cover which non-final slices.",
  source_runs: {
    clean_validation_slice_audit: "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1",
  },
  summary: {
    selector_slice_rows: rows.length,
    slices: Object.keys(sliceSummary),
    selected_hybrid_broader_frontier_coverage_pairs: 0,
    frontier_pool_validation_selectors: frontierRows.length,
    best_frontier_selector: bestFrontier?.selector ?? null,
    best_frontier_accuracy: bestFrontier?.accuracy ?? null,
    d276_clean_selected_hybrid_tournament_rate: cleanSliceResult.tournament_summary?.["clean_eval:selected_hybrid"]?.selected_supported_rate ?? null,
  },
  slice_summary: sliceSummary,
  family_summary: familySummary,
  diagnosis: diagnose(rows, selectedHybridCoverage, bestFrontier),
  decision: {
    promote_selected_hybrid_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    run_zero_call_frontier_replay_next: true,
    reason: "D276's selected-hybrid gain has no direct frontier-pool validation coverage; broader frontier evidence supports claim/NLI/contrast features but not the exact D272 hybrid policy.",
    next_step: "Recompute D262, boundary-only, and selected-hybrid scores on frontier-pool validation pairs with existing local features, or mine a larger clean pairwise packet where all candidate selectors have comparable coverage.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: false,
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
    note: "This audit reads existing prediction artifacts only.",
  },
  artifacts: {
    selector_coverage_jsonl: rel(path.join(outputDir, "selector_coverage.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "selector_coverage.jsonl"), rows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result, rows);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function summarizePredictions(predictions) {
  const pairs = predictions.length;
  const correct = predictions.filter((row) => row.correct === true).length;
  const incorrect = predictions.filter((row) => row.correct === false).length;
  const margins = predictions.map((row) => Math.abs(Number(row.margin ?? 0))).filter(Number.isFinite);
  const exampleIds = new Set(predictions.map((row) => row.example_id).filter(Boolean));
  const sourceIndexes = predictions.map((row) => Number(row.source_index)).filter(Number.isFinite);
  return {
    pairs,
    examples: exampleIds.size || null,
    correct,
    incorrect,
    accuracy: round(correct / Math.max(1, pairs)),
    mean_abs_margin: round(mean(margins)),
    source_index_min: sourceIndexes.length ? Math.min(...sourceIndexes) : null,
    source_index_max: sourceIndexes.length ? Math.max(...sourceIndexes) : null,
    training_uses: [...new Set(predictions.map((row) => row.training_use).filter(Boolean))].sort(),
  };
}

function summarizeBySlice(rows) {
  return Object.fromEntries([...groupBy(rows, (row) => row.slice).entries()].map(([slice, sliceRows]) => [slice, {
    selector_rows: sliceRows.length,
    pair_counts: [...new Set(sliceRows.map((row) => row.pairs))].sort((a, b) => a - b),
    best_selector: [...sliceRows].sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)[0]?.selector ?? null,
    best_accuracy: [...sliceRows].sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)[0]?.accuracy ?? null,
    selectors: sliceRows.map((row) => row.selector),
  }]));
}

function summarizeByFamily(rows) {
  return Object.fromEntries([...groupBy(rows, (row) => row.family).entries()].map(([family, familyRows]) => [family, {
    slices: [...new Set(familyRows.map((row) => row.slice))].sort(),
    max_pairs: Math.max(...familyRows.map((row) => row.pairs)),
    best_accuracy: Math.max(...familyRows.map((row) => row.accuracy)),
  }]));
}

function diagnose(rows, selectedHybridCoverage, bestFrontier) {
  const selectedHybridSlices = rows.filter((row) => row.selector === "d272_selected_hybrid").map((row) => row.slice);
  const hasSelectedHybridFrontier = selectedHybridSlices.includes("frontier_pool_validation");
  return {
    primary_finding: hasSelectedHybridFrontier ? "selected_hybrid_has_broader_coverage" : "selected_hybrid_broader_coverage_missing",
    selected_hybrid_slices: selectedHybridSlices,
    selected_hybrid_existing_validation_accuracy: selectedHybridCoverage?.accuracy ?? null,
    best_frontier_selector: bestFrontier?.selector ?? null,
    best_frontier_accuracy: bestFrontier?.accuracy ?? null,
    interpretation: hasSelectedHybridFrontier
      ? "The selected hybrid has broader frontier validation coverage and can be compared directly."
      : "The D276 selected-hybrid gain is real on the clean validation slice but lacks direct frontier-pool validation coverage; broader frontier results support claim/NLI/contrast feature families, not the exact selected-hybrid policy.",
  };
}

function renderReport(result, rows) {
  return `# Selector Coverage Confirmation Audit

Generated: ${result.generated_at}

This is a zero-call held-out selector coverage audit. It uses no final-window labels for training, tuning, or evaluation.

## Summary

- Selector-slice rows: ${result.summary.selector_slice_rows}
- Slices: ${result.summary.slices.join(", ")}
- Selected-hybrid broader frontier coverage pairs: ${result.summary.selected_hybrid_broader_frontier_coverage_pairs}
- Best frontier selector: ${result.summary.best_frontier_selector ?? "none"} (${result.summary.best_frontier_accuracy ?? "n/a"})

## Coverage Rows

${rows.map((row) => `- ${row.slice} / ${row.selector}: ${row.correct}/${row.pairs} correct, accuracy ${row.accuracy}, uses=${row.training_uses.join(",") || "none"}`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote selected hybrid now: ${result.decision.promote_selected_hybrid_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Run zero-call frontier replay next: ${result.decision.run_zero_call_frontier_replay_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
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

function groupBy(rows, fn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = fn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
