import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "post-qwen-regeneration-contract-audit-2026-06-27-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const qwenIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const paretoContract = await readResult("qwen3b-pareto-update-contract-audit-2026-06-27-v1");
const finalChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");

const artifacts = {
  total_budget: {
    run_id: "spend/budget.json",
    generated_at: budget.generated_at,
  },
  ...(await readArtifacts([
    ["amortization_break_even", "amortization-break-even-qwen3b-2026-06-26-v1"],
    ["distillation_loss_accounting", "distillation-loss-accounting-2026-06-27-v1"],
    ["paper_readiness", "paper-readiness-gate-2026-06-26-v1"],
    ["final_claim_matrix", "final-claim-acceptance-matrix-2026-06-27-v1"],
    ["final_evidence_checklist", "final-evidence-checklist-qwen3b-2026-06-26-v1"],
    ["manuscript_evidence_map", "manuscript-evidence-map-2026-06-27-v2"],
    ["manuscript_draft", "manuscript-draft-2026-06-27-v2"],
    ["reviewer_risk_audit", "reviewer-risk-audit-2026-06-27-v2"],
  ])),
};

const requiredScripts = [
  "grounded-qa-distillation-total-budget.mjs",
  "grounded-qa-distillation-amortization-break-even.mjs",
  "grounded-qa-distillation-distillation-loss-accounting.mjs",
  "grounded-qa-distillation-paper-readiness-gate.mjs",
  "grounded-qa-distillation-final-claim-acceptance-matrix.mjs",
  "grounded-qa-distillation-final-evidence-checklist.mjs",
  "grounded-qa-distillation-manuscript-evidence-map.mjs",
  "grounded-qa-distillation-manuscript-draft.mjs",
  "grounded-qa-distillation-reviewer-risk-audit.mjs",
];

const finalChecklistRegenerationCommand = finalChecklist.execution_sequence?.find((step) => step.id === "regenerate_paper_artifacts")?.command ?? "";
const commandCoverage = Object.fromEntries(requiredScripts.map((script) => [script, finalChecklistRegenerationCommand.includes(script)]));
const commandCoversAllRequired = Object.values(commandCoverage).every(Boolean);
const qwenReady = String(qwenIntegration.status).includes("ready_for_pareto_update");
const qwenGeneratedAt = Date.parse(qwenIntegration.generated_at);
const freshnessRows = Object.entries(artifacts).map(([key, artifact]) => ({
  id: key,
  run_id: artifact.run_id,
  generated_at: artifact.generated_at,
  generated_after_qwen_integration: qwenReady ? Date.parse(artifact.generated_at) > qwenGeneratedAt : false,
}));
const allFreshAfterQwen = qwenReady && freshnessRows.every((row) => row.generated_after_qwen_integration);
const passed = paretoContract.status === "qwen3b_pareto_update_contract_verified"
  && commandCoversAllRequired
  && (!qwenReady || allFreshAfterQwen);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "post_qwen_regeneration_contract_audit",
  status: passed ? "post_qwen_regeneration_contract_ready" : "post_qwen_regeneration_contract_failed",
  purpose: "Make the required post-Qwen regeneration order executable so paper artifacts cannot be treated as fresh after Qwen integration unless they are regenerated from the judged result and Pareto update.",
  source_artifacts: {
    qwen_result_integration_run_id: qwenIntegration.run_id,
    qwen_result_integration_status: qwenIntegration.status,
    qwen_pareto_update_contract_audit_run_id: paretoContract.run_id,
    final_evidence_checklist_run_id: finalChecklist.run_id,
  },
  required_regeneration_scripts: requiredScripts,
  final_checklist_regeneration_command: finalChecklistRegenerationCommand,
  command_coverage: commandCoverage,
  command_covers_all_required: commandCoversAllRequired,
  freshness_policy: {
    qwen_ready_for_pareto_update: qwenReady,
    qwen_integration_generated_at: qwenIntegration.generated_at,
    required_artifacts_generated_after_qwen: allFreshAfterQwen,
    current_artifacts: freshnessRows,
    note: qwenReady
      ? "All listed artifacts must be generated after the Qwen integration artifact."
      : "Qwen integration is not ready yet, so current paper artifacts are expected to remain stale/waiting rather than fresh.",
  },
  required_order_after_real_qwen: [
    "Run Qwen result integration after predictions and paid judge exist.",
    "Update cost-coverage-support Pareto with exactly one qwen3b_joint_action_smoke row from pareto_row_to_add.",
    "Regenerate total budget and amortization with actual GPU plus judge costs.",
    "Regenerate distillation-loss accounting so preservation/loss claims include Qwen.",
    "Regenerate paper readiness, final claim matrix, and final evidence checklist.",
    "Regenerate manuscript evidence map, manuscript draft, and reviewer-risk audit.",
    "Only after those artifacts are fresh should a final novelty refresh and submission-level claim audit run.",
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
    note: "This audit reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  command_covers_all_required: result.command_covers_all_required,
  qwen_ready_for_pareto_update: result.freshness_policy.qwen_ready_for_pareto_update,
}, null, 2));

async function readArtifacts(entries) {
  const result = {};
  for (const [key, id] of entries) {
    result[key] = await readResult(id);
  }
  return result;
}

function renderReport(result) {
  return `# Post-Qwen Regeneration Contract Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Qwen integration status: \`${result.source_artifacts.qwen_result_integration_status}\`

## Command Coverage

| Script | Covered |
| --- | --- |
${Object.entries(result.command_coverage).map(([script, covered]) => `| ${script} | ${covered ? "yes" : "no"} |`).join("\n")}

## Freshness Policy

| Artifact | Run | Generated after Qwen integration |
| --- | --- | --- |
${result.freshness_policy.current_artifacts.map((row) => `| ${row.id} | \`${row.run_id}\` | ${row.generated_after_qwen_integration ? "yes" : "no"} |`).join("\n")}

## Required Order After Real Qwen

${result.required_order_after_real_qwen.map((item) => `- ${item}`).join("\n")}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
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
