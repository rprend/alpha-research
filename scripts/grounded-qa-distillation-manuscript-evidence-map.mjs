import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "manuscript-evidence-map-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const trustedDates = await readResult("trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1");
const transfer = await readResult("risk-gate-transfer-synthesis-240-389-v1");
const guard = await readResult("claim-entailment-guard-validation-240-389-v1");
const miniVerifier = await readResult("mini-verifier-gate-balanced-risk-gate-240-389-v1");
const drag = await readResult("drag-like-rag-distillation-comparison-2026-06-26-v1");
const longcite = await readResult("longcite-style-citation-sft-comparison-2026-06-26-v1");
const writeback = await readResult("writeback-kb-amortization-scoped-exclusion-2026-06-26-v1");
const policyAblation = await readResult("post-training-policy-ablation-2026-06-26-v1");
const coverageFrontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const packetQualityAudit = await readResult("joint-action-packet-quality-audit-2026-06-26-v1");
const qwenLaunch = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const qwenRemote = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1");
const qwenPipeline = await readResult("qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1");
const abstentionReliability = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const futureHoldout = await readJson(path.join(experimentDir, "data", "extended_temporal_future_holdout-manifest.json"));

const passed = readiness.summary.passed;
const failed = readiness.summary.failed;
const blockers = readiness.top_blockers.map((row) => row.id);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "manuscript_evidence_map",
  purpose: "Map current grounded-QA distillation artifacts to manuscript claims, tables, and blocked claims without overclaiming missing Qwen 3B results.",
  readiness: {
    gate_run_id: readiness.run_id,
    passed_requirements: passed,
    failed_requirements: failed,
    status: readiness.summary.current_status,
    blockers,
  },
  dataset_and_temporal_claims: {
    source_dataset: "allenai/qasper",
    domain: "NLP research papers",
    final_holdout_examples: futureHoldout.examples_written,
    final_holdout_papers: futureHoldout.paper_count,
    trusted_snapshot_run_id: trustedDates.run_id,
    trusted_papers_checked: trustedDates.papers_checked,
    trusted_papers_with_dates: trustedDates.papers_with_trusted_dates,
    trusted_months: trustedDates.trusted_months,
    allowed_claim: "The final evaluation window is a public, dated arXiv/QASPER proxy for an evolving domain KB, not a private enterprise KB.",
  },
  current_main_results: {
    zero_call_risk_gate_transfer: {
      run_id: transfer.run_id,
      scope: transfer.scope,
      direct_correct_rate: transfer.aggregate.direct.overall_judged_correct_rate,
      gate_correct_rate: transfer.aggregate.gate.overall_judged_correct_rate,
      direct_answer_support_rate: transfer.aggregate.direct.answer_support_rate,
      gate_answer_support_rate: transfer.aggregate.gate.answer_support_rate,
      answered_delta: transfer.deltas.answered_delta,
      interpretation: "Support-aware zero-call gating improves judged correctness and answer support over direct mini repair, but trades off answer coverage and recall.",
    },
    deterministic_claim_entailment_guard: {
      run_id: guard.run_id,
      direct_correct_rate: guard.policies.direct_mini_repair.overall_judged_correct_rate,
      gate_correct_rate: guard.policies.balanced_risk_gate.overall_judged_correct_rate,
      guard_correct_rate: guard.policies.claim_entailment_guard.overall_judged_correct_rate,
      guard_answer_support_rate: guard.policies.claim_entailment_guard.answer_support_rate,
      guard_answered: guard.policies.claim_entailment_guard.answered,
      suppressed_unsupported_answers: guard.guard_summary.suppressed_unsupported_answers,
      harmful_suppressed_supported_answers: guard.guard_summary.harmful_suppressed_supported_answers,
      interpretation: "A deterministic claim/evidence guard adds a small support gain over the balanced gate, again by suppressing answers.",
    },
    mini_verifier_teacher_step: {
      run_id: miniVerifier.run_id,
      source_mini_judge_calls: miniVerifier.source_mini_judge_calls,
      source_mini_judge_cost_usd: miniVerifier.source_mini_judge_cost_usd,
      combined_correct_rate: miniVerifier.aggregate.combined_verifier_gate.correct_rate,
      interpretation: "The mini verifier is useful as a label-construction or teacher step, not as the final amortized student because it adds per-query LLM calls.",
    },
    post_training_policy_ablation: {
      run_id: policyAblation.run_id,
      status: policyAblation.status,
      best_current_family: policyAblation.ranking_by_weighted_overall_judged_correctness[0],
      direct_answer_rate: policyAblation.families.find((row) => row.id === "direct_compact_rag_student_with_citation_repair")?.aggregate.answer_rate,
      direct_answer_support_rate: policyAblation.families.find((row) => row.id === "direct_compact_rag_student_with_citation_repair")?.aggregate.answer_support_rate,
      risk_gate_answer_rate: policyAblation.families.find((row) => row.id === "support_risk_gated_labels")?.aggregate.answer_rate,
      risk_gate_answer_support_rate: policyAblation.families.find((row) => row.id === "support_risk_gated_labels")?.aggregate.answer_support_rate,
      qwen3b_acceptance_metric: policyAblation.qwen3b_training_implication.acceptance_metric,
      interpretation: "Historical judged ablation says support-risk contrast is the strongest data-construction direction, but the final trained student must recover coverage rather than only learning to abstain.",
    },
    coverage_constrained_frontier: {
      run_id: coverageFrontier.run_id,
      status: coverageFrontier.status,
      direct_baseline: coverageFrontier.qwen3b_acceptance_target.direct_baseline,
      seventy_percent_operating_point: coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7)?.selected,
      current_gate_floor: coverageFrontier.qwen3b_acceptance_target.current_gate_floor,
      qwen3b_recommended_minimum: coverageFrontier.qwen3b_acceptance_target.recommended_minimum,
      interpretation: "The support/coverage tradeoff is binding; Qwen 3B should be compared against a 70% answer-rate frontier, not only against the low-coverage support-first gate.",
    },
    joint_action_packet_quality: {
      run_id: packetQualityAudit.run_id,
      status: packetQualityAudit.status,
      sft_rows: packetQualityAudit.aggregate.sft.rows,
      dpo_rows: packetQualityAudit.aggregate.dpo.rows,
      dpo_chosen_grounded_answer_rows: packetQualityAudit.aggregate.dpo.chosen_grounded_answer_rows,
      dpo_chosen_abstain_rows: packetQualityAudit.aggregate.dpo.chosen_abstain_rows,
      train_eval_paper_overlap: packetQualityAudit.aggregate.train_eval_paper_overlap.length,
      interpretation: "The Qwen 3B packet passes a zero-cost pre-launch audit for repair/abstain preference coverage, inline citations, and train/eval paper separation.",
    },
  },
  related_work_positioning: {
    drag_like: {
      run_id: drag.run_id,
      closest_direct_correct_rate: drag.systems.find((row) => row.id === "direct_mini_rag_student")?.support_metrics?.overall_judged_correct_rate,
      risk_gate_correct_rate: drag.systems.find((row) => row.id === "zero_call_risk_gate_over_direct_student")?.support_metrics?.overall_judged_correct_rate,
      claim: drag.synthesis.conclusion_for_paper,
    },
    longcite_style: {
      run_id: longcite.run_id,
      headline: longcite.synthesis.headline,
      key_gap: longcite.synthesis.syntax_support_gap,
    },
    writeback_scope: {
      run_id: writeback.run_id,
      status: writeback.status,
      scoped_reason: writeback.related_work_framing.exclusion_reason,
    },
  },
  qwen3b_required_final_result: {
    launch_plan_run_id: qwenLaunch.run_id,
    remote_smoke_plan_run_id: qwenRemote.run_id,
    post_smoke_pipeline_run_id: qwenPipeline.run_id,
    base_model: qwenLaunch.base_model,
    planned_gpu_estimate_usd: qwenRemote.budget_context.planned_gpu_estimate_usd,
    planned_judge_estimate_usd: qwenRemote.budget_context.planned_judge_estimate_usd,
    estimated_total_after_smoke_and_judge_usd: qwenRemote.budget_context.estimated_total_after_smoke_and_judge_usd,
    current_pipeline_status: qwenPipeline.conclusion.status,
    blocked_claims: [
      "A trained Qwen 3B joint-action student improves citation-grounded correctness.",
      "Joint-action SFT/DPO preserves support better than the zero-call scaffold baselines.",
      "The final system is NeurIPS-ready.",
    ],
    unblock_commands: {
      smoke: qwenRemote.command,
      post_smoke_default: qwenPipeline.commands.integrity_gate,
      post_smoke_pipeline: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=${qwenPipeline.prediction_run_id} --packet-run-id=${qwenPipeline.packet_run_id} --run-id=${qwenPipeline.run_id} --model=${qwenPipeline.model} --split=${qwenPipeline.split} --max-budget-usd=100`,
      paid_pipeline: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=${qwenPipeline.prediction_run_id} --packet-run-id=${qwenPipeline.packet_run_id} --run-id=${qwenPipeline.run_id} --model=${qwenPipeline.model} --split=${qwenPipeline.split} --max-budget-usd=100 --run-paid=true`,
    },
  },
  judge_reliability_constraints: {
    run_id: abstentionReliability.run_id,
    source_second_pass_run_id: abstentionReliability.source_second_pass_run_id,
    overall_exact_agreement_rate: abstentionReliability.overall_exact_agreement_rate,
    unstable_buckets: abstentionReliability.unstable_buckets,
    questionable_abstention_exact_agreement_rate: abstentionReliability.by_audit_type.questionable_abstention.exact_agreement_rate,
    constraints: abstentionReliability.manuscript_constraints,
    interpretation: "The second-pass judge supports reporting unsupported-answer checks, but abstention-boundary claims remain unstable and must be caveated.",
  },
  manuscript_outline: [
    {
      section: "Introduction",
      evidence: ["Problem framing from README", "D101 novelty narrowing", "novelty-watchlist-2026-06-26-v1"],
      current_status: "draftable",
    },
    {
      section: "Dataset and Evolving-KB Protocol",
      evidence: [trustedDates.run_id, "extended_temporal_future_holdout-manifest.json"],
      current_status: "draftable_with_public_proxy_caveat",
    },
    {
      section: "Post-Training Data Construction",
      evidence: ["teacher/repaired label exports", policyAblation.run_id, coverageFrontier.run_id, packetQualityAudit.run_id, "support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1", qwenLaunch.packet_run_id],
      current_status: "draftable",
    },
    {
      section: "Baselines and Ablations",
      evidence: [drag.run_id, longcite.run_id, writeback.run_id, transfer.run_id, guard.run_id],
      current_status: "draftable",
    },
    {
      section: "Final Trained Student Result",
      evidence: [qwenRemote.expected_artifacts.predictions_jsonl, qwenPipeline.paid_judge_run_id],
      current_status: "blocked_until_qwen3b_smoke_and_judge",
    },
    {
      section: "Limitations and Threat Model",
      evidence: ["public arXiv proxy, not private KB", abstentionReliability.run_id, "coverage/support tradeoff", "remote GPU auth blocker"],
      current_status: "draftable",
    },
  ],
  allowed_claims_now: [
    "Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.",
    "Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.",
    "A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases, but abstention-boundary cases remain unstable.",
    "The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.",
  ],
  claims_to_avoid_until_qwen3b: [
    "A smaller trained model has been shown to preserve citation-grounded correctness.",
    "Joint-action SFT/DPO beats the existing scaffolds.",
    "The work is ready as a NeurIPS submission.",
    "The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.",
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
    note: "This manuscript evidence map reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function renderReport(result) {
  return `# Manuscript Evidence Map

Generated: ${result.generated_at}

Status: \`${result.readiness.status}\` (${result.readiness.passed_requirements}/${result.readiness.passed_requirements + result.readiness.failed_requirements} readiness requirements passing)

## What Can Be Claimed Now

${result.allowed_claims_now.map((claim) => `- ${claim}`).join("\n")}

## Claims To Avoid

${result.claims_to_avoid_until_qwen3b.map((claim) => `- ${claim}`).join("\n")}

## Main Current Result

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | ${pct(result.current_main_results.deterministic_claim_entailment_guard.direct_correct_rate)} | ${pct(result.current_main_results.zero_call_risk_gate_transfer.direct_answer_support_rate)} | ${guardNumber(guard.policies.direct_mini_repair.answered)} |
| Balanced zero-call risk gate | ${pct(result.current_main_results.deterministic_claim_entailment_guard.gate_correct_rate)} | ${pct(result.current_main_results.zero_call_risk_gate_transfer.gate_answer_support_rate)} | ${guardNumber(guard.policies.balanced_risk_gate.answered)} |
| Risk gate + deterministic claim-entailment guard | ${pct(result.current_main_results.deterministic_claim_entailment_guard.guard_correct_rate)} | ${pct(result.current_main_results.deterministic_claim_entailment_guard.guard_answer_support_rate)} | ${guardNumber(result.current_main_results.deterministic_claim_entailment_guard.guard_answered)} |

## Required Final Result

- Base model: \`${result.qwen3b_required_final_result.base_model}\`
- Current pipeline status: \`${result.qwen3b_required_final_result.current_pipeline_status}\`
- Estimated total after GPU smoke and judge: $${result.qwen3b_required_final_result.estimated_total_after_smoke_and_judge_usd.toFixed(4)}

The Qwen 3B result and its grounded-correctness judge are still missing. The manuscript must not claim a trained-student win until those artifacts exist.

## Manuscript Outline Status

| Section | Status | Evidence |
| --- | --- | --- |
${result.manuscript_outline.map((row) => `| ${row.section} | ${row.current_status} | ${row.evidence.join("<br>")} |`).join("\n")}

## Budget

- Actual total spend: $${result.budget.actual_total_spend_usd.toFixed(6)}
- External compute spend: $${result.budget.external_compute_actual_usd.toFixed(6)}
- Remaining: $${result.budget.remaining_budget_usd.toFixed(6)}

This evidence map makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function guardNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "n/a";
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
