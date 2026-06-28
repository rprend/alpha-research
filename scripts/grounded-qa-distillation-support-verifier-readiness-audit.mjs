import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const runId = "support-verifier-readiness-audit-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const artifacts = {
  selector_ceiling: await readResult("final-selector-ceiling-audit-2026-06-28-v1"),
  claim_support_verifier: await readResult("claim-support-verifier-qwen-frontier-pool-2026-06-28-v1"),
  claim_nli_support_verifier: await readResult("claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1"),
  targeted_boundary_run: await readResult("targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1"),
  targeted_packet_learner: await readResult("targeted-packet-learner-transfer-audit-0-160-to-240-320-to-321-389-2026-06-28-v1"),
  final_miss_repairability: await readResult("final-miss-repairability-audit-321-389-2026-06-28-v1"),
};

const evidenceRows = buildEvidenceRows(artifacts);
const readiness = summarizeReadiness(artifacts);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "support_verifier_readiness_audit",
  status: readiness.status,
  purpose: "Gate the next support-verifier intervention by reconciling existing selector-ceiling, claim-verifier, targeted-label, and final-miss artifacts before spending more money.",
  readiness,
  evidence_rows: evidenceRows,
  decision: {
    launch_gpu_now: false,
    buy_openai_labels_now: false,
    integrate_existing_verifier_now: false,
    build_balanced_support_verifier_packet_next: true,
    reason: "The cheap frontier pool has supported candidates, but existing lexical/NLI verifier targets anti-transfer and targeted boundary labels show disagreement; the next target needs balanced preservation plus final-like hard negatives before any GPU run.",
    next_step: "Materialize a zero-cost balanced support-verifier packet that mixes broad preservation examples with targeted overexpansion/same-citation hard negatives, then run a transfer probe.",
  },
  leakage_guard: {
    final_window_labels_used_for_training: false,
    final_window_labels_used_for_model_selection: false,
    final_window_labels_used_for_readiness_reporting: true,
    paid_labels_reused_only_as_prior_artifact_summary: true,
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
    note: "This readiness audit reads existing artifacts only.",
  },
  artifacts: {
    evidence_jsonl: rel(path.join(outputDir, "evidence.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "evidence.jsonl"), evidenceRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: runId,
  status: result.status,
  readiness: result.readiness,
  decision: result.decision,
}, null, 2));

function buildEvidenceRows(items) {
  return [
    {
      source_run_id: items.selector_ceiling.run_id,
      artifact_type: items.selector_ceiling.artifact_type,
      finding: "cheap_frontier_selector_ceiling_gap",
      metric: "best_qwen_frontier_selection_vs_oracle",
      value: `${items.selector_ceiling.policy_summary.best_qwen_frontier_selection_support_rate}/${items.selector_ceiling.policy_summary.best_qwen_frontier_oracle_supported_rate}`,
      interpretation: "The cheap frontier pool has supported answers but the selector fails to choose them often enough.",
    },
    {
      source_run_id: items.claim_support_verifier.run_id,
      artifact_type: items.claim_support_verifier.artifact_type,
      finding: "lexical_claim_verifier_anti_transfer",
      metric: "final_diagnostic_selection",
      value: `${items.claim_support_verifier.metrics.final_diagnostic_selection.selected_supported}/${items.claim_support_verifier.metrics.final_diagnostic_selection.examples}`,
      interpretation: "A direct claim-support target learns non-final labels but fails final selection.",
    },
    {
      source_run_id: items.claim_nli_support_verifier.run_id,
      artifact_type: items.claim_nli_support_verifier.artifact_type,
      finding: "local_nli_claim_verifier_anti_transfer",
      metric: "final_diagnostic_selection",
      value: `${items.claim_nli_support_verifier.metrics.final_diagnostic_selection.selected_supported}/${items.claim_nli_support_verifier.metrics.final_diagnostic_selection.examples}`,
      interpretation: "Adding local NLI scores does not fix final transfer.",
    },
    {
      source_run_id: items.targeted_boundary_run.run_id,
      artifact_type: items.targeted_boundary_run.artifact_type,
      finding: "boundary_label_disagreement",
      metric: "existing_signal_exact_agreement_rate",
      value: items.targeted_boundary_run.metrics.existing_signal_exact_agreement_rate,
      interpretation: "The existing weak support signal is noisy on boundary rows, so more labels must be narrowly justified.",
    },
    {
      source_run_id: items.targeted_packet_learner.run_id,
      artifact_type: items.targeted_packet_learner.artifact_type,
      finding: "targeted_packet_needs_broad_preservation",
      metric: "status",
      value: items.targeted_packet_learner.status,
      interpretation: "Targeted hard negatives alone are useful as data but unstable as a promoted overlay.",
    },
    {
      source_run_id: items.final_miss_repairability.run_id,
      artifact_type: items.final_miss_repairability.artifact_type,
      finding: "final_misses_are_recoverable_selector_gap",
      metric: "misses_with_supported_candidate",
      value: `${items.final_miss_repairability.summary.misses_with_supported_candidate}/${items.final_miss_repairability.summary.baseline_unsupported}`,
      interpretation: "All remaining mixed-scaffold misses have supported candidates already present.",
    },
  ];
}

