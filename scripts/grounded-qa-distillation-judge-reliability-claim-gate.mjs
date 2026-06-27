import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "judge-reliability-claim-gate-2026-06-27-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const secondPass = await readResult("judge-reliability-second-pass-run-2026-06-26-v2");
const taxonomy = await readResult("judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2");
const abstention = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");
const packet = await readResult("judge-adjudication-packet-2026-06-26-v1");
const adjudicationRows = await readJsonl(path.join(runDir, packet.run_id, "adjudication_packet.jsonl"));

const disagreementCases = taxonomy.disagreement_examples ?? [];
const disagreementIds = new Set(disagreementCases.map((row) => row.case_id));
const questionableIds = new Set((abstention.disagreement_examples ?? []).map((row) => row.case_id));
const packetRowsById = new Map();
for (const row of adjudicationRows) {
  for (const item of row.cases ?? []) {
    const caseId = `${row.packet_id}-case-${String((row.cases ?? []).indexOf(item) + 1).padStart(2, "0")}`;
    packetRowsById.set(caseId, { packet: row, case: item, case_id: caseId });
  }
}

const priorityRows = disagreementCases.map((row) => {
  const joined = packetRowsById.get(row.case_id);
  return {
    priority: row.category === "abstention_boundary_reversal" ? "P0" : "P1",
    reason: row.category === "abstention_boundary_reversal"
      ? "abstention_boundary_instability_blocks_calibration_claims"
      : "support_boundary_disagreement_needs_spot_adjudication",
    case_id: row.case_id,
    packet_id: row.packet_id,
    audit_type: row.audit_type,
    policy: row.policy,
    category: row.category,
    original_verdict: row.original_verdict,
    second_pass_verdict: row.second_pass_verdict,
    question: row.question,
    example_id: row.example_id,
    reference_answer_type: row.reference_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    cited_evidence_ids: row.cited_evidence_ids ?? [],
    evidence_count: joined?.packet?.compact_retrieved_evidence_pack?.length ?? null,
  };
});

const exactAgreementRate = Number(secondPass.agreement?.exact_agreement_rate);
const disagreementRate = Number(taxonomy.source_summary?.disagreement_rate);
const questionable = abstention.by_audit_type?.questionable_abstention;
const unsupported = abstention.by_audit_type?.unsupported_answer;
const sanity = abstention.by_audit_type?.correct_abstention_sanity_check;
const crossPolicy = abstention.by_audit_type?.cross_policy_disagreement;

const acceptanceThresholds = {
  minimum_overall_exact_agreement_rate_for_uncaveated_model_judge_claim: 0.85,
  maximum_questionable_abstention_disagreement_count_for_abstention_calibration_claim: 0,
  required_human_or_stronger_judge_priority_rows: priorityRows.length,
};

