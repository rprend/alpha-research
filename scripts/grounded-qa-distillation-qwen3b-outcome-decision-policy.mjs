import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "qwen3b-outcome-decision-policy-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const integration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const integrationFixture = await readResult("qwen3b-integration-fixture-audit-2026-06-26-v1");
const syntaxOnly = await readResult("qwen3b-syntax-only-rejection-audit-2026-06-26-v1");
const lossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");
const modelScale = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const noveltyDelta = await readResult("novelty-delta-matrix-2026-06-27-v1");
const finalChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const directBaseline = lossAccounting.qwen_acceptance_contract.must_preserve_or_improve.find((row) => row.dimension === "overall_judged_correct_rate")?.minimum_direct_baseline;
const frontierBaseline = lossAccounting.qwen_acceptance_contract.must_preserve_or_improve.find((row) => row.dimension === "overall_judged_correct_rate")?.minimum_70pct_frontier;

const decisionTree = [
  {
    status: "waiting_for_qwen3b_predictions",
    classification: "not_yet_evidence",
    paper_action: "Do not discuss Qwen 3B quality. Keep all trained-student and amortized-success claims blocked.",
    next_engineering_action: "Repair remote backend auth, run the bounded smoke, fetch predictions/result/report/smoke manifest, then run provenance and integrity gates.",
    allowed_followup_spend: "GPU spend only after remote_backend_ready_for_qwen3b_smoke; no paid judge until predictions pass integrity and dry judge.",
  },
  {
    status: "waiting_for_qwen3b_paid_judge",
    classification: "prediction_only_not_quality_evidence",
    paper_action: "Report no support-preservation claim from predictions alone. Local overlap/citation syntax metrics are diagnostics only.",
    next_engineering_action: "Run remote provenance, prediction integrity, dry judge, and then paid grounded-correctness judge if budget remains under $100.",
    allowed_followup_spend: "Paid judge spend only after integrity_gate_ready and dry_judge_full_coverage.",
  },
  {
    status: "qwen3b_negative_ready_for_pareto_update",
    classification: "negative_result",
    paper_action: "Report the trained Qwen smoke as a negative result. Do not claim support-preserving amortized distillation; update the Pareto table and analyze whether failure is support, coverage, citation, abstention, or JSON/format related.",
    next_engineering_action: "Run failure-mode audit before any larger model or second GPU run. Do not escalate to a cutting-edge model unless the failure mode is capacity-bound rather than data/contract-bound.",
    allowed_followup_spend: "No additional GPU spend without a new decision log entry, failure-mode audit, and budget recheck.",
  },
  {
    status: "qwen3b_minimum_positive_ready_for_pareto_update",
    classification: "minimum_positive",
    paper_action: "Claim only minimum support-preserving evidence: Qwen beats the direct baseline at >=70% answer rate, but does not beat the 70% coverage-constrained frontier. Report this as partial amortization, not a dominant result.",
    next_engineering_action: "Update Pareto, rerun loss accounting, rerun novelty/risk artifacts, and decide whether one bounded follow-up is justified by specific frontier gaps.",
    allowed_followup_spend: "One follow-up only if total planned spend stays under $100 and the follow-up targets the measured frontier gap.",
  },
  {
    status: "qwen3b_strong_positive_ready_for_pareto_update",
    classification: "strong_positive",
    paper_action: "Claim support-preserving amortized grounded QA only with model-judged caveats, provenance, actual cost, novelty refresh, and private-KB scope limitations.",
    next_engineering_action: "Update Pareto, budget, amortization, loss accounting, manuscript, reviewer-risk audit, final claim matrix, and run final novelty refresh.",
    allowed_followup_spend: "Avoid more GPU runs unless reviewers require a direct baseline; preserve budget for final judge/adjudication.",
  },
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen3b_outcome_decision_policy",
  status: "qwen3b_outcome_policy_preregistered",
  purpose: "Pre-register how the project will interpret Qwen 3B smoke outcomes before the paid run, so success criteria, negative-result handling, and model-escalation decisions cannot move after seeing results.",
  source_runs: {
    qwen3b_result_integration_run_id: integration.run_id,
    integration_fixture_audit_run_id: integrationFixture.run_id,
    syntax_only_rejection_audit_run_id: syntaxOnly.run_id,
    distillation_loss_accounting_run_id: lossAccounting.run_id,
    model_scale_adequacy_audit_run_id: modelScale.run_id,
    novelty_delta_matrix_run_id: noveltyDelta.run_id,
    final_evidence_checklist_run_id: finalChecklist.run_id,
  },
  current_integration_status: integration.status,
  preregistered_acceptance_thresholds: {
    minimum_positive: {
      answer_rate_at_least: 0.7,
      answer_support_rate: "greater_than_direct_baseline",
      overall_judged_correct_rate: "greater_than_direct_baseline",
      direct_baseline_overall_judged_correct_rate: directBaseline,
    },
    strong_positive: {
      answer_rate: "at_or_above_70pct_frontier",
      answer_support_rate: "greater_than_70pct_frontier",
      overall_judged_correct_rate: "greater_than_70pct_frontier",
      frontier_overall_judged_correct_rate: frontierBaseline,
    },
    hard_rejections: [
      "Citation syntax or inline-citation rate alone cannot count as success.",
      "A result below 70% answer rate cannot count as support-preserving distillation, even if support rises.",
      "A result without paid grounded-correctness judgments cannot count as quality evidence.",
      "A result without remote provenance and actual cost cannot count as amortized deployment evidence.",
    ],
  },
  decision_tree: decisionTree,
  model_escalation_policy: {
    default_after_negative_qwen3b: "report_negative_before_escalating",
    larger_model_allowed_only_if: [
      "Qwen failure-mode audit shows capacity-limited answer repair rather than citation syntax, data construction, or abstention-threshold failure.",
      "A new budget gate shows total OpenAI plus external compute spend remains below $100.",
      "The larger run has a bounded smoke plan with the same final-window, judge, provenance, and Pareto requirements.",
      "A decision-log entry records why Qwen 3B was inadequate and what the larger model tests that Qwen did not.",
    ],
    prohibited_escalations: [
      "Do not rent a cutting-edge GPU only to improve headline metrics after a negative Qwen result.",
      "Do not treat a larger base model without trained adapter/provenance as a substitute for the planned Qwen smoke.",
      "Do not use tiny/local model outputs as ground-truth labels.",
    ],
  },
  manuscript_policy: {
    if_negative: "Submit only as a negative/diagnostic study if the rest of the paper is framed around why current post-training/scaffold recipes fail to preserve support under update-heldout KB states.",
    if_minimum_positive: "Frame as partial amortization with explicit coverage/support frontier limits and model-judged caveats.",
    if_strong_positive: "Frame as support-preserving amortized grounded QA over a public dated domain-KB proxy, not private-enterprise proof, and still refresh novelty at submission time.",
  },
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
    external_compute_actual_usd: Number(budget.spend_usd?.external_compute),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This policy reads local artifacts only and makes no calls.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  current_integration_status: result.current_integration_status,
  outcomes: result.decision_tree.map((row) => row.status),
}, null, 2));

function renderReport(result) {
  const rows = result.decision_tree.map((row) => `| ${row.status} | ${row.classification} | ${row.paper_action} | ${row.next_engineering_action} |`).join("\n");
  return `# Qwen 3B Outcome Decision Policy

Generated: ${result.generated_at}

Status: \`${result.status}\`

Current integration status: \`${result.current_integration_status}\`

## Decision Tree

| Integration Status | Classification | Paper Action | Next Engineering Action |
| --- | --- | --- | --- |
${rows}

## Hard Rejections

${result.preregistered_acceptance_thresholds.hard_rejections.map((item) => `- ${item}`).join("\n")}

## Model Escalation Policy

Default after negative Qwen 3B: \`${result.model_escalation_policy.default_after_negative_qwen3b}\`

Allowed only if:

${result.model_escalation_policy.larger_model_allowed_only_if.map((item) => `- ${item}`).join("\n")}

Prohibited:

${result.model_escalation_policy.prohibited_escalations.map((item) => `- ${item}`).join("\n")}

No OpenAI calls, GPU jobs, or new spend were made for this policy.
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