function summarizeReadiness(items) {
  const qwenSelection = items.selector_ceiling.policy_summary.best_qwen_frontier_selection_support_rate;
  const qwenOracle = items.selector_ceiling.policy_summary.best_qwen_frontier_oracle_supported_rate;
  const claimFinal = items.claim_support_verifier.metrics.final_diagnostic_selection.selection_support_rate;
  const nliFinal = items.claim_nli_support_verifier.metrics.final_diagnostic_selection.selection_support_rate;
  const boundaryAgreement = items.targeted_boundary_run.metrics.existing_signal_exact_agreement_rate;
  const finalMissesRecoverable = items.final_miss_repairability.summary.misses_without_supported_candidate === 0;
  return {
    status: qwenOracle >= 1 && qwenSelection < 0.75 && claimFinal < 0.5 && nliFinal < 0.5 && boundaryAgreement < 0.75 && finalMissesRecoverable
      ? "balanced_support_verifier_packet_needed"
      : "support_verifier_readiness_mixed",
    qwen_frontier_selection_support_rate: qwenSelection,
    qwen_frontier_oracle_supported_rate: qwenOracle,
    claim_support_final_selection_rate: claimFinal,
    claim_nli_final_selection_rate: nliFinal,
    targeted_boundary_existing_signal_agreement_rate: boundaryAgreement,
    final_misses_all_have_supported_candidates: finalMissesRecoverable,
    old_verifier_target_ready_for_gpu: false,
  };
}

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runsDir, runId, "result.json"), "utf8"));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function renderReport(result) {
  const rows = result.evidence_rows
    .map((row) => `| ${row.source_run_id} | ${row.finding} | ${row.metric} | ${row.value} |`)
    .join("\n");
  return `# Support Verifier Readiness Audit

This audit reconciles existing verifier and selector artifacts before spending on another label batch or GPU run.

## Readiness

- Status: ${result.status}
- Qwen-frontier selected support: ${pct(result.readiness.qwen_frontier_selection_support_rate)}
- Qwen-frontier oracle support: ${pct(result.readiness.qwen_frontier_oracle_supported_rate)}
- Claim verifier final selection: ${pct(result.readiness.claim_support_final_selection_rate)}
- Claim-NLI verifier final selection: ${pct(result.readiness.claim_nli_final_selection_rate)}
- Boundary signal agreement: ${pct(result.readiness.targeted_boundary_existing_signal_agreement_rate)}
- Launch GPU now: ${result.decision.launch_gpu_now ? "yes" : "no"}
- Buy OpenAI labels now: ${result.decision.buy_openai_labels_now ? "yes" : "no"}

## Evidence

| Source | Finding | Metric | Value |
| --- | --- | --- | --- |
${rows}

## Decision

${result.decision.reason}

Next step: ${result.decision.next_step}
`;
}