const canClaimHumanValidatedCorrectness = false;
const canClaimAbstentionBoundarySolved = false;
const modelJudgeAllowedForScreening = exactAgreementRate >= 0.75
  && Number(unsupported?.exact_agreement_rate) >= 0.75
  && Number(sanity?.exact_agreement_rate) >= 0.75
  && Number(crossPolicy?.exact_agreement_rate) >= 0.75;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_reliability_claim_gate",
  status: "judge_reliability_requires_final_adjudication",
  purpose: "Convert the existing blind second-pass judge reliability evidence into an executable claim boundary for model-judged grounded-correctness metrics.",
  source_runs: {
    second_pass_run_id: secondPass.run_id,
    taxonomy_run_id: taxonomy.run_id,
    abstention_boundary_audit_run_id: abstention.run_id,
    adjudication_packet_run_id: packet.run_id,
  },
  summary: {
    compared_cases: Number(secondPass.agreement?.compared_cases),
    exact_agreements: Number(secondPass.agreement?.exact_agreements),
    exact_agreement_rate: exactAgreementRate,
    disagreements: Number(taxonomy.source_summary?.disagreements),
    disagreement_rate: disagreementRate,
    questionable_abstention_examples: Number(questionable?.examples),
    questionable_abstention_exact_agreement_rate: Number(questionable?.exact_agreement_rate),
    priority_adjudication_rows: priorityRows.length,
    p0_abstention_boundary_rows: priorityRows.filter((row) => row.priority === "P0").length,
    p1_support_boundary_rows: priorityRows.filter((row) => row.priority === "P1").length,
  },
  acceptance_thresholds: acceptanceThresholds,
  claim_permissions: {
    model_judged_screening_metrics_allowed: modelJudgeAllowedForScreening,
    human_validated_correctness_claim_allowed: canClaimHumanValidatedCorrectness,
    uncaveated_model_judge_correctness_claim_allowed: exactAgreementRate >= acceptanceThresholds.minimum_overall_exact_agreement_rate_for_uncaveated_model_judge_claim && priorityRows.length === 0,
    abstention_boundary_solved_claim_allowed: canClaimAbstentionBoundarySolved,
    qwen3b_final_claim_requires_this_gate_in_limitations: true,
  },
  stable_enough_for_current_reporting: [
    {
      metric_family: "unsupported_answer_support_screening",
      status: Number(unsupported?.exact_agreement_rate) >= 0.75 ? "usable_with_model_judged_caveat" : "too_unstable",
      evidence: `${Number(unsupported?.exact_agreements)}/${Number(unsupported?.examples)} exact agreement on unsupported-answer hard rows.`,
    },
    {
      metric_family: "correct_abstention_sanity_checks",
      status: Number(sanity?.exact_agreement_rate) >= 0.75 ? "usable_with_model_judged_caveat" : "too_unstable",
      evidence: `${Number(sanity?.exact_agreements)}/${Number(sanity?.examples)} exact agreement on correct-abstention sanity checks.`,
    },
    {
      metric_family: "cross_policy_relative_screening",
      status: Number(crossPolicy?.exact_agreement_rate) >= 0.75 ? "usable_with_model_judged_caveat" : "too_unstable",
      evidence: `${Number(crossPolicy?.exact_agreements)}/${Number(crossPolicy?.examples)} exact agreement on cross-policy disagreement rows.`,
    },
  ],
  not_stable_enough_for_current_reporting: [
    {
      metric_family: "abstention_boundary_calibration",
      status: "requires_human_or_stronger_judge",
      evidence: `${Number(questionable?.exact_agreements)}/${Number(questionable?.examples)} exact agreement on questionable-abstention rows; ${questionableIds.size} P0 rows require adjudication.`,
    },
    {
      metric_family: "human_validated_absolute_correctness",
      status: "requires_human_adjudication",
      evidence: "All completed correctness metrics are model-judged; no human adjudication file is present.",
    },
  ],
  priority_adjudication: {
    rows_total: priorityRows.length,
    p0_rows: priorityRows.filter((row) => row.priority === "P0").length,
    p1_rows: priorityRows.filter((row) => row.priority === "P1").length,
    output_path: path.relative(rootDir, path.join(outputDir, "priority_adjudication.jsonl")),
    includes_all_taxonomy_disagreements: priorityRows.length === disagreementIds.size,
  },
  required_before_submission_claim: [
    "Adjudicate all P0 abstention-boundary rows with a human or stronger independent judge before claiming abstention calibration is solved.",
    "Spot-adjudicate P1 support-boundary rows before treating unsupported/support rates as human truth.",
    "Report judge prompts, schemas, model, exact-agreement rate, disagreement taxonomy, and examples in the paper.",
    "Label Qwen 3B support metrics as model-judged unless a human/stronger-judge adjudication file closes this gate.",
  ],
  manuscript_constraints: [
    "Use 'model-judged grounded correctness' for current metrics.",
    "Do not use 'human-validated' or 'gold correctness' for model-judge outputs.",
    "Report answer support, abstention support, answer rate, and judge disagreement together.",
    "Describe abstention-boundary calibration as unresolved unless the P0 queue is adjudicated.",
  ],
  budget: {
    max_budget_usd: Number(budget.max_budget_usd),
    actual_total_spend_usd: Number(budget.spend_usd?.total_actual),
    remaining_budget_usd: Number(budget.spend_usd?.remaining),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This gate reuses existing second-pass and taxonomy artifacts and makes no new calls.",
  },
};

await fs.writeFile(path.join(outputDir, "priority_adjudication.jsonl"), `${priorityRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  exact_agreement_rate: result.summary.exact_agreement_rate,
  priority_rows: result.priority_adjudication.rows_total,
  p0_rows: result.priority_adjudication.p0_rows,
}, null, 2));

function renderReport(result) {
  return `# Judge Reliability Claim Gate

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Summary

| Compared cases | Exact agreement | Disagreement rate | P0 rows | P1 rows |
| ---: | ---: | ---: | ---: | ---: |
| ${result.summary.compared_cases} | ${(100 * result.summary.exact_agreement_rate).toFixed(1)}% | ${(100 * result.summary.disagreement_rate).toFixed(1)}% | ${result.summary.p0_abstention_boundary_rows} | ${result.summary.p1_support_boundary_rows} |

## Claim Permissions

| Claim | Allowed |
| --- | --- |
| Model-judged screening metrics with caveat | ${result.claim_permissions.model_judged_screening_metrics_allowed ? "yes" : "no"} |
| Human-validated correctness | ${result.claim_permissions.human_validated_correctness_claim_allowed ? "yes" : "no"} |
| Uncaveated model-judge correctness | ${result.claim_permissions.uncaveated_model_judge_correctness_claim_allowed ? "yes" : "no"} |
| Abstention boundary solved | ${result.claim_permissions.abstention_boundary_solved_claim_allowed ? "yes" : "no"} |

## Required Before Submission Claim

${result.required_before_submission_claim.map((item) => `- ${item}`).join("\n")}

## Manuscript Constraints

${result.manuscript_constraints.map((item) => `- ${item}`).join("\n")}

Priority adjudication rows are written to \`${result.priority_adjudication.output_path}\`.

No OpenAI calls, GPU jobs, or new spend were made for this gate.
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
  return text.split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
