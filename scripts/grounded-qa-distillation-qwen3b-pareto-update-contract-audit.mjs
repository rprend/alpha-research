import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-pareto-update-contract-audit-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const integrationFixture = await readResult("qwen3b-integration-fixture-audit-2026-06-26-v1");
const outcomePolicy = await readResult("qwen3b-outcome-decision-policy-2026-06-27-v1");

const qwenRow = {
  id: "qwen3b_joint_action_smoke",
  family: "local_or_remote_qwen3b_joint_action_lora",
  source_run_id: "joint-action-qwen3b-smoke-eval-v1",
  judge_run_id: "openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1",
  examples: 69,
  answered: 50,
  answer_rate: 50 / 69,
  answer_support_rate: 0.7,
  abstention_support_rate: 1,
  overall_judged_correct_rate: 0.79,
  citation_recall: 0.68,
  answer_token_f1: 0.42,
  online_openai_calls_per_query: 0,
  marginal_scaffold_calls_per_query: 0,
  historical_judge_cost_usd: 0.467165,
  cost_class: "trained_small_model_or_adapter",
  interpretation: "Synthetic contract row shaped like qwen3b-result-integration.pareto_row_to_add; not a model result.",
};

const existingIds = new Set(pareto.systems.map((row) => row.id));
const updatedSystems = [...pareto.systems.map((row) => structuredClone(row)), qwenRow];
const updatedFrontier = frontier(updatedSystems).map((row) => row.id);
const originalFrontierStillKnown = pareto.pareto_frontier.every((id) => existingIds.has(id));
const existingRowsPreserved = pareto.systems.every((row) => {
  const copy = updatedSystems.find((candidate) => candidate.id === row.id);
  return JSON.stringify(copy) === JSON.stringify(row);
});
const qwenRowSchemaOk = [
  "id",
  "family",
  "source_run_id",
  "judge_run_id",
  "examples",
  "answered",
  "answer_rate",
  "answer_support_rate",
  "abstention_support_rate",
  "overall_judged_correct_rate",
  "citation_recall",
  "answer_token_f1",
  "online_openai_calls_per_query",
  "marginal_scaffold_calls_per_query",
  "historical_judge_cost_usd",
  "cost_class",
  "interpretation",
].every((key) => Object.hasOwn(qwenRow, key));
const noDuplicateIds = new Set(updatedSystems.map((row) => row.id)).size === updatedSystems.length;
const qwenIncluded = updatedSystems.some((row) => row.id === "qwen3b_joint_action_smoke");
const qwenComparable = qwenRow.answer_support_rate != null
  && qwenRow.overall_judged_correct_rate != null
  && Number.isFinite(Number(qwenRow.answer_rate))
  && Number.isFinite(Number(qwenRow.online_openai_calls_per_query));
const qwenFrontierDecisionExplicit = updatedFrontier.includes(qwenRow.id)
  ? "synthetic_qwen_row_on_frontier"
  : "synthetic_qwen_row_not_on_frontier";
const requiredPolicyStatuses = new Set(integrationFixture.verified_statuses ?? []);
const integrationStatusesCovered = [
  "qwen3b_negative_ready_for_pareto_update",
  "qwen3b_minimum_positive_ready_for_pareto_update",
  "qwen3b_strong_positive_ready_for_pareto_update",
].every((status) => requiredPolicyStatuses.has(status));

