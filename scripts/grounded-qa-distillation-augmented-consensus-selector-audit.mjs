import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "augmented-consensus-selector-audit-frontier-repaired-v1";
const augmentedRouterRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const augmented = await readJson(path.join(runsDir, augmentedRouterRunId, "result.json"));
const trainHeldout = await readJsonl(path.join(runsDir, augmentedRouterRunId, "train_heldout_selections.jsonl"));
const validation = await readJsonl(path.join(runsDir, augmentedRouterRunId, "validation_selections.jsonl"));

const answerOrders = [
  ["broad_sufficiency_constructor", "train_calibrated_scaffold", "train_selected_constrained_policy", "learned_repaired_selector"],
  ["train_calibrated_scaffold", "broad_sufficiency_constructor", "train_selected_constrained_policy", "learned_repaired_selector"],
  ["train_selected_constrained_policy", "broad_sufficiency_constructor", "train_calibrated_scaffold", "learned_repaired_selector"],
  ["learned_repaired_selector", "train_selected_constrained_policy", "train_calibrated_scaffold", "broad_sufficiency_constructor"],
];
const abstainOrder = ["learned_repaired_selector", "train_selected_constrained_policy", "train_calibrated_scaffold", "broad_sufficiency_constructor"];
const grid = [];
for (const minAnswers of [1, 2, 3]) {
  for (const minAbstains of [1, 2, 3]) {
    for (const minAnswerProbability of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) {
      for (const answerOrder of answerOrders) {
        const params = { min_answers: minAnswers, min_abstains: minAbstains, min_answer_probability: minAnswerProbability, answer_order: answerOrder, abstain_order: abstainOrder };
        grid.push({
          params,
          train_heldout: summarize(selectRows(trainHeldout, params)),
          validation: summarize(selectRows(validation, params)),
        });
      }
    }
  }
}
grid.sort((left, right) => (
  right.train_heldout.contract_correct - left.train_heldout.contract_correct
  || right.train_heldout.answer_type_correct - left.train_heldout.answer_type_correct
  || right.validation.contract_correct - left.validation.contract_correct
));
const selected = grid[0];
const trainRows = selectRows(trainHeldout, selected.params);
const validationRows = selectRows(validation, selected.params);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "augmented_consensus_selector_audit",
  status: statusFor(selected, augmented),
  purpose: "Test whether cross-candidate answer/abstention consensus can select the broad sufficiency constructor's new correct candidates without validation-label tuning.",
  source_runs: { augmented_router: augmentedRouterRunId },
  leakage_note: "Consensus parameters are selected by train-heldout performance only. Validation labels are report-only.",
  selected_consensus: selected,
  grid_size: grid.length,
  metrics: {
    train_heldout_consensus: selected.train_heldout,
    repaired_validation_consensus: selected.validation,
  },
  baseline_comparison: {
    prior_three_system_router_contract_correct: 47,
    augmented_router_contract_correct: Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    consensus_selector_contract_correct: selected.validation.contract_correct,
    augmented_pool_oracle_contract_correct: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0),
    consensus_delta_vs_augmented_router: selected.validation.contract_correct - Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    consensus_delta_vs_prior_router: selected.validation.contract_correct - 47,
    remaining_gap_to_augmented_oracle: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0) - selected.validation.contract_correct,
  },
  selected_system_counts: {
    train_heldout: countBy(trainRows.map((row) => row.selected_system_id)),
    repaired_validation_gate: countBy(validationRows.map((row) => row.selected_system_id)),
  },
  decision: decisionFor(selected, augmented),
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
    note: "This audit re-selects among existing local candidates only.",
  },
  artifacts: {
    grid_jsonl: rel(path.join(outputDir, "consensus_grid.jsonl")),
    train_heldout_rows_jsonl: rel(path.join(outputDir, "train_heldout_consensus_rows.jsonl")),
    validation_rows_jsonl: rel(path.join(outputDir, "validation_consensus_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "consensus_grid.jsonl"), grid);
await writeJsonl(path.join(outputDir, "train_heldout_consensus_rows.jsonl"), trainRows);
await writeJsonl(path.join(outputDir, "validation_consensus_rows.jsonl"), validationRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_consensus: result.selected_consensus,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function selectRows(rows, params) {
  return rows.map((row) => {
    const candidates = [...row.candidates].sort((left, right) => right.predicted_probability - left.predicted_probability);
    const answers = candidates.filter((candidate) => candidate.prediction_answer_type === "grounded_answer");
    const abstains = candidates.filter((candidate) => candidate.prediction_answer_type === "abstain");
    const answerBySystem = new Map(answers.map((candidate) => [candidate.system_id, candidate]));
    const abstainBySystem = new Map(abstains.map((candidate) => [candidate.system_id, candidate]));
    let selected = candidates[0];
    if (answers.length >= params.min_answers) {
      const preferred = params.answer_order.map((systemId) => answerBySystem.get(systemId)).find(Boolean);
      const bestAnswer = preferred ?? answers[0];
      if (bestAnswer.predicted_probability >= params.min_answer_probability) selected = bestAnswer;
    } else if (abstains.length >= params.min_abstains) {
      selected = params.abstain_order.map((systemId) => abstainBySystem.get(systemId)).find(Boolean) ?? selected;
    }
    return {
      example_id: row.example_id,
      split: row.split,
      target_answer_type: row.target_answer_type,
      selected_system_id: selected.system_id,
      selected_answer_type: selected.prediction_answer_type,
      selected_contract_correct: selected.contract_correct,
      selected_answer_type_correct: selected.answer_type_correct,
      selected_citation_set_exact: selected.citation_set_exact,
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
  };
}

function statusFor(selected, augmented) {
  const base = Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  if (selected.validation.contract_correct > base) return "consensus_selector_improves_augmented_router";
  if (selected.validation.contract_correct === base) return "consensus_selector_ties_augmented_router";
  return "consensus_selector_hurts_augmented_router";
}

function decisionFor(selected, augmented) {
  const base = Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_consensus_selector: selected.validation.contract_correct > base,
    reason: selected.validation.contract_correct > base
      ? `Train-heldout selected consensus improves validation from ${base}/70 to ${selected.validation.contract_correct}/70.`
      : `Train-heldout selected consensus does not beat the augmented router on validation (${selected.validation.contract_correct}/70 vs ${base}/70).`,
    next_step: "Do not spend on judging. The remaining path is richer support supervision or stronger candidate construction, not shallow consensus rules.",
  };
}

function renderReport(result) {
  return `# Augmented Consensus Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Prior three-system router | ${result.baseline_comparison.prior_three_system_router_contract_correct} / 70 | ${pct(result.baseline_comparison.prior_three_system_router_contract_correct / 70)} |
| Augmented router | ${result.baseline_comparison.augmented_router_contract_correct} / 70 | ${pct(result.baseline_comparison.augmented_router_contract_correct / 70)} |
| Consensus selector | ${result.baseline_comparison.consensus_selector_contract_correct} / 70 | ${pct(result.baseline_comparison.consensus_selector_contract_correct / 70)} |
| Augmented oracle | ${result.baseline_comparison.augmented_pool_oracle_contract_correct} / 70 | ${pct(result.baseline_comparison.augmented_pool_oracle_contract_correct / 70)} |

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote consensus selector: ${result.decision.promote_consensus_selector ? "yes" : "no"}
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
