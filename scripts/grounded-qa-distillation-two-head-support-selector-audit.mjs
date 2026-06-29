import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "two-head-support-selector-audit-frontier-repaired-v1";
const augmentedRouterRunId = args["augmented-router-run-id"] ?? "augmented-constructor-router-audit-frontier-repaired-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const augmented = await readJson(path.join(runsDir, augmentedRouterRunId, "result.json"));
const trainRows = await readJsonl(path.join(runsDir, augmentedRouterRunId, "train_tune_candidate_rows.jsonl"));
const validationRows = await readJsonl(path.join(runsDir, augmentedRouterRunId, "validation_candidate_rows.jsonl"));

const models = {
  contract: trainLogistic(trainRows, "label_contract_correct"),
  answer_type: trainLogistic(trainRows, "label_answer_type_correct"),
  citation_exact: trainLogistic(trainRows, "label_citation_set_exact"),
};
const selectors = [
  { id: "contract_single_head", score: (row) => predict(models.contract, row) },
  { id: "two_head_product", score: (row) => predict(models.answer_type, row) * predict(models.citation_exact, row) },
  { id: "two_head_min_support", score: (row) => Math.min(predict(models.answer_type, row), predict(models.citation_exact, row)) },
  { id: "two_head_average", score: (row) => (predict(models.answer_type, row) + predict(models.citation_exact, row)) / 2 },
];

const selectorResults = selectors.map((selector) => ({
  selector_id: selector.id,
  train_tune: summarizeSelections(selectRows(trainRows, selector)),
  repaired_validation_gate: summarizeSelections(selectRows(validationRows, selector)),
  selected_system_counts: {
    train_tune: countBy(selectRows(trainRows, selector).map((row) => row.selected_system_id)),
    repaired_validation_gate: countBy(selectRows(validationRows, selector).map((row) => row.selected_system_id)),
  },
}));
const selectedSelectorId = "two_head_min_support";
const selectedSelector = selectors.find((selector) => selector.id === selectedSelectorId);
const selectedTrainRows = selectRows(trainRows, selectedSelector);
const selectedValidationRows = selectRows(validationRows, selectedSelector);
const selectedMetrics = selectorResults.find((row) => row.selector_id === selectedSelectorId);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "two_head_support_selector_audit",
  status: statusFor(selectedMetrics),
  purpose: "Test whether separately modeling answer-type correctness and citation-set exactness improves candidate selection over a single contract-correct router.",
  source_runs: {
    augmented_router: augmentedRouterRunId,
  },
  leakage_note: "Heads are trained on train-tune candidate rows only. The conservative min-support combiner is reported as a diagnostic support selector; no validation labels are used for model fitting.",
  models: {
    feature_count: trainRows[0]?.feature_values?.length ?? 0,
    heads: Object.fromEntries(Object.entries(models).map(([key, model]) => [key, { label: model.label, weights: model.weights, intercept: model.intercept }])),
  },
  selector_results: selectorResults,
  selected_selector_id: selectedSelectorId,
  metrics: {
    train_tune: selectedMetrics.train_tune,
    repaired_validation_gate: selectedMetrics.repaired_validation_gate,
  },
  baseline_comparison: {
    prior_three_system_router_contract_correct: 47,
    augmented_router_contract_correct: Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    selected_two_head_contract_correct: selectedMetrics.repaired_validation_gate.contract_correct,
    augmented_pool_oracle_contract_correct: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0),
    selected_delta_vs_augmented_router: selectedMetrics.repaired_validation_gate.contract_correct - Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0),
    selected_delta_vs_prior_router: selectedMetrics.repaired_validation_gate.contract_correct - 47,
    remaining_gap_to_augmented_oracle: Number(augmented.oracle?.repaired_validation_gate?.contract_correct ?? 0) - selectedMetrics.repaired_validation_gate.contract_correct,
  },
  decision: decisionFor(selectedMetrics, augmented),
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
    note: "This audit trains local logistic heads over existing candidate features only.",
  },
  artifacts: {
    selector_results_jsonl: rel(path.join(outputDir, "selector_results.jsonl")),
    train_tune_selected_rows_jsonl: rel(path.join(outputDir, "train_tune_selected_rows.jsonl")),
    validation_selected_rows_jsonl: rel(path.join(outputDir, "validation_selected_rows.jsonl")),
    report_md: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "selector_results.jsonl"), selectorResults);
await writeJsonl(path.join(outputDir, "train_tune_selected_rows.jsonl"), selectedTrainRows);
await writeJsonl(path.join(outputDir, "validation_selected_rows.jsonl"), selectedValidationRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selected_selector_id: result.selected_selector_id,
  selector_results: result.selector_results,
  baseline_comparison: result.baseline_comparison,
  decision: result.decision,
  llm_budget: result.llm_budget,
}, null, 2));