const passed = existingRowsPreserved
  && originalFrontierStillKnown
  && qwenRowSchemaOk
  && noDuplicateIds
  && qwenIncluded
  && qwenComparable
  && integrationStatusesCovered
  && outcomePolicy.status === "qwen3b_outcome_policy_preregistered";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_pareto_update_contract_audit",
  status: passed ? "qwen3b_pareto_update_contract_verified" : "qwen3b_pareto_update_contract_failed",
  purpose: "Pre-validate the required Pareto-table update contract before the real Qwen 3B judged row exists, so a future positive or negative result is inserted without mutating existing baseline rows or hiding frontier changes.",
  source_artifacts: {
    pareto_run_id: pareto.run_id,
    integration_fixture_audit_run_id: integrationFixture.run_id,
    outcome_decision_policy_run_id: outcomePolicy.run_id,
  },
  synthetic_qwen_row: qwenRow,
  contract_checks: {
    existing_rows_preserved: existingRowsPreserved,
    original_frontier_ids_known: originalFrontierStillKnown,
    qwen_row_schema_ok: qwenRowSchemaOk,
    no_duplicate_system_ids_after_insert: noDuplicateIds,
    qwen_row_included_after_insert: qwenIncluded,
    qwen_row_comparable_for_frontier: qwenComparable,
    qwen_frontier_decision_explicit: qwenFrontierDecisionExplicit,
    integration_statuses_covered: integrationStatusesCovered,
    outcome_policy_preregistered: outcomePolicy.status === "qwen3b_outcome_policy_preregistered",
  },
  table_delta: {
    original_system_count: pareto.systems.length,
    updated_system_count: updatedSystems.length,
    original_frontier: pareto.pareto_frontier,
    updated_frontier: updatedFrontier,
    added_system_id: qwenRow.id,
  },
  required_after_real_qwen_integration: [
    "Read qwen3b-result-integration.pareto_row_to_add only after predictions and paid judge exist.",
    "Append exactly one qwen3b_joint_action_smoke row to cost-coverage-support-pareto systems.",
    "Preserve all existing baseline/scaffold rows byte-for-byte unless a separate decision log entry justifies a broader table regeneration.",
    "Recompute pareto_frontier with answer rate, answer support, overall judged correctness, and online OpenAI calls/query.",
    "Regenerate amortization, final evidence, final claim, manuscript evidence map, manuscript draft, and reviewer-risk artifacts after the table update.",
  ],
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads local artifacts and uses a synthetic row only; it is not a model result.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  contract_checks: result.contract_checks,
}, null, 2));

function frontier(systems) {
  const comparable = systems.filter((row) => row.overall_judged_correct_rate != null && row.answer_support_rate != null);
  const rows = comparable.filter((candidate) => !comparable.some((other) => dominates(other, candidate)));
  rows.sort((a, b) => Number(b.overall_judged_correct_rate) - Number(a.overall_judged_correct_rate));
  return rows;
}

function dominates(a, b) {
  const aBetterOrEqual =
    Number(a.overall_judged_correct_rate) >= Number(b.overall_judged_correct_rate) &&
    Number(a.answer_support_rate) >= Number(b.answer_support_rate) &&
    Number(a.answer_rate) >= Number(b.answer_rate) &&
    Number(a.online_openai_calls_per_query) <= Number(b.online_openai_calls_per_query);
  const aStrict =
    Number(a.overall_judged_correct_rate) > Number(b.overall_judged_correct_rate) ||
    Number(a.answer_support_rate) > Number(b.answer_support_rate) ||
    Number(a.answer_rate) > Number(b.answer_rate) ||
    Number(a.online_openai_calls_per_query) < Number(b.online_openai_calls_per_query);
  return aBetterOrEqual && aStrict;
}

function renderReport(result) {
  return `# Qwen 3B Pareto Update Contract Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Check | Value |
| --- | --- |
| Existing rows preserved | ${result.contract_checks.existing_rows_preserved ? "yes" : "no"} |
| Qwen row schema ok | ${result.contract_checks.qwen_row_schema_ok ? "yes" : "no"} |
| No duplicate ids | ${result.contract_checks.no_duplicate_system_ids_after_insert ? "yes" : "no"} |
| Qwen comparable for frontier | ${result.contract_checks.qwen_row_comparable_for_frontier ? "yes" : "no"} |
| Qwen frontier decision | \`${result.contract_checks.qwen_frontier_decision_explicit}\` |

Original systems: ${result.table_delta.original_system_count}
Updated systems: ${result.table_delta.updated_system_count}

Original frontier: ${result.table_delta.original_frontier.map((id) => `\`${id}\``).join(", ")}

Updated frontier with synthetic Qwen row: ${result.table_delta.updated_frontier.map((id) => `\`${id}\``).join(", ")}

## Required After Real Qwen Integration

${result.required_after_real_qwen_integration.map((item) => `- ${item}`).join("\n")}

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and does not claim model quality.
`;
}

async function readResult(id) {
  return readJson(path.join(runsDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
