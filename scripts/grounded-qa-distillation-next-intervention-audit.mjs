import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const runId = args["run-id"] ?? "next-intervention-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const readiness = await readResult("current-readiness-audit-2026-06-28-v1");
const backend = await readResult("remote-backend-readiness-gate-current-2026-06-28-v2");
const listwiseIntegration = await readResult("listwise-selector-integration-final-window-2026-06-28-v1");
const constrainedListwise = await readResult("coverage-constrained-listwise-selector-audit-0-320-to-321-389-2026-06-28-v1");
const overclaimSmoke = await readResult("overclaim-citation-repair-qwen3b-smoke-outcome-2026-06-28-v1");
const qwen7bV14 = await readResult("v14-support-delta-outcome-audit-2026-06-28-v1");
const judgeReliability = await readResult("judge-reliability-claim-gate-2026-06-27-v1");

const blockers = readiness.summary?.blocking_failures ?? [];
const selectorEvidence = {
  listwise_status: listwiseIntegration.status,
  listwise_conservative_overall: listwiseIntegration.selection_metrics?.listwise_conservative?.overall_judged_correct_rate,
  listwise_conservative_answer_support: listwiseIntegration.selection_metrics?.listwise_conservative?.answer_support_rate,
  calibrated_overall: listwiseIntegration.selection_metrics?.calibrated_hybrid?.overall_judged_correct_rate,
  calibrated_answer_support: listwiseIntegration.selection_metrics?.calibrated_hybrid?.answer_support_rate,
  constrained_status: constrainedListwise.status,
  constrained_overall: constrainedListwise.selected_by_validation?.final_reporting?.overall_judged_correct_rate,
  constrained_answer_support: constrainedListwise.selected_by_validation?.final_reporting?.answer_support_rate,
};
const generatorEvidence = {
  qwen3b_overclaim_status: overclaimSmoke.status,
  qwen3b_overclaim_shape_correct: overclaimSmoke.shape_gate?.overall_shape_correct_rate ?? overclaimSmoke.metrics?.overall_shape_correct_rate ?? null,
  qwen7b_v14_status: qwen7bV14.status,
  qwen7b_v14_answer_support: qwen7bV14.metrics?.v14?.answer_support_rate,
  qwen7b_v14_overall: qwen7bV14.metrics?.v14?.overall_judged_correct_rate,
  calibrated_answer_support: listwiseIntegration.selection_metrics?.calibrated_hybrid?.answer_support_rate,
  calibrated_overall: listwiseIntegration.selection_metrics?.calibrated_hybrid?.overall_judged_correct_rate,
};
const backendReady = backend.status === "remote_backend_ready_for_qwen3b_smoke";
const underBudget = Number(budget.spend_usd?.total_actual ?? 0) < Number(budget.max_budget_usd ?? 100);
const allKnownPaidGeneratorBranchesNegative =
  overclaimSmoke.status === "shape_gate_failed_do_not_judge"
  && qwen7bV14.status === "v14_small_selector_signal_not_launch_ready";
const selectorBranchesNegative =
  listwiseIntegration.status === "listwise_selector_not_integrated"
  && constrainedListwise.status === "coverage_constrained_selector_not_integrated";

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "next_intervention_audit",
  status: "needs_new_contract_before_paid_gpu",
  purpose: "Choose the next research action after D364 without spending on a repeated selector or already-failed generator branch.",
  source_runs: {
    current_readiness_audit: readiness.run_id,
    remote_backend_readiness_gate: backend.run_id,
    listwise_selector_integration: listwiseIntegration.run_id,
    coverage_constrained_listwise_selector: constrainedListwise.run_id,
    overclaim_citation_qwen3b_smoke_outcome: overclaimSmoke.run_id,
    qwen7b_v14_support_delta_outcome: qwen7bV14.run_id,
    judge_reliability_claim_gate: judgeReliability.run_id,
  },
  blockers,
  evidence: {
    selector_evidence: selectorEvidence,
    generator_evidence: generatorEvidence,
    backend_ready: backendReady,
    budget_under_cap: underBudget,
    judge_reliability_status: judgeReliability.status,
    judge_claim_permissions: judgeReliability.claim_permissions,
  },
  decision: {
    launch_prime_now: false,
    buy_openai_labels_now: false,
    run_another_local_selector_now: false,
    run_repeated_qwen3b_or_qwen7b_packet_now: false,
    use_prime_when_new_contract_preflight_passes: backendReady && underBudget,
    next_step: "Design and validate a new evidence-first generation contract that forces cited claim planning before answer text, then run only a local/fixture shape preflight before any Prime launch.",
    reason: "The currently available selectors fail end-to-end support, Qwen 3B repair fails the shape gate, and the latest Qwen 7B support-delta result does not beat the calibrated hybrid. Prime is available and budget-safe, but there is no untested launch packet worth renting for until the output contract changes.",
  },
  interpretation: {
    selector_branches_negative: selectorBranchesNegative,
    known_paid_generator_branches_negative: allKnownPaidGeneratorBranchesNegative,
    backend_is_not_current_blocker: backendReady,
    budget_is_not_current_blocker: underBudget,
    current_scientific_blocker: "No trained smaller model or zero-call scaffold currently beats the calibrated hybrid on support-preserving coverage; repeated local selector tuning and repeated Qwen 3B/7B curricula are not justified without a new contract.",
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
    prime_intellect_cost_usd: 0,
    note: "This audit reads local artifacts only and launches no compute.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  blockers: result.blockers,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function renderReport(result) {
  return `# Next Intervention Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Current Blockers

${result.blockers.map((blocker) => `- ${blocker}`).join("\n")}

## Evidence

- Selector branches negative: ${result.interpretation.selector_branches_negative ? "yes" : "no"}
- Known paid generator branches negative: ${result.interpretation.known_paid_generator_branches_negative ? "yes" : "no"}
- Backend ready: ${result.interpretation.backend_is_not_current_blocker ? "yes" : "no"}
- Budget under cap: ${result.interpretation.budget_is_not_current_blocker ? "yes" : "no"}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}
- Run another local selector now: ${result.decision.run_another_local_selector_now ? "yes" : "no"}
- Run repeated Qwen 3B/7B packet now: ${result.decision.run_repeated_qwen3b_or_qwen7b_packet_now ? "yes" : "no"}
- Use Prime when new contract preflight passes: ${result.decision.use_prime_when_new_contract_preflight_passes ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}

No OpenAI calls, no GPU jobs, and no new spend were made.
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
