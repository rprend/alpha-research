import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "amortization-break-even-qwen3b-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const ledger = await readJsonl(path.join(experimentDir, "llm-calls", "ledger.jsonl"));
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const launchPlan = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const remotePlan = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2");
const judgePlan = await readResult("joint-action-judge-plan-joint-action-qwen3b-smoke-eval-v1");
const remoteBackendGate = await readResult("remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1");
const qwenIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");

const currentActualSpend = Number(budget.spend_usd.total_actual);
const plannedGpuEstimate = Number(launchPlan.estimated_cost_usd ?? remotePlan.budget_context?.planned_gpu_estimate_usd ?? 0);
const plannedJudgeEstimate = Number(judgePlan.budget_gate?.estimated_judge_cost_usd ?? remotePlan.budget_context?.planned_judge_estimate_usd ?? 0);
const plannedOfflineInvestment = plannedGpuEstimate + plannedJudgeEstimate;
const estimatedTotalAfterQwen = currentActualSpend + plannedOfflineInvestment;

const baselineRuns = [
  {
    id: "direct_mini_student_generation",
    source_run_id: "openai-student-temporal-test-full-v1",
    role: "single_call_api_student",
    online_openai_calls_per_query: 1,
    note: "Generation-only direct mini student baseline from the call ledger.",
  },
  {
    id: "direct_gpt4o_teacher_generation",
    source_run_id: "openai-teacher-temporal-test-full-v1",
    role: "single_call_large_teacher",
    online_openai_calls_per_query: 1,
    note: "Generation-only larger teacher baseline from the call ledger.",
  },
  {
    id: "multistep_teacher_recall_repair_generation",
    source_run_id: "openai-multistep-teacher-recall-repair-temporal-test-80-132-v1",
    role: "expensive_multistep_teacher",
    online_openai_calls_per_query: 2,
    note: "Two-step teacher plus repair slice with explicit run_cost_usd and call-level ledger rows.",
  },
  {
    id: "mini_verifier_combined_gate",
    source_run_id: pareto.systems.find((row) => row.id === "mini_verifier_combined_gate")?.source_run_id,
    role: "per_query_verifier_scaffold",
    online_openai_calls_per_query: 2,
    note: "Current best judged-correctness scaffold, but it retains a per-query mini verifier.",
  },
].map((row) => baselineCostRow(row, ledger));

const sensitivityCosts = [0.0001, 0.00025, 0.001, 0.005, 0.01, 0.05].map((cost) => ({
  assumed_api_cost_per_query_usd: cost,
  break_even_queries_for_planned_offline_investment: ceilDiv(plannedOfflineInvestment, cost),
  break_even_queries_for_total_project_spend_after_qwen: ceilDiv(estimatedTotalAfterQwen, cost),
}));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "amortization_break_even",
  status: "amortization_accounting_ready_not_quality_evidence",
  purpose: "Make the economics of amortized grounded QA explicit: how many future queries a zero-call Qwen/scaffold would need to serve before the planned offline GPU+judge investment pays back against API baselines.",
  qwen3b_plan: {
    prediction_run_id: judgePlan.prediction_run_id,
    base_model: launchPlan.base_model,
    packet_run_id: launchPlan.packet_run_id,
    current_result_integration_status: qwenIntegration.status,
    remote_backend_status: remoteBackendGate.status,
    planned_gpu_estimate_usd: plannedGpuEstimate,
    planned_judge_estimate_usd: plannedJudgeEstimate,
    planned_offline_investment_usd: plannedOfflineInvestment,
    current_actual_project_spend_usd: currentActualSpend,
    estimated_total_after_qwen_smoke_and_judge_usd: estimatedTotalAfterQwen,
    within_100_usd_budget: estimatedTotalAfterQwen <= Number(budget.max_budget_usd),
  },
  historical_api_baselines: baselineRuns,
  break_even_against_historical_baselines: baselineRuns
    .filter((row) => Number(row.observed_cost_per_query_usd) > 0)
    .map((row) => ({
      baseline_id: row.id,
      source_run_id: row.source_run_id,
      baseline_cost_per_query_usd: row.observed_cost_per_query_usd,
      qwen_online_openai_calls_per_query: 0,
      baseline_online_openai_calls_per_query: row.online_openai_calls_per_query,
      break_even_queries_for_planned_offline_investment: ceilDiv(plannedOfflineInvestment, row.observed_cost_per_query_usd),
      break_even_queries_for_total_project_spend_after_qwen: ceilDiv(estimatedTotalAfterQwen, row.observed_cost_per_query_usd),
      interpretation: row.interpretation,
    })),
  break_even_sensitivity: sensitivityCosts,
  cost_coverage_context: pareto.systems.map((row) => ({
    id: row.id,
    answer_rate: row.answer_rate,
    answer_support_rate: row.answer_support_rate,
    overall_judged_correct_rate: row.overall_judged_correct_rate,
    online_openai_calls_per_query: row.online_openai_calls_per_query,
    cost_class: row.cost_class,
  })),
  claim_boundaries: [
    "This artifact is cost accounting only; it does not prove that Qwen 3B preserves citation-grounded correctness.",
    "The current zero-call local/tiny-model rows are cheap but not quality substitutes, so economics must be conditioned on passing the Qwen support/coverage gate.",
    "If Qwen 3B fails the paid grounded-correctness judge, report the negative result and do not claim amortized success.",
    "The planned GPU and judge estimates are preflight estimates; actual Prime/HF cost must be recorded by the smoke ledger finalizer after the run.",
  ],
  required_next_evidence: [
    "Repair Prime or HF auth/permissions without exceeding the $100 total budget.",
    "Run the bounded Qwen 3B smoke and record actual external compute cost.",
    "Run dry then paid grounded-correctness judge over the 69-example final window.",
    "Add the trained Qwen row to the cost/coverage/support Pareto table and recompute break-even with actual spend.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This artifact reads local ledgers and run results only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function baselineCostRow(row, ledgerRows) {
  const matching = ledgerRows.filter((entry) => entry.run_id === row.source_run_id);
  const calls = matching.length;
  const cost = matching.reduce((total, entry) => total + Number(entry.cost_usd ?? 0), 0);
  const examples = uniqueExampleCount(matching);
  const observedCostPerQuery = examples > 0 ? cost / examples : null;
  return {
    ...row,
    ledger_calls: calls,
    ledger_examples: examples,
    ledger_cost_usd: cost,
    observed_cost_per_query_usd: observedCostPerQuery,
    interpretation: observedCostPerQuery == null
      ? "No call-level ledger rows were found; use sensitivity rows instead of exact break-even."
      : `At the observed ledger cost, planned Qwen GPU+judge spend breaks even after about ${ceilDiv(plannedOfflineInvestment, observedCostPerQuery)} future queries if the trained zero-call system meets quality gates.`,
  };
}

