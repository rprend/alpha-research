import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "final-claim-acceptance-matrix-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const finalChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");
const qwenIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const lossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");
const citationMemory = await readResult("citation-grounding-memory-comparison-2026-06-27-v1");
const faithfulContextQa = await readResult("faithful-context-qa-comparison-2026-06-27-v1");
const pareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const amortization = await readResult("amortization-break-even-qwen3b-2026-06-26-v1");
const novelty = await readResult("novelty-watchlist-2026-06-27-v2");
const citationFaithfulness = await readResult("citation-faithfulness-neighbor-comparison-2026-06-27-v1");
const remoteBackend = await readResult("remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1");
const remoteProvenance = await readResult("qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1");
const judgeTaxonomy = await readResult("judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2");
const judgeReliabilityClaimGate = await readResult("judge-reliability-claim-gate-2026-06-27-v1");

const qwenMetrics = qwenIntegration.qwen_metrics ?? null;
const targetComparison = qwenIntegration.target_comparison ?? null;
const checklistById = new Map((finalChecklist.acceptance_criteria ?? []).map((row) => [row.id, row]));
const supportContract = lossAccounting.qwen_acceptance_contract;
const readinessPass = readiness.summary?.paper_ready === true;
const budgetUnderCap = Number(budget.spend_usd?.total_actual) <= Number(budget.max_budget_usd);

const matrix = [
  row("trained_student_predictions", "A trained Qwen 3B joint-action student must produce final-window predictions.", checklistPass("smoke_artifacts_complete"), [
    artifact("qwen3b_result_integration", qwenIntegration.run_id, qwenIntegration.status),
    textEvidence(qwenIntegration.artifact_status?.prediction?.complete ? "Prediction artifacts complete." : "No trained Qwen 3B prediction artifacts are present."),
  ]),
  row("grounded_correctness_judge", "The trained student must have paid grounded-correctness judgments.", checklistPass("paid_judge_complete"), [
    artifact("qwen3b_result_integration", qwenIntegration.run_id, qwenIntegration.status),
    textEvidence(qwenIntegration.artifact_status?.judge?.complete ? "Paid judge artifacts complete." : "No paid Qwen 3B judge artifacts are present."),
  ]),
  row("answer_support_preserved", "Answer support must beat the direct baseline and be reported against the 70% coverage frontier.", Boolean(targetComparison?.meets_minimum_acceptance), [
    artifact("distillation_loss_accounting", lossAccounting.run_id, lossAccounting.status),
    textEvidence(qwenMetrics ? `Qwen answer support ${pct(qwenMetrics.answer_support_rate)}.` : "Qwen answer-support metrics are missing."),
    textEvidence(supportContract.must_preserve_or_improve.find((item) => item.dimension === "answer_support_rate")?.minimum ?? "Acceptance target missing."),
  ]),
  row("coverage_not_collapsed", "Answer rate must stay at or above 70% before claiming support-preserving distillation.", Boolean(qwenMetrics && Number(qwenMetrics.answer_rate) >= 0.7), [
    artifact("coverage_frontier_contract", lossAccounting.run_id, lossAccounting.status),
    textEvidence(qwenMetrics ? `Qwen answer rate ${pct(qwenMetrics.answer_rate)}.` : "Qwen answer-rate metrics are missing."),
  ]),
  row("citation_support_not_syntax", "Citation existence, support/relevance, and temporal/update validity must be separated from inline citation syntax.", qwenMetrics ? Boolean(qwenMetrics.citation_recall != null && qwenMetrics.answer_support_rate != null) : false, [
    artifact("citation_grounding_memory_comparison", citationMemory.run_id, citationMemory.comparison_type),
    artifact("faithful_context_qa_comparison", faithfulContextQa.run_id, faithfulContextQa.comparison_type),
    textEvidence("Syntax-only controls remain negative evidence until Qwen support/citation metrics exist."),
  ]),
  row("temporal_update_validity", "The result must be on the final dated/update-heldout window and must not use stale/final-window leakage.", checklistPass("integrity_gate_ready") && checklistPass("remote_provenance_ready"), [
    artifact("remote_provenance_gate", remoteProvenance.run_id, remoteProvenance.status),
    artifact("citation_grounding_memory_comparison", citationMemory.run_id, citationMemory.comparison_type),
    textEvidence("Versioned stale-snapshot diagnostics show why update validity is not implied by citation syntax."),
  ]),
  row("amortized_cost_accounted", "Total OpenAI plus external compute spend must stay under $100, and Qwen break-even must be recomputed with actual spend.", budgetUnderCap && checklistPass("qwen3b_on_pareto_table"), [
    artifact("amortization_break_even", amortization.run_id, amortization.status),
    artifact("cost_coverage_support_pareto", pareto.run_id, pareto.status),
    textEvidence(`Current actual spend $${Number(budget.spend_usd.total_actual).toFixed(6)} of $${Number(budget.max_budget_usd).toFixed(2)}.`),
  ]),
  row("remote_reproducibility", "Remote backend, environment, smoke manifest, and provenance must be recorded before judging.", checklistPass("remote_backend_ready") && checklistPass("remote_provenance_ready"), [
    artifact("remote_backend_readiness_gate", remoteBackend.run_id, remoteBackend.status),
    artifact("remote_provenance_gate", remoteProvenance.run_id, remoteProvenance.status),
  ]),
  row("judge_reliability_claim_bounded", "Judge disagreement and abstention-boundary instability must be caveated unless human/stronger adjudication closes it.", judgeReliabilityClaimGate.status === "judge_reliability_requires_final_adjudication" && judgeReliabilityClaimGate.claim_permissions?.human_validated_correctness_claim_allowed === false, [
    artifact("judge_reliability_claim_gate", judgeReliabilityClaimGate.run_id, judgeReliabilityClaimGate.status),
    artifact("judge_disagreement_taxonomy", judgeTaxonomy.run_id, "caveat_required"),
    textEvidence(`Current hard-case disagreement rate: ${pct(judgeTaxonomy.source_summary?.disagreement_rate)}.`),
    textEvidence(`Priority adjudication rows before uncaveated submission claims: ${judgeReliabilityClaimGate.priority_adjudication?.rows_total}.`),
  ]),
  row("novelty_claims_narrowed", "The final claim must avoid generic RAG distillation, citation SFT, compact faithful-context QA, citation grounding, and compact-memory amortization.", true, [
    artifact("novelty_watchlist", novelty.run_id, "watchlist_current_but_needs_submission_refresh"),
    artifact("citation_grounding_memory_comparison", citationMemory.run_id, citationMemory.comparison_type),
    artifact("faithful_context_qa_comparison", faithfulContextQa.run_id, faithfulContextQa.comparison_type),
    artifact("citation_faithfulness_neighbor_comparison", citationFaithfulness.run_id, citationFaithfulness.comparison_type),
  ]),
  row("citation_faithfulness_neighbors_positioned", "The final claim must position QDRAG/Faithful in Steps, CiteRAG, faithfulness-aware context ranking, and generate-then-verify as neighboring retrieval/verification strategies rather than the paper contribution.", true, [
    artifact("citation_faithfulness_neighbor_comparison", citationFaithfulness.run_id, citationFaithfulness.comparison_type),
    textEvidence(`Required post-Qwen comparisons: ${(citationFaithfulness.synthesis?.required_after_qwen_smoke ?? []).length}.`),
    textEvidence("Any generate-then-verify comparison must report online verification cost separately from amortized student/scaffold inference cost."),
  ]),
  row("paper_readiness_gate_green", "The paper-readiness gate must be green before any NeurIPS-ready claim.", readinessPass, [
    artifact("paper_readiness_gate", readiness.run_id, readiness.summary?.current_status),
    textEvidence(`Readiness: ${readiness.summary?.passed}/${readiness.summary?.requirements_total} requirements pass.`),
  ]),
];

