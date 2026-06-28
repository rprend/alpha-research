import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const runId = "current-readiness-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const noveltyDelta = await readResult("novelty-delta-matrix-2026-06-27-v1");
const noveltyWatchlist = await readResult("novelty-watchlist-2026-06-27-v2");
const structuralVerifier = await readResult("structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1");
const structuralSelector = await readResult("structural-verifier-selector-integration-final-window-2026-06-28-v1");
const structuralCrossWindow = await readResult("structural-cross-window-selector-240-320-to-321-389-2026-06-28-v1");
const calibratedHybrid = await readResult("calibrated-hybrid-selector-final-window-v1");
const v14Outcome = await readResult("v14-support-delta-outcome-audit-2026-06-28-v1");
const judgeReliability = await readResult("judge-reliability-claim-gate-2026-06-27-v1");
const qwen3bRuns = await readQwen3bIntegrationRuns();
const bestQwen3b = [...qwen3bRuns].sort((left, right) =>
  Number(right.result.qwen_metrics?.overall_judged_correct_rate ?? 0) - Number(left.result.qwen_metrics?.overall_judged_correct_rate ?? 0)
  || Number(right.result.qwen_metrics?.answer_support_rate ?? 0) - Number(left.result.qwen_metrics?.answer_support_rate ?? 0)
)[0] ?? null;
const calibrated = calibratedHybrid.selection_metrics?.calibrated_hybrid;
const structuralVerifierSelected = structuralVerifier.selected_by_nonfinal_labels;
const v14 = v14Outcome.metrics?.v14;
const qwenOnlyHeuristic = v14Outcome.metrics?.qwen_only_heuristic;

const requirements = [
  req("budget_under_cap", "Total OpenAI plus external compute spend remains under $100.", Number(budget.spend_usd?.total_actual) <= Number(budget.max_budget_usd), {
    total_actual_usd: budget.spend_usd?.total_actual,
    remaining_usd: budget.spend_usd?.remaining,
  }),
  req("novelty_scope_current_but_conditional", "June 2026 novelty pressure is captured and broad RAG/citation/distillation claims are rejected.", noveltyDelta.status === "surviving_claim_conditional_on_qwen3b_and_judge", {
    novelty_watchlist: noveltyWatchlist.run_id,
    novelty_delta_matrix: noveltyDelta.run_id,
    surviving_claims: noveltyDelta.summary?.surviving_claims,
    caveat: "Must refresh with web search again immediately before any submission-ready claim.",
  }),
  req("deployable_selector_baseline_exists", "A zero-call/deployable final-window selector baseline exists for comparison.", calibrated?.examples === 69 && calibrated?.answered === 49, {
    run_id: calibratedHybrid.run_id,
    answer_rate: calibrated?.answer_rate,
    answer_support_rate: calibrated?.answer_support_rate,
    overall_judged_correct_rate: calibrated?.overall_judged_correct_rate,
    note: "This baseline is useful but not a fully amortized trained student because the candidate pool includes OpenAI-mini scaffold candidates.",
  }),
  req("structural_verifier_component_positive", "The structural target-completeness verifier clears the component-level promotion threshold.", structuralVerifier.status === "structural_verifier_promotable_as_scaffold_component", {
    run_id: structuralVerifier.run_id,
    policy_id: structuralVerifierSelected?.policy_id,
    nonfinal_balanced_accuracy: structuralVerifierSelected?.nonfinal_candidate_labels?.balanced_accuracy,
    final_pair_transfer_accuracy: structuralVerifierSelected?.final_pair_transfer?.accuracy,
  }),
  req("structural_selector_not_promoted", "Structural target score has been tested as a selector and rejected when it hurts support/abstention safety.", structuralSelector.status === "structural_selector_not_integrated" && structuralCrossWindow.status === "structural_cross_window_selector_not_promoted", {
    structural_selector_run: structuralSelector.run_id,
    structural_cross_window_run: structuralCrossWindow.run_id,
    structural_selector_answer_support_rate: structuralSelector.selection_metrics?.structural_conservative?.answer_support_rate,
    structural_cross_window_answer_support_rate: structuralCrossWindow.selected_rule_metrics?.eval?.answer_support_rate,
  }, false),
  req("trained_qwen3b_student_positive", "A trained Qwen 3B student must beat the calibrated/deployable support-preserving baseline.", Boolean(bestQwen3b && bestQwen3b.result.target_comparison?.meets_minimum_acceptance), {
    best_qwen3b_run: bestQwen3b?.run_id ?? null,
    best_qwen3b_status: bestQwen3b?.result.status ?? null,
    best_qwen3b_answer_rate: bestQwen3b?.result.qwen_metrics?.answer_rate ?? null,
    best_qwen3b_answer_support_rate: bestQwen3b?.result.qwen_metrics?.answer_support_rate ?? null,
    best_qwen3b_overall_judged_correct_rate: bestQwen3b?.result.qwen_metrics?.overall_judged_correct_rate ?? null,
    calibrated_hybrid_answer_support_rate: calibrated?.answer_support_rate,
    calibrated_hybrid_overall_judged_correct_rate: calibrated?.overall_judged_correct_rate,
  }),
  req("qwen7b_support_delta_positive", "A Qwen 7B support-delta run must add support-preserving coverage beyond the calibrated hybrid.", v14Outcome.status !== "v14_small_selector_signal_not_launch_ready" && Number(v14?.answer_support_rate ?? 0) > Number(calibrated?.answer_support_rate ?? 1), {
    run_id: v14Outcome.run_id,
    status: v14Outcome.status,
    v14_answer_rate: v14?.answer_rate,
    v14_answer_support_rate: v14?.answer_support_rate,
    calibrated_hybrid_answer_support_rate: calibrated?.answer_support_rate,
    qwen_only_heuristic_answer_rate: qwenOnlyHeuristic?.answer_rate,
    qwen_only_heuristic_answer_support_rate: qwenOnlyHeuristic?.answer_support_rate,
  }),
  req("judge_reliability_submission_ready", "Grounded-correctness claims must be human/stronger-judge adjudicated or explicitly caveated.", judgeReliability.claim_permissions?.human_validated_correctness_claim_allowed === true, {
    run_id: judgeReliability.run_id,
    status: judgeReliability.status,
    exact_agreement_rate: judgeReliability.summary?.exact_agreement_rate,
    priority_adjudication_rows: judgeReliability.priority_adjudication?.rows_total,
    current_permission: judgeReliability.claim_permissions,
  }),
];

