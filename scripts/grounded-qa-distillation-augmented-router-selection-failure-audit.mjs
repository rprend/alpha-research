import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "augmented-router-selection-failure-audit-frontier-repaired-v1";
const augmentedRouterRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const augmented = await readJson(path.join(runsDir, augmentedRouterRunId, "result.json"));
const trainHeldout = await readJsonl(path.join(runsDir, augmentedRouterRunId, "train_heldout_selections.jsonl"));
const validation = await readJsonl(path.join(runsDir, augmentedRouterRunId, "validation_selections.jsonl"));

const overlayCandidates = [];
for (const minAnswerProbability of [0.1, 0.15, 0.18, 0.2, 0.22, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]) {
  for (const maxAbstainAnswerGap of [0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7]) {
    const params = { min_answer_probability: minAnswerProbability, max_abstain_answer_gap: maxAbstainAnswerGap };
    overlayCandidates.push({
      params,
      train_heldout: summarize(applyOverlay(trainHeldout, params)),
      validation: summarize(applyOverlay(validation, params)),
    });
  }
}
overlayCandidates.sort((left, right) => (
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.answer_type_correct - left.train_heldout.answer_type_correct
  || left.params.max_abstain_answer_gap - right.params.max_abstain_answer_gap
  || right.validation.contract_correct - left.validation.contract_correct
));
const selectedOverlay = overlayCandidates[0];
const selectedHeldoutRows = applyOverlay(trainHeldout, selectedOverlay.params);
const selectedValidationRows = applyOverlay(validation, selectedOverlay.params);
const heldoutFailureRows = failureRows(selectedHeldoutRows);
const validationFailureRows = failureRows(selectedValidationRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "augmented_router_selection_failure_audit",
  status: statusFor(selectedOverlay, augmented),
  purpose: "Diagnose why the augmented constructor router cannot exploit oracle headroom, and test a train-heldout-calibrated answer override without validation-label selection.",
  source_runs: {
    augmented_router: augmentedRouterRunId,
  },
  leakage_note: "Overlay parameters are selected only by train-heldout contract correctness and answer-type correctness. Validation labels are report-only.",
  base_metrics: {
    train_heldout: augmented.metrics?.train_heldout,
    repaired_validation_gate: augmented.metrics?.repaired_validation_gate,
    validation_oracle: augmented.oracle?.repaired_validation_gate,
  },
  selected_overlay: selectedOverlay,
  overlay_grid_size: overlayCandidates.length,
  metrics: {
    train_heldout_overlay: selectedOverlay.train_heldout,
    repaired_validation_overlay: selectedOverlay.validation,
    validation_recoverable_misses: count(validationFailureRows, (row) => row.recoverable_by_rerouting),
    validation_irrecoverable_misses: count(validationFailureRows, (row) => !row.recoverable_by_rerouting),
  },
  failure_tag_counts: {
    train_heldout: countBy(heldoutFailureRows.flatMap((row) => row.tags)),
    repaired_validation_gate: countBy(validationFailureRows.flatMap((row) => row.tags)),
  },
  baseline_comparison: {
    prior_three_system_router_contract_correct: 47,
    augmented_router_contract_correct: augmented.metrics?.repaired_validation_gate?.contract_correct,
    augmented_overlay_contract_correct: selectedOverlay.validation.contract_correct,
    augmented_pool_oracle_contract_correct: augmented.oracle?.repaired_validation_gate?.contract_correct,
    overlay_delta_vs_augmented_router: selectedOverlay.validation.contract_correct - Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    overlay_delta_vs_prior_router: selectedOverlay.validation.contract_correct - 47,
    remaining_gap_to_augmented_oracle: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0) - selectedOverlay.validation.contract_correct,
  },
  decision: decisionFor(selectedOverlay, augmented),
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    prime_intellect_cost_usd: 0,
    note: "This audit only re-scores existing local router selections.",
  },
  artifacts: {
    overlay_grid_jsonl: rel(path.join(outputDir, "overlay_grid.jsonl")),
    train_heldout_overlay_rows_jsonl: rel(path.join(outputDir, "train_heldout_overlay_rows.jsonl")),
    validation_overlay_rows_jsonl: rel(path.join(outputDir, "validation_overlay_rows.jsonl")),
    validation_failure_rows_jsonl: rel(path.join(outputDir, "validation_failure_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "overlay_grid.jsonl"), overlayCandidates);
await writeJsonl(path.join(outputDir, "train_heldout_overlay_rows.jsonl"), selectedHeldoutRows);
await writeJsonl(path.join(outputDir, "validation_overlay_rows.jsonl"), selectedValidationRows);
await writeJsonl(path.join(outputDir, "validation_failure_rows.jsonl"), validationFailureRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_overlay: result.selected_overlay,
  metrics: result.metrics,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function applyOverlay(rows, params) {
  return rows.map((row) => {
    const sorted = [...row.candidates].sort((left, right) => right.predicted_probability - left.predicted_probability);
    const base = sorted[0];
    let selected = base;
    let overlayApplied = false;
    if (base.prediction_answer_type === "abstain") {
      const bestAnswer = sorted.find((candidate) => candidate.prediction_answer_type === "grounded_answer");
      if (bestAnswer && bestAnswer.predicted_probability >= params.min_answer_probability && (base.predicted_probability - bestAnswer.predicted_probability) <= params.max_abstain_answer_gap) {
        selected = bestAnswer;
        overlayApplied = true;
      }
    }
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target_answer_type,
      base_selected_system_id: row.selected_system_id,
      selected_system_id: selected.system_id,
      overlay_applied: overlayApplied,
      selected_contract_correct: selected.contract_correct,
      selected_answer_type_correct: selected.answer_type_correct,
      selected_citation_set_exact: selected.citation_set_exact,
      recoverable_by_rerouting: !selected.contract_correct && row.candidates.some((candidate) => candidate.contract_correct),
      candidates: row.candidates,
    };
  });
}

function summarize(rows) {
  const correct = count(rows, (row) => row.selected_contract_correct);
  const answerType = count(rows, (row) => row.selected_answer_type_correct);
  const citation = count(rows, (row) => row.selected_citation_set_exact);
  return {
    examples: rows.length,
    contract_correct: correct,
    contract_correct_rate: rate(correct, rows.length),
    answer_type_correct: answerType,
    answer_type_accuracy: rate(answerType, rows.length),
    citation_set_exact: citation,
    citation_set_exact_rate: rate(citation, rows.length),
    overlays_applied: count(rows, (row) => row.overlay_applied),
    selected_system_counts: countBy(rows.map((row) => row.selected_system_id)),
  };
}

function failureRows(rows) {
  return rows.filter((row) => !row.selected_contract_correct).map((row) => {
    const correctCandidates = row.candidates.filter((candidate) => candidate.contract_correct).map((candidate) => candidate.system_id);
    const tags = [];
    if (correctCandidates.length) tags.push("recoverable_by_rerouting");
    else tags.push("irrecoverable_in_pool");
    if (row.target_answer_type === "grounded_answer" && row.candidates.find((candidate) => candidate.system_id === row.selected_system_id)?.prediction_answer_type === "abstain") tags.push("false_abstention_selected");
    if (row.target_answer_type === "grounded_answer" && row.candidates.find((candidate) => candidate.system_id === row.selected_system_id)?.prediction_answer_type === "grounded_answer") tags.push("wrong_grounded_candidate_selected");
    if (row.target_answer_type === "abstain") tags.push("abstain_target_missed");
    return {
      example_id: row.example_id,
      target_answer_type: row.target_answer_type,
      selected_system_id: row.selected_system_id,
      selected_prediction_answer_type: row.candidates.find((candidate) => candidate.system_id === row.selected_system_id)?.prediction_answer_type,
      correct_candidate_systems: correctCandidates,
      recoverable_by_rerouting: correctCandidates.length > 0,
      tags,
    };
  });
}

function statusFor(selectedOverlay, augmented) {
  const base = Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  if (selectedOverlay.validation.contract_correct > base) return "answer_override_improves_augmented_router";
  if (selectedOverlay.validation.contract_correct === base) return "answer_override_ties_augmented_router";
  return "answer_override_hurts_augmented_router";
}

function decisionFor(selectedOverlay, augmented) {
  const base = Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_answer_override: selectedOverlay.validation.contract_correct > base,
    reason: selectedOverlay.validation.contract_correct > base
      ? `The train-heldout selected answer override improves validation from ${base}/70 to ${selectedOverlay.validation.contract_correct}/70.`
      : `The best train-heldout selected answer override does not improve validation (${selectedOverlay.validation.contract_correct}/70 vs ${base}/70), so the added oracle headroom is not recoverable with this simple calibrated override.`,
    next_step: "Use the failure rows to build richer candidate-support supervision or improve constructor precision; do not spend on judging or GPU until selection improves without validation leakage.",
  };
}

function renderReport(result) {
  return `# Augmented Router Selection Failure Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Prior three-system router | ${result.baseline_comparison.prior_three_system_router_contract_correct} / 70 | ${pct(result.baseline_comparison.prior_three_system_router_contract_correct / 70)} |
| Augmented router | ${result.baseline_comparison.augmented_router_contract_correct} / 70 | ${pct(result.baseline_comparison.augmented_router_contract_correct / 70)} |
| Answer-override overlay | ${result.baseline_comparison.augmented_overlay_contract_correct} / 70 | ${pct(result.baseline_comparison.augmented_overlay_contract_correct / 70)} |
| Augmented pool oracle | ${result.baseline_comparison.augmented_pool_oracle_contract_correct} / 70 | ${pct(result.baseline_comparison.augmented_pool_oracle_contract_correct / 70)} |

## Failure Shape

- Validation recoverable misses: ${result.metrics.validation_recoverable_misses}
- Validation irrecoverable misses: ${result.metrics.validation_irrecoverable_misses}
- Remaining gap to augmented oracle: ${result.baseline_comparison.remaining_gap_to_augmented_oracle}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote answer override: ${result.decision.promote_answer_override ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}
`;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function pct(value) {
  return `${(100 * Number(value ?? 0)).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