const blockingRows = matrix.filter((item) => item.status === "fail" && item.blocks_paper_claim);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "final_claim_acceptance_matrix",
  status: blockingRows.length ? "final_claim_blocked" : "final_claim_ready_for_submission_audit",
  purpose: "Make the final amortized grounded-QA claim executable: each required claim dimension must point to concrete evidence and fail closed until trained Qwen 3B predictions, grounded judging, provenance, novelty, and cost gates pass.",
  matrix,
  summary: {
    requirements_total: matrix.length,
    passed: matrix.filter((item) => item.status === "pass").length,
    failed: matrix.filter((item) => item.status === "fail").length,
    blocking_failures: blockingRows.map((item) => item.id),
    paper_ready: blockingRows.length === 0,
  },
  current_blockers: blockingRows.map((item) => ({
    id: item.id,
    requirement: item.requirement,
    evidence: item.evidence,
  })),
  allowed_claim_now: "The project has a fail-closed acceptance matrix and scoped related-work positioning, but it cannot claim support-preserving amortized distillation until the trained Qwen 3B smoke, paid judge, provenance, Pareto, and final readiness gates pass.",
  prohibited_claims_now: [
    "A trained smaller model preserves citation-grounded correctness.",
    "Citation syntax is sufficient evidence of grounding.",
    "The project beats compact faithful-context QA, citation-grounding metrics, or compact-memory RAG baselines.",
    "The current result is NeurIPS-ready.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This acceptance matrix reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  passed: result.summary.passed,
  failed: result.summary.failed,
  blocking_failures: result.summary.blocking_failures,
}, null, 2));

function row(id, requirement, passed, evidence, blocksPaperClaim = true) {
  return {
    id,
    requirement,
    status: passed ? "pass" : "fail",
    blocks_paper_claim: blocksPaperClaim,
    evidence,
  };
}

function checklistPass(id) {
  return checklistById.get(id)?.status === "pass";
}

function artifact(label, runId, status) {
  return {
    type: "artifact",
    label,
    run_id: runId,
    status: status ?? null,
    result_path: `docs/experiments/grounded-qa-distillation/runs/${runId}/result.json`,
  };
}

function textEvidence(text) {
  return { type: "note", text };
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  const rows = result.matrix.map((item) => `| ${item.id} | ${item.status} | ${item.requirement} |`).join("\n");
  const blockers = result.current_blockers.map((item) => `- ${item.id}: ${item.requirement}`).join("\n") || "- none";
  return `# Final Claim Acceptance Matrix

Generated: ${result.generated_at}

Status: \`${result.status}\`

| Requirement | Status | Claim Dimension |
| --- | --- | --- |
${rows}

## Blocking Failures

${blockers}

## Allowed Claim Now

${result.allowed_claim_now}

## Prohibited Claims Now

${result.prohibited_claims_now.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
`;
}

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
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