function uniqueExampleCount(rows) {
  const baseIds = new Set();
  for (const row of rows) {
    const id = String(row.example_id ?? "");
    if (!id) continue;
    baseIds.add(id.replace(/:counterfactual-insufficient$/, ""));
  }
  return baseIds.size;
}

function ceilDiv(total, unit) {
  if (!Number.isFinite(Number(total)) || !Number.isFinite(Number(unit)) || Number(unit) <= 0) return null;
  return Math.ceil(Number(total) / Number(unit));
}

function renderReport(result) {
  return `# Qwen 3B Amortization Break-Even

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Planned Offline Investment

- Current actual tracked spend: $${result.qwen3b_plan.current_actual_project_spend_usd.toFixed(6)}
- Planned GPU estimate: $${result.qwen3b_plan.planned_gpu_estimate_usd.toFixed(6)}
- Planned judge estimate: $${result.qwen3b_plan.planned_judge_estimate_usd.toFixed(6)}
- Planned offline investment: $${result.qwen3b_plan.planned_offline_investment_usd.toFixed(6)}
- Estimated total after Qwen smoke and judge: $${result.qwen3b_plan.estimated_total_after_qwen_smoke_and_judge_usd.toFixed(6)}
- Within $100 budget: ${result.qwen3b_plan.within_100_usd_budget ? "yes" : "no"}

## Break-Even Against Historical API Baselines

| Baseline | Ledger cost/query | Calls/query | Break-even planned offline queries | Break-even total project queries |
| --- | ---: | ---: | ---: | ---: |
${result.break_even_against_historical_baselines.map((row) => `| ${row.baseline_id} | $${row.baseline_cost_per_query_usd.toFixed(6)} | ${row.baseline_online_openai_calls_per_query} | ${row.break_even_queries_for_planned_offline_investment} | ${row.break_even_queries_for_total_project_spend_after_qwen} |`).join("\n")}

## Sensitivity

| Assumed API cost/query | Break-even planned offline queries | Break-even total project queries |
| ---: | ---: | ---: |
${result.break_even_sensitivity.map((row) => `| $${row.assumed_api_cost_per_query_usd.toFixed(5)} | ${row.break_even_queries_for_planned_offline_investment} | ${row.break_even_queries_for_total_project_spend_after_qwen} |`).join("\n")}

## Claim Boundaries

${result.claim_boundaries.map((item) => `- ${item}`).join("\n")}

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
