import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "reviewer-risk-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const evidenceMap = await readResult("manuscript-evidence-map-2026-06-26-v1");
const draft = await readResult("manuscript-draft-2026-06-26-v1");
const novelty = await readResult("novelty-watchlist-2026-06-26-v1");
const remoteSmoke = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1");
const postSmoke = await readResult("qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1");
const judgeCalibration = await readResult("judge-calibration-audit-2026-06-26-v1");
const judgeAdjudication = await readResult("judge-adjudication-packet-2026-06-26-v1");
const judgeSecondPass = await readResult("judge-reliability-second-pass-plan-2026-06-26-v1");
const judgeSecondPassRun = await readResult("judge-reliability-second-pass-run-2026-06-26-v2");
const abstentionReliability = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");
const costCoveragePareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const policyAblation = await readResult("post-training-policy-ablation-2026-06-26-v1");
const coverageFrontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const modelScaleAudit = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const packetQualityAudit = await readResult("joint-action-packet-quality-audit-2026-06-26-v1");
const scriptContractAudit = await readResult("joint-action-script-contract-audit-2026-06-26-v1");
const smokeLedgerFinalizer = await readResult("joint-action-smoke-ledger-finalizer-joint-action-qwen3b-smoke-eval-v1");
const primeRunbook = await readResult("prime-qwen3b-smoke-runbook-2026-06-26-v1");
const qwenResultIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const primeCliAuthRecheck = await readResult("prime-cli-upgrade-auth-recheck-2026-06-26-v1");
const primeAuthPriceGate = await readResult("prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1");
const finalEvidenceChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const risks = [
  {
    id: "R1_missing_trained_qwen3b_result",
    severity: "critical",
    status: "blocking",
    reviewer_objection: "The paper question asks whether expensive grounded behavior can be distilled into a cheaper trained model or scaffold, but the final Qwen 3B joint-action student has not been trained/evaluated.",
    current_evidence: [
      readiness.run_id,
      remoteSmoke.run_id,
      packetQualityAudit.run_id,
      scriptContractAudit.run_id,
      qwenResultIntegration.run_id,
      modelScaleAudit.run_id,
      finalEvidenceChecklist.run_id,
      evidenceMap.qwen3b_required_final_result.remote_smoke_plan_run_id,
    ],
    mitigation_done: `The dataset packet, bounded GPU runner, adapter eval, smoke manifest, and budgeted launch command are prepared and validated. ${packetQualityAudit.run_id} verifies ${packetQualityAudit.aggregate.sft.rows} SFT rows and ${packetQualityAudit.aggregate.dpo.rows} DPO rows with both repair and abstain preferences, no missing inline citations in grounded targets, and no train/eval paper overlap. ${scriptContractAudit.run_id} runs zero-cost local compile, packet-validator, Bash syntax, bounded-command, and judge-ready artifact checks. ${modelScaleAudit.run_id} shows tiny/local students are not adequate final evidence and justifies the bounded Qwen 3B smoke over either tiny-model labelers or an open-ended cutting-edge GPU run. ${qwenResultIntegration.run_id} will compare the judged Qwen result against direct and 70% coverage-constrained targets before any Pareto claim. ${finalEvidenceChecklist.run_id} enumerates the exact final artifacts that must exist before this blocker can close.`,
    required_next_evidence: [
      "runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl",
      "runs/joint-action-qwen3b-smoke-eval-v1/result.json",
      "runs/joint-action-qwen3b-smoke-eval-v1/smoke_manifest.json",
    ],
  },
  {
    id: "R2_missing_grounded_correctness_judge_for_student",
    severity: "critical",
    status: "blocking",
    reviewer_objection: "No paper-ready claim can be made about citation-grounded correctness until the trained student's predictions are judged for support and abstention correctness.",
    current_evidence: [
      readiness.run_id,
      postSmoke.run_id,
      finalEvidenceChecklist.run_id,
      "qwen3b-prediction-integrity-gate-joint-action-qwen3b-smoke-eval-v1",
    ],
    mitigation_done: "A fail-closed post-smoke pipeline now runs prediction integrity checks and dry judging before any paid OpenAI judge call.",
    required_next_evidence: [
      "Integrity gate status ready_for_paid_judge",
      "Dry judge covers all 69 final-window examples",
      "Paid openai-judge run with positive calls_made and examples_judged",
      "Qwen result integration status ready_for_pareto_update",
    ],
  },
  {
    id: "R3_private_kb_claim_overreach",
    severity: "high",
    status: "managed_but_not_closed",
    reviewer_objection: "The motivating claim says private evolving KBs, while the current evaluation is a public QASPER/arXiv proxy.",
    current_evidence: [
      evidenceMap.dataset_and_temporal_claims.trusted_snapshot_run_id,
      "extended_temporal_future_holdout-manifest.json",
    ],
    mitigation_done: "The manuscript evidence map and draft restrict the claim to a trusted dated public proxy and explicitly prohibit private-KB proof language.",
    required_next_evidence: [
      "Keep the manuscript caveat unless a versioned private/domain corpus is added.",
      "If adding a private KB, create train-time and final-time snapshots with immutable date provenance.",
    ],
  },
  {
    id: "R4_novelty_pressure_from_rag_distillation_and_citation_sft",
    severity: "high",
    status: "managed_but_needs_final_refresh",
    reviewer_objection: "The contribution may be perceived as generic RAG distillation, generic citation SFT, or KB write-back memory rather than a sharper grounded-correctness amortization result.",
    current_evidence: [
      novelty.run_id,
      "drag-like-rag-distillation-comparison-2026-06-26-v1",
      "longcite-style-citation-sft-comparison-2026-06-26-v1",
      "writeback-kb-amortization-scoped-exclusion-2026-06-26-v1",
    ],
    mitigation_done: "Current artifacts isolate the support/abstention/citation-grounding axis and scope out write-back retrieval until leakage-safe memory snapshots exist.",
    required_next_evidence: [
      "Refresh web/paper search immediately before any submission claim.",
      "Update related-work notes with any June 2026 or newer direct overlaps.",
    ],
  },
  {
    id: "R5_model_judge_reliability",
    severity: "medium_high",
    status: "open",
    reviewer_objection: "A model-based grounded-correctness judge can be biased, under-calibrated, or insufficient as the only correctness authority.",
    current_evidence: [
      judgeCalibration.run_id,
      judgeAdjudication.run_id,
      judgeSecondPass.run_id,
      judgeSecondPassRun.run_id,
      abstentionReliability.run_id,
      "claim-entailment-guard-validation-240-389-v1",
    ],
    mitigation_done: `The judge artifacts store structured support verdicts, ${judgeCalibration.run_id} samples ${judgeCalibration.summary.audit_queue_rows} hard rows from ${judgeCalibration.summary.judgments_loaded} existing judgments, ${judgeAdjudication.run_id} joins those rows to questions/evidence/predictions with ${judgeAdjudication.join_warnings.length} join warnings, ${judgeSecondPass.run_id} prepares ${judgeSecondPass.request_rows} blind second-pass request rows, ${judgeSecondPassRun.run_id} completes ${judgeSecondPassRun.calls_made} blind second-pass case judgments with ${judgeSecondPassRun.schema_violations} schema violations and ${(100 * judgeSecondPassRun.agreement.exact_agreement_rate).toFixed(1)}% exact agreement, and ${abstentionReliability.run_id} flags questionable abstentions as unstable.`,
    required_next_evidence: [
      "Manually adjudicate the joined judge adjudication packet or run the planned blind second-judge pass before submission if budget/time permits.",
      "Report judge prompts, schemas, abstention criteria, and disagreement examples.",
    ],
  },
  {
    id: "R6_coverage_support_tradeoff",
    severity: "medium_high",
    status: "open",
    reviewer_objection: "The strongest completed scaffold results improve support largely by suppressing risky answers, so correctness gains may hide poor answer coverage.",
    current_evidence: [
      "risk-gate-transfer-synthesis-240-389-v1",
      "claim-entailment-guard-validation-240-389-v1",
      costCoveragePareto.run_id,
      policyAblation.run_id,
      coverageFrontier.run_id,
      qwenResultIntegration.run_id,
      draft.run_id,
    ],
    mitigation_done: `${costCoveragePareto.run_id} maps ${costCoveragePareto.systems.length} current systems across answer rate, answer support, judged correctness, citation recall, and online calls/query; ${policyAblation.run_id} aggregates existing judged post-training/data policies and shows support-risk gated labels are strongest by judged correctness/support but answer only ${(100 * policyAblation.families.find((row) => row.id === "support_risk_gated_labels").aggregate.answer_rate).toFixed(1)}% of rows; ${coverageFrontier.run_id} replays thresholds and shows the 70% answer-rate operating point reaches ${(100 * coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7).selected.answer_support_rate).toFixed(1)}% answer support and ${(100 * coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7).selected.overall_judged_correct_rate).toFixed(1)}% judged correctness; the draft frames coverage as a central metric.`,
    required_next_evidence: [
      "Report answer rate, abstention correctness, support, and utility together.",
      "Compare trained Qwen 3B against zero-call gates on both correctness and coverage.",
      "Use qwen3b-result-integration to decide whether the result meets the minimum target or is a negative result.",
    ],
  },
  {
    id: "R7_remote_compute_reproducibility_and_auth",
    severity: "medium",
    status: "operational_blocker",
    reviewer_objection: "The paper-critical run depends on external GPU execution, while Prime auth and HF credits are currently unavailable.",
    current_evidence: [
      "prime-auth-diagnosis",
      primeCliAuthRecheck.run_id,
      finalEvidenceChecklist.run_id,
      remoteSmoke.run_id,
      scriptContractAudit.run_id,
      smokeLedgerFinalizer.run_id,
      primeRunbook.run_id,
      primeAuthPriceGate.run_id,
      budget.generated_at,
    ],
    mitigation_done: `The remote command is single-step and bounded; ${scriptContractAudit.run_id} verifies the script contract without spend; ${smokeLedgerFinalizer.run_id} is ready to append an actual external-compute row only after smoke artifacts exist and backend cost is known; ${primeRunbook.run_id} adds explicit Prime auth, live-price, pod-create, sync, bootstrap, fetch, cost-finalize, and terminate steps; ${primeCliAuthRecheck.run_id} upgraded/rechecked Prime CLI ${primeCliAuthRecheck.cli_version} and still found API-key authorization failures before pricing or balance checks; ${primeAuthPriceGate.run_id} is the executable read-only gate and currently reports ${primeAuthPriceGate.status}. All actual spend is tracked under the $100 budget with $0 external compute spend so far.`,
    required_next_evidence: [
      "Install a valid Prime key through hidden input or repair HF credits.",
      "Rerun the Prime auth/price gate and require auth_and_live_price_verified before pod creation.",
      "Record provider, GPU type, wall time, backend run id, actual cost, and command transcript for the smoke.",
      "Run the smoke ledger finalizer with --record=true after artifacts and backend cost are known.",
    ],
  },
  {
    id: "R8_model_scale_and_gpu_choice",
    severity: "medium_high",
    status: "managed_but_waiting_for_qwen3b",
    reviewer_objection: "The paper may be underpowered if the student model is too small, or wasteful if it jumps to an expensive cutting-edge model without first testing the minimal credible trained student.",
    current_evidence: [
      modelScaleAudit.run_id,
      policyAblation.run_id,
      coverageFrontier.run_id,
      packetQualityAudit.run_id,
      primeAuthPriceGate.run_id,
    ],
    mitigation_done: `${modelScaleAudit.run_id} compares direct mini RAG, zero-call gates, local distilled scaffolds, and Qwen 0.5B SFT. It records that Qwen 0.5B has high citation formatting but only ${(100 * modelScaleAudit.systems.find((row) => row.id === "local_qwen05b_sft_answer_repeat2").answer_support_rate).toFixed(1)}% answer support, rejects tiny models as final students or ground-truth labelers, and selects a bounded Qwen 3B smoke as the next minimum credible trained-student experiment under the $100 cap.`,
    required_next_evidence: [
      "Run the bounded Qwen 3B smoke only after auth_and_live_price_verified.",
      "If Qwen 3B fails the 70% coverage-constrained target, report that negative result before escalating to a larger model.",
      "Do not use tiny local model outputs as ground-truth labels.",
    ],
  },
];