function selectRows(rows, selector) {
  return [...groupBy(rows, (row) => row.example_id).entries()].map(([exampleId, candidates]) => {
    const selected = [...candidates]
      .map((candidate) => ({ ...candidate, selector_score: selector.score(candidate) }))
      .sort((left, right) => right.selector_score - left.selector_score || left.system_id.localeCompare(right.system_id))[0];
    return {
      example_id: exampleId,
      selected_system_id: selected.system_id,
      selector_score: selected.selector_score,
      selected_contract_correct: Boolean(selected.label_contract_correct),
      selected_answer_type_correct: Boolean(selected.label_answer_type_correct),
      selected_citation_set_exact: Boolean(selected.label_citation_set_exact),
    };
  });
}

function summarizeSelections(rows) {
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

function trainLogistic(rows, label) {
  const scaler = makeScaler(rows.map((row) => row.feature_values));
  const dim = rows[0]?.feature_values?.length ?? 0;
  const weights = Array(dim).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < 1600; epoch += 1) {
    const grad = Array(dim).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const x = scale(row.feature_values, scaler);
      const y = Number(row[label] ?? 0);
      const prediction = sigmoid(dot(weights, x) + intercept);
      const error = prediction - y;
      biasGrad += error;
      for (let i = 0; i < dim; i += 1) grad[i] += error * x[i];
    }
    const n = Math.max(1, rows.length);
    intercept -= 0.06 * (biasGrad / n);
    for (let i = 0; i < dim; i += 1) weights[i] -= 0.06 * ((grad[i] / n) + 0.01 * weights[i]);
  }
  return { label, weights, intercept, scaler };
}

function predict(model, row) {
  return sigmoid(dot(model.weights, scale(row.feature_values, model.scaler)) + model.intercept);
}

function makeScaler(rows) {
  const dim = rows[0]?.length ?? 0;
  const means = Array(dim).fill(0);
  const scales = Array(dim).fill(1);
  for (const row of rows) for (let i = 0; i < dim; i += 1) means[i] += row[i] ?? 0;
  for (let i = 0; i < dim; i += 1) means[i] /= Math.max(1, rows.length);
  for (const row of rows) for (let i = 0; i < dim; i += 1) scales[i] += ((row[i] ?? 0) - means[i]) ** 2;
  for (let i = 0; i < dim; i += 1) scales[i] = Math.sqrt(scales[i] / Math.max(1, rows.length)) || 1;
  return { means, scales };
}

function scale(features, scaler) {
  return features.map((value, index) => (Number(value ?? 0) - scaler.means[index]) / scaler.scales[index]);
}

function statusFor(selectedMetrics) {
  if (selectedMetrics.repaired_validation_gate.contract_correct > 47) return "two_head_selector_beats_prior_router";
  if (selectedMetrics.repaired_validation_gate.contract_correct === 47) return "two_head_selector_ties_prior_router";
  return "two_head_selector_below_prior_router";
}

function decisionFor(selectedMetrics, augmented) {
  const selected = selectedMetrics.repaired_validation_gate.contract_correct;
  const augmentedCorrect = Number(augmented.metrics?.repaired_validation_gate?.contract_correct ?? 0);
  return {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    promote_two_head_selector: selected > 47,
    keep_as_diagnostic: true,
    reason: `The two-head min-support selector reaches ${selected}/70: ${selected - augmentedCorrect >= 0 ? "+" : ""}${selected - augmentedCorrect} versus the augmented router and ${selected - 47 >= 0 ? "+" : ""}${selected - 47} versus the prior router.`,
    next_step: selected > 47
      ? "Confirm the two-head selector on a fresh heldout surface before paid judging."
      : "Use the diagnostic to guide richer support supervision; do not spend on judging because it does not beat the prior router.",
  };
}

function renderReport(result) {
  return `# Two-Head Support Selector Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Selector | Validation contract correct |
| --- | ---: |
${result.selector_results.map((row) => `| ${row.selector_id} | ${row.repaired_validation_gate.contract_correct} / ${row.repaired_validation_gate.examples} |`).join("\n")}

## Baseline Comparison

- Prior three-system router: ${result.baseline_comparison.prior_three_system_router_contract_correct}/70
- Augmented router: ${result.baseline_comparison.augmented_router_contract_correct}/70
- Selected two-head selector: ${result.baseline_comparison.selected_two_head_contract_correct}/70
- Augmented oracle: ${result.baseline_comparison.augmented_pool_oracle_contract_correct}/70
- Remaining gap to augmented oracle: ${result.baseline_comparison.remaining_gap_to_augmented_oracle}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Promote two-head selector: ${result.decision.promote_two_head_selector ? "yes" : "no"}
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

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function dot(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * (right[i] ?? 0);
  return total;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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
