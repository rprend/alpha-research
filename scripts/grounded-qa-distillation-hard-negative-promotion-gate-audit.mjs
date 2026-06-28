import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "hard-negative-promotion-gate-audit-qwen-frontier-pool-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const hardRunId = "hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1";
const cleanRunId = "clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1";
const finalAmbiguityRunId = "final-ambiguity-stratification-audit-qwen-frontier-pool-2026-06-28-v1";
const frontierReplayRunId = "frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1";
const constrainedRunId = "constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1";
const budgetFile = path.join(experimentDir, "spend", "budget.json");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(budgetFile);
const hardResult = await readJson(path.join(runsDir, hardRunId, "result.json"));
const cleanResult = await readJson(path.join(runsDir, cleanRunId, "result.json"));
const frontierReplay = await readJson(path.join(runsDir, frontierReplayRunId, "result.json"));
const cleanRows = await readJsonl(path.join(runsDir, cleanRunId, "selector_pair_strata.jsonl"));
const finalAudits = await readJsonl(path.join(runsDir, finalAmbiguityRunId, "example_audits.jsonl"));

const cleanPairIds = new Set(cleanRows.filter((row) => row.stratum === "clean_eval").map((row) => row.pair_id));
const cleanExampleIds = new Set(cleanResult.summary.clean_eval_example_ids);
const finalCleanExampleIds = new Set(finalAudits.filter((row) => row.ambiguity_risk?.is_ambiguity_risk === false).map((row) => row.example_id));
const policies = [
  {
    selector: "hard_negative_baseline",
    pairFile: "baseline_existing_validation_predictions.jsonl",
    frontierKey: "baseline_pairwise_selector",
    finalFile: "baseline_final_diagnostic_selections.jsonl",
  },
  {
    selector: "hard_negative_weighted",
    pairFile: "hard_weighted_existing_validation_predictions.jsonl",
    frontierKey: "hard_negative_weighted_selector",
    finalFile: "hard_weighted_final_diagnostic_selections.jsonl",
  },
  {
    selector: "hard_negative_risk_penalized",
    pairFile: "risk_penalized_existing_validation_predictions.jsonl",
    frontierKey: "train_tuned_risk_penalized_selector",
    finalFile: "risk_penalized_final_diagnostic_selections.jsonl",
  },
];

const pairRows = [];
const selectorSummaries = {};
for (const policy of policies) {
  const rows = await readJsonl(path.join(runsDir, hardRunId, policy.pairFile));
  const cleanPolicyRows = rows.filter((row) => cleanPairIds.has(row.pair_id));
  const existingSummary = summarizeRows(rows);
  const cleanSummary = summarizeRows(cleanPolicyRows);
  selectorSummaries[policy.selector] = {
    frontier_validation: summaryFromHardResult(hardResult, policy.frontierKey),
    existing_validation: existingSummary,
    clean_validation: cleanSummary,
  };
  for (const row of cleanPolicyRows) {
    pairRows.push({
      pair_id: row.pair_id,
      example_id: row.example_id,
      selector: policy.selector,
      stratum: "clean_eval",
      predicted_preferred: row.predicted_preferred,
      correct: row.correct === true,
      margin: round(row.margin ?? 0),
      hard_negative_tags: row.hard_negative_tags ?? [],
      training_use: row.training_use,
    });
  }
}

const baselineRows = await readJsonl(path.join(runsDir, constrainedRunId, "existing_validation_pair_predictions.jsonl"));
const constrainedRows = await readJsonl(path.join(runsDir, constrainedRunId, "constrained_existing_validation_pair_predictions.jsonl"));
const baselineCleanRows = baselineRows.filter((row) => cleanPairIds.has(row.pair_id));
const constrainedCleanRows = constrainedRows.filter((row) => cleanPairIds.has(row.pair_id));
const baselineComparison = {
  d262_pool_pairwise_existing: cleanResult.selector_summary.d262_pool_pairwise,
  d262_constrained_existing: cleanResult.selector_summary.d262_constrained,
  d262_pool_pairwise_clean: cleanResult.strata_summary["clean_eval:d262_pool_pairwise"],
  d262_constrained_clean: cleanResult.strata_summary["clean_eval:d262_constrained"],
  d262_pool_pairwise_clean_recomputed: summarizeRows(baselineCleanRows),
  d262_constrained_clean_recomputed: summarizeRows(constrainedCleanRows),
  d278_d262_proxy_frontier: frontierReplay.selector_summary.d262_proxy_hard_negative_baseline,
};