const blocking = requirements.filter((row) => row.status === "fail" && row.blocks_paper_claim);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "current_readiness_audit",
  status: blocking.length ? "not_neurips_ready_current_blockers" : "ready_for_submission_novelty_refresh",
  purpose: "Refresh the NeurIPS-level readiness state after D309-D318 so the next research action is driven by current evidence rather than stale gates.",
  requirements,
  summary: {
    requirements_total: requirements.length,
    passed: requirements.filter((row) => row.status === "pass").length,
    failed: requirements.filter((row) => row.status === "fail").length,
    blocking_failures: blocking.map((row) => row.id),
    paper_ready: blocking.length === 0,
  },
  current_best_systems: {
    calibrated_hybrid: pickMetrics(calibrated),
    structural_verifier_component: {
      nonfinal_balanced_accuracy: structuralVerifierSelected?.nonfinal_candidate_labels?.balanced_accuracy,
      final_pair_transfer_accuracy: structuralVerifierSelected?.final_pair_transfer?.accuracy,
    },
    best_qwen3b: bestQwen3b ? {
      run_id: bestQwen3b.run_id,
      metrics: pickMetrics(bestQwen3b.result.qwen_metrics),
      meets_minimum_acceptance: bestQwen3b.result.target_comparison?.meets_minimum_acceptance,
    } : null,
    v14_qwen7b: pickMetrics(v14),
  },
  decision: {
    paper_ready_now: false,
    train_or_rent_gpu_now: false,
    buy_more_openai_labels_now: false,
    keep_calibrated_hybrid_as_current_deployable_selector: true,
    next_step: "Stop hand-tuning structural selectors; either build a larger non-final listwise packet with explicit support/abstention labels, or run a bounded generation/repair experiment designed to beat the calibrated hybrid on support-preserving coverage.",
    reason: "The project now has a strong structural verifier component and clear negative selector evidence, but no trained smaller model or zero-call selector currently beats the calibrated hybrid support/coverage frontier.",
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
    note: "Current readiness audit reads existing local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  summary: result.summary,
  current_best_systems: result.current_best_systems,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

function req(id, requirement, passed, evidence, blocksPaperClaim = true) {
  return {
    id,
    requirement,
    status: passed ? "pass" : "fail",
    blocks_paper_claim: blocksPaperClaim,
    evidence,
  };
}

function pickMetrics(row) {
  if (!row) return null;
  return {
    examples: row.examples,
    answered: row.answered,
    abstained: row.abstained,
    answer_rate: row.answer_rate,
    answer_support_rate: row.answer_support_rate,
    abstention_support_rate: row.abstention_support_rate,
    overall_judged_correct_rate: row.overall_judged_correct_rate,
    supported_answers: row.supported_answers,
    supported_abstentions: row.supported_abstentions,
  };
}

async function readQwen3bIntegrationRuns() {
  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("qwen3b-result-integration-"))
    .map((entry) => entry.name)
    .sort();
  const rows = [];
  for (const id of runIds) {
    rows.push({ run_id: id, result: await readResult(id) });
  }
  return rows;
}

function renderReport(result) {
  const reqRows = result.requirements.map((row) => `| ${row.id} | ${row.status} | ${row.blocks_paper_claim ? "yes" : "no"} | ${row.requirement} |`).join("\n");
  const blockers = result.requirements
    .filter((row) => row.status === "fail" && row.blocks_paper_claim)
    .map((row) => `- ${row.id}: ${row.requirement}`)
    .join("\n") || "- none";
  return `# Current Readiness Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Requirement | Status | Blocks Paper | Description |
| --- | --- | --- | --- |
${reqRows}

## Blocking Failures

${blockers}

## Decision

- Paper ready now: ${result.decision.paper_ready_now ? "yes" : "no"}
- Train or rent GPU now: ${result.decision.train_or_rent_gpu_now ? "yes" : "no"}
- Buy more OpenAI labels now: ${result.decision.buy_more_openai_labels_now ? "yes" : "no"}
- Keep calibrated hybrid as current deployable selector: ${result.decision.keep_calibrated_hybrid_as_current_deployable_selector ? "yes" : "no"}
- Reason: ${result.decision.reason}
- Next step: ${result.decision.next_step}

No OpenAI calls, Prime jobs, or new spend were made for this artifact.
`;
}

async function readResult(id) {
  return readJson(path.join(runsDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}
