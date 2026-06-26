import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const dataDir = path.join(experimentDir, "data");
const llmDir = path.join(experimentDir, "llm-calls");
const spendDir = path.join(experimentDir, "spend");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "paper-readiness-gate-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const runIds = await listRunIds();
const novelty = await readResult("novelty-watchlist-2026-06-26-v1");
const totalBudget = await readJsonIfPresent(path.join(spendDir, "budget.json"));
const llmBudget = await readJsonIfPresent(path.join(llmDir, "budget.json"));
const extendedTemporalManifest = await readJsonIfPresent(path.join(dataDir, "extended_temporal-manifest.json"));
const futureHoldoutManifest = await readJsonIfPresent(path.join(dataDir, "extended_temporal_future_holdout-manifest.json"));
const dragStyleComparisonRunId = findRun(runIds, [/drag/i, /generic-rag-distill/i]);
const citationSftComparisonRunId = findRun(runIds, [/longcite/i, /citation-sft-comparison/i]);
const writeBackScopeRunId = findRun(runIds, [/writeback/i, /kb-write/i, /evidence-distillation-baseline/i]);
const trustedDatedSnapshotRunId = findRun(runIds, [/trusted-dated-kb-snapshot/i, /trusted-temporal-snapshot/i]);

const requirements = [
  req("novelty_watchlist_current", "June 2026 novelty watchlist exists with high-pressure neighbors.", hasRun(runIds, "novelty-watchlist-2026-06-26-v1"), evidenceRun("novelty-watchlist-2026-06-26-v1")),
  req("budget_under_cap", "Total actual OpenAI plus external compute spend remains under the $100 cap.", Number(totalBudget?.spend_usd?.total_actual) <= 100, {
    total_actual_usd: totalBudget?.spend_usd?.total_actual,
    remaining_usd: totalBudget?.spend_usd?.remaining,
    llm_budget_spend_usd: llmBudget?.ledger_spend_usd,
  }),
  req("joint_action_packet_ready", "Joint-action SFT/DPO packet exists for Qwen 3B training.", hasRun(runIds, "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1"), evidenceRun("joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1")),
  req("joint_action_preflight_passed", "Bounded joint-action launch preflight exists and passed packet/script/safety checks.", hasRun(runIds, "joint-action-launch-preflight-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1"), evidenceRun("joint-action-launch-preflight-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1")),
  req("budgeted_prime_launch_plan", "Budget-gated Prime smoke launch plan exists with planned zero-actual-cost spend row.", hasRun(runIds, "joint-action-launch-plan-prime-qwen3b-smoke-v1"), evidenceRun("joint-action-launch-plan-prime-qwen3b-smoke-v1")),
  req("qwen3b_joint_action_smoke_result", "A bounded Qwen 3B joint-action smoke has actually trained and produced eval predictions.", hasAny(runIds, [/joint-action.*qwen3b.*(trained|student-eval|model-eval|predictions)/, /qwen3b.*joint-action.*(trained|student-eval|model-eval|predictions)/], ["joint-action-launch-plan", "joint-action-launch-preflight", "joint-action-gpu-prep", "gpu-launch-attempt"]), missing("No trained Qwen 3B joint-action result/eval artifact is present.")),
  req("grounded_correctness_eval_for_student", "The trained joint-action student has grounded-correctness judging on the final future window.", hasAny(runIds, [/openai-judge.*qwen3b.*joint-action/, /judge.*joint-action.*qwen3b/]), missing("No judge run exists for a Qwen 3B joint-action student.")),
  req("drag_like_rag_distillation_comparison", "A generic RAG-to-SLM distillation comparison or documented non-comparability result exists.", Boolean(dragStyleComparisonRunId), dragStyleComparisonRunId ? evidenceRun(dragStyleComparisonRunId) : missing("No DRAG-like/generic RAG distillation comparison artifact is present.")),
  req("longcite_style_citation_sft_comparison", "A LongCite-style citation-SFT framing is compared using support metrics, not just citation syntax.", Boolean(citationSftComparisonRunId), citationSftComparisonRunId ? evidenceRun(citationSftComparisonRunId) : missing("No LongCite-style citation-SFT comparison artifact is present.")),
  req("writeback_kb_amortization_baseline", "A KB write-back/evidence-distillation baseline exists or is explicitly scoped out with evidence.", Boolean(writeBackScopeRunId), writeBackScopeRunId ? evidenceRun(writeBackScopeRunId) : missing("No WriteBack-RAG-style KB amortization baseline or scoped exclusion artifact is present.")),
  req("trusted_dated_or_private_kb_snapshot", "Evaluation uses trusted dated/private KB snapshots beyond arXiv-id-inferred temporal splits.", Boolean(trustedDatedSnapshotRunId) || hasTrustedTemporalSource({ extendedTemporalManifest, futureHoldoutManifest }), trustedDatedSnapshotRunId ? evidenceRun(trustedDatedSnapshotRunId) : {
    extended_temporal_source: extendedTemporalManifest?.temporal_policy?.temporal_source ?? extendedTemporalManifest?.temporal_source ?? null,
    future_holdout_temporal_source: futureHoldoutManifest?.temporal_source ?? futureHoldoutManifest?.selection_policy?.temporal_source ?? null,
    assessment: "Current manifests appear to rely on inferred arXiv-id/paper-id temporalization rather than trusted dated/private KB snapshots.",
  }),
  req("paper_claims_narrowed", "Decision log records narrowed novelty claims and claims-to-avoid.", await fileIncludes(path.join(experimentDir, "DECISIONS.md"), "D101. Narrow the novelty claim"), {
    decision_log: "docs/experiments/grounded-qa-distillation/DECISIONS.md",
  }),
];