const finalDiagnosticRows = [];
for (const policy of policies) {
  const rows = await readJsonl(path.join(runsDir, hardRunId, policy.finalFile));
  const cleanFinalRows = rows.filter((row) => finalCleanExampleIds.has(row.example_id));
  finalDiagnosticRows.push({
    selector: policy.selector,
    stratum: "final_clean_diagnostic_only",
    examples: cleanFinalRows.length,
    selected_supported: cleanFinalRows.filter((row) => row.selected_supported_answer === true).length,
    selected_supported_rate: round(cleanFinalRows.filter((row) => row.selected_supported_answer === true).length / Math.max(1, cleanFinalRows.length)),
    training_use: "forbidden_final_diagnostic_only",
  });
}

const d262FinalRows = await readJsonl(path.join(runsDir, constrainedRunId, "constrained_final_diagnostic_selections.jsonl"));
const d262CleanFinalRows = d262FinalRows.filter((row) => finalCleanExampleIds.has(row.example_id));
finalDiagnosticRows.push({
  selector: "d262_constrained",
  stratum: "final_clean_diagnostic_only",
  examples: d262CleanFinalRows.length,
  selected_supported: d262CleanFinalRows.filter((row) => row.selected_supported_answer === true).length,
  selected_supported_rate: round(d262CleanFinalRows.filter((row) => row.selected_supported_answer === true).length / Math.max(1, d262CleanFinalRows.length)),
  training_use: "forbidden_final_diagnostic_only",
});