const criticalBlockers = risks.filter((risk) => risk.severity === "critical" && risk.status === "blocking").map((risk) => risk.id);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "reviewer_risk_audit",
  status: "not_submission_ready",
  purpose: "Name the most likely reviewer objections and required evidence before treating the grounded-QA distillation project as paper-ready.",
  readiness_context: {
    gate_run_id: readiness.run_id,
    passed_requirements: readiness.summary.passed,
    failed_requirements: readiness.summary.failed,
    status: readiness.summary.current_status,
    blockers: readiness.top_blockers.map((row) => row.id),
  },
  critical_blockers: criticalBlockers,
  risks,
  acceptance_path: [
    "Repair Prime auth or HF credits without exceeding the $100 total budget.",
    "Run the one-command bounded Qwen 3B SFT/DPO smoke and produce complete predictions.",
    "Record actual GPU cost with the smoke ledger finalizer and regenerate total budget.",
    "Run the Qwen 3B prediction integrity gate and default post-smoke dry judge.",
    "Run the paid grounded-correctness judge only after the dry gate passes.",
    "Run Qwen result integration and update the Pareto/frontier table with the actual judged row.",
    "Refresh the novelty watchlist/web search immediately before making a submission-ready claim.",
    "Regenerate the evidence map, manuscript draft, readiness gate, and this risk audit.",
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
    note: "This reviewer-risk audit reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function renderReport(result) {
  return `# Reviewer Risk Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Readiness gate: \`${result.readiness_context.gate_run_id}\` (${result.readiness_context.passed_requirements}/${result.readiness_context.passed_requirements + result.readiness_context.failed_requirements} passing)

## Critical Blockers

${result.critical_blockers.map((id) => `- \`${id}\``).join("\n")}

## Risks

| ID | Severity | Status | Reviewer objection | Required next evidence |
| --- | --- | --- | --- | --- |
${result.risks.map((risk) => `| ${risk.id} | ${risk.severity} | ${risk.status} | ${risk.reviewer_objection} | ${risk.required_next_evidence.join("<br>")} |`).join("\n")}

## Acceptance Path

${result.acceptance_path.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Budget

- Actual total spend: $${result.budget.actual_total_spend_usd.toFixed(6)}
- External compute spend: $${result.budget.external_compute_actual_usd.toFixed(6)}
- Remaining: $${result.budget.remaining_budget_usd.toFixed(6)}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