const passed = requirements.filter((row) => row.status === "pass").length;
const failed = requirements.length - passed;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  objective: "NeurIPS-level readiness gate for amortized grounded research over evolving private/domain KBs.",
  novelty_watchlist_run_id: novelty?.run_id ?? null,
  requirements,
  summary: {
    requirements_total: requirements.length,
    passed,
    failed,
    paper_ready: failed === 0,
    current_status: failed === 0 ? "ready_for_paper_claim_audit" : "not_paper_ready",
  },
  top_blockers: requirements.filter((row) => row.status === "fail").map((row) => ({
    id: row.id,
    requirement: row.requirement,
    evidence: row.evidence,
  })),
  next_actions: [
    "Refresh Prime auth or add HF credits, then run the bounded Qwen 3B joint-action smoke.",
    "Judge the trained Qwen 3B outputs for answer support, citation support, and abstention support on the held-out future window.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Readiness gate uses existing local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function req(id, requirement, passed, evidence) {
  return {
    id,
    requirement,
    status: passed ? "pass" : "fail",
    evidence,
  };
}

function evidenceRun(runId) {
  return {
    run_id: runId,
    result: `docs/experiments/grounded-qa-distillation/runs/${runId}/result.json`,
  };
}

function missing(reason) {
  return { missing: true, reason };
}

function hasRun(runIds, runId) {
  return runIds.includes(runId);
}

function hasAny(runIds, patterns, excludeSubstrings = []) {
  return runIds.some((runId) => {
    if (excludeSubstrings.some((fragment) => runId.includes(fragment))) return false;
    return patterns.some((pattern) => pattern.test(runId));
  });
}

function findRun(runIds, patterns, excludeSubstrings = []) {
  return runIds.find((runId) => {
    if (excludeSubstrings.some((fragment) => runId.includes(fragment))) return false;
    return patterns.some((pattern) => pattern.test(runId));
  }) ?? null;
}

function hasTrustedTemporalSource({ extendedTemporalManifest, futureHoldoutManifest }) {
  const text = JSON.stringify([extendedTemporalManifest, futureHoldoutManifest]).toLowerCase();
  if (!text || text === "[null,null]") return false;
  if (text.includes("private") || text.includes("trusted dated") || text.includes("human_verified_date")) return true;
  return false;
}

async function listRunIds() {
  const entries = await fs.readdir(runDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function readResult(runId) {
  return readJsonIfPresent(path.join(runDir, runId, "result.json"));
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function fileIncludes(file, pattern) {
  try {
    return (await fs.readFile(file, "utf8")).includes(pattern);
  } catch {
    return false;
  }
}

function renderReport(result) {
  const rows = result.requirements.map((row) => `| ${row.id} | ${row.status} | ${row.requirement} |`).join("\n");
  const blockers = result.top_blockers.map((row) => `- ${row.id}: ${row.requirement}`).join("\n") || "- none";
  return `# Grounded QA Paper Readiness Gate

Generated: ${result.generated_at}

Status: \`${result.summary.current_status}\`

| Requirement | Status | Description |
| --- | --- | --- |
${rows}

## Top Blockers

${blockers}

## Next Actions

${result.next_actions.map((item) => `- ${item}`).join("\n")}

## Budget

No OpenAI API calls, no GPU jobs, and no new spend.
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