const diagnosis = diagnose(selectorSummaries, baselineComparison);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "hard_negative_promotion_gate_audit",
  purpose: "Gate hard-negative selector promotion against same-row frontier evidence, clean non-final validation, and final-window ambiguity diagnostics without spending more budget.",
  source_runs: {
    hard_negative_selector: hardRunId,
    clean_validation_slice: cleanRunId,
    final_ambiguity_stratification: finalAmbiguityRunId,
    frontier_replay: frontierReplayRunId,
    d262_constrained_selector: constrainedRunId,
  },
  summary: {
    hard_negative_policies: policies.length,
    clean_eval_examples: cleanExampleIds.size,
    clean_eval_pairs: cleanPairIds.size,
    frontier_validation_pairs: frontierReplay.summary.frontier_validation_pairs,
    final_clean_diagnostic_examples: finalCleanExampleIds.size,
  },
  selector_summary: selectorSummaries,
  baseline_comparison: baselineComparison,
  final_clean_diagnostic_summary: Object.fromEntries(finalDiagnosticRows.map((row) => [row.selector, row])),
  diagnosis,
  decision: {
    promote_hard_negative_selector_now: false,
    promote_d262_proxy_as_active_selector_now: false,
    buy_more_openai_labels_now: false,
    launch_gpu_now: false,
    use_final_clean_rows_for_training_or_tuning: false,
    next_step: "Construct a comparable-coverage hard-negative-aware hybrid only if it beats the D262 pool-pairwise clean slice and the 19/21 frontier proxy without using final-window labels.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_tuning: false,
    final_window_labels_used_for_evaluation: false,
    final_window_rows_reported_as_diagnostic_only: true,
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
    note: "This promotion gate reads existing selector predictions and diagnostics only.",
  },
  artifacts: {
    clean_pair_rows_jsonl: rel(path.join(outputDir, "clean_pair_rows.jsonl")),
    final_clean_diagnostic_jsonl: rel(path.join(outputDir, "final_clean_diagnostic.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "clean_pair_rows.jsonl"), pairRows);
await writeJsonl(path.join(outputDir, "final_clean_diagnostic.jsonl"), finalDiagnosticRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  summary: result.summary,
  selector_summary: result.selector_summary,
  diagnosis: result.diagnosis,
  decision: result.decision,
}, null, 2));

function summaryFromHardResult(result, key) {
  const metrics = result.policies?.[key];
  const nonfinal = metrics?.nonfinal_validation_pairwise;
  return {
    pairs: Number(nonfinal?.pairs ?? 0),
    correct: Number(nonfinal?.correct ?? 0),
    accuracy: round(nonfinal?.accuracy ?? 0),
  };
}

function summarizeRows(rows) {
  const correct = rows.filter((row) => row.correct === true).length;
  return {
    pairs: rows.length,
    correct,
    accuracy: round(correct / Math.max(1, rows.length)),
    mean_abs_margin: round(mean(rows.map((row) => Math.abs(Number(row.margin ?? 0))))),
  };
}

function diagnose(selectorSummary, baselineComparison) {
  const hardBaseline = selectorSummary.hard_negative_baseline;
  const d262Clean = baselineComparison.d262_pool_pairwise_clean;
  const d262Frontier = baselineComparison.d278_d262_proxy_frontier;
  const cleanDelta = Number(hardBaseline.clean_validation.correct) - Number(d262Clean.correct);
  const frontierDelta = Number(hardBaseline.frontier_validation.correct) - Number(d262Frontier.correct);
  return {
    primary_finding: cleanDelta > 0 && frontierDelta > 0 ? "hard_negative_selector_ready_for_candidate_promotion" : "hard_negative_signal_not_sufficient_for_promotion",
    hard_negative_clean_correct: hardBaseline.clean_validation.correct,
    d262_pool_pairwise_clean_correct: d262Clean.correct,
    hard_negative_clean_delta_vs_d262_pool_pairwise: cleanDelta,
    hard_negative_frontier_correct: hardBaseline.frontier_validation.correct,
    d262_proxy_frontier_correct: d262Frontier.correct,
    hard_negative_frontier_delta_vs_d262_proxy: frontierDelta,
    interpretation: cleanDelta > 0 && frontierDelta > 0
      ? "The hard-negative baseline beats the D262 clean slice and frontier proxy, but still needs a larger clean holdout before active deployment."
      : "The hard-negative baseline is useful frontier supervision, but it does not beat the D262 pool-pairwise clean slice or frontier proxy strongly enough to justify promotion.",
  };
}

function renderReport(result) {
  return `# Hard-Negative Promotion Gate Audit

Generated: ${result.generated_at}

This is a zero-call promotion gate. It uses existing selector outputs only, reports final-window rows as forbidden diagnostics, and makes no OpenAI or GPU calls.

## Summary

- Clean non-final validation examples: ${result.summary.clean_eval_examples}
- Clean non-final validation pairs: ${result.summary.clean_eval_pairs}
- Frontier validation pairs: ${result.summary.frontier_validation_pairs}
- Final clean diagnostic examples: ${result.summary.final_clean_diagnostic_examples}

## Hard-Negative Selectors

${Object.entries(result.selector_summary).map(([selector, value]) => `- ${selector}: frontier ${value.frontier_validation.correct}/${value.frontier_validation.pairs}; existing ${value.existing_validation.correct}/${value.existing_validation.pairs}; clean ${value.clean_validation.correct}/${value.clean_validation.pairs}`).join("\n")}

## Baselines

- D262 pool-pairwise clean: ${result.baseline_comparison.d262_pool_pairwise_clean.correct}/${result.baseline_comparison.d262_pool_pairwise_clean.pairs}
- D262 constrained clean: ${result.baseline_comparison.d262_constrained_clean.correct}/${result.baseline_comparison.d262_constrained_clean.pairs}
- D278 D262 proxy frontier: ${result.baseline_comparison.d278_d262_proxy_frontier.correct}/${result.baseline_comparison.d278_d262_proxy_frontier.pairs}

## Final Diagnostics

${Object.entries(result.final_clean_diagnostic_summary).map(([selector, value]) => `- ${selector}: ${value.selected_supported}/${value.examples} final-clean diagnostic supported selections`).join("\n")}

## Diagnosis

- Primary finding: ${result.diagnosis.primary_finding}
- Interpretation: ${result.diagnosis.interpretation}

## Decision

- Promote hard-negative selector now: ${result.decision.promote_hard_negative_selector_now ? "yes" : "no"}
- Promote D262 proxy as active selector now: ${result.decision.promote_d262_proxy_as_active_selector_now ? "yes" : "no"}
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

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function round(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function rel(file) {
  return path.relative(rootDir, file);
}
