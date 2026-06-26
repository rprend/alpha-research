import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const secondPassRunId = args["second-pass-run-id"] ?? "judge-reliability-second-pass-run-2026-06-26-v2";
const runId = args["run-id"] ?? "abstention-boundary-reliability-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const secondPass = await readResult(secondPassRunId);
const secondPassRows = await readJsonl(path.join(runDir, secondPassRunId, "second_pass_results.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const rows = secondPassRows.filter((row) => !row.skipped);
const byAuditType = summarizeBy(rows, (row) => row.audit_type);
const byPolicy = summarizeBy(rows, (row) => row.policy);
const byPolicyAndType = {};
for (const row of rows) {
  const key = `${row.policy}:${row.audit_type}`;
  byPolicyAndType[key] ??= bucket();
  addToBucket(byPolicyAndType[key], row);
}
finalizeBuckets(byPolicyAndType);

const questionable = byAuditType.questionable_abstention ?? bucket();
const stableBuckets = Object.entries(byAuditType)
  .filter(([, value]) => value.examples > 0 && value.exact_agreement_rate >= 0.75)
  .map(([key]) => key);
const unstableBuckets = Object.entries(byAuditType)
  .filter(([, value]) => value.examples > 0 && value.exact_agreement_rate < 0.5)
  .map(([key]) => key);

const disagreementExamples = secondPass.agreement.disagreements
  .filter((row) => row.audit_type === "questionable_abstention")
  .map((row) => ({
    packet_id: row.packet_id,
    case_id: row.case_id,
    policy: row.policy,
    original_verdict: row.original_verdict,
    second_pass_verdict: row.second_pass_verdict,
    rationale: row.rationale,
  }));

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "abstention_boundary_reliability_audit",
  status: "abstention_boundary_unstable",
  purpose: "Translate the blind second-pass judge result into concrete manuscript constraints for abstention and coverage claims.",
  source_second_pass_run_id: secondPass.run_id,
  source_model: secondPass.model,
  calls_made: secondPass.calls_made,
  run_cost_usd: secondPass.run_cost_usd,
  overall_exact_agreement_rate: secondPass.agreement.exact_agreement_rate,
  schema_violations: secondPass.schema_violations,
  by_audit_type: byAuditType,
  by_policy: byPolicy,
  by_policy_and_audit_type: byPolicyAndType,
  stable_buckets: stableBuckets,
  unstable_buckets: unstableBuckets,
  key_findings: [
    `Overall exact agreement on hard judge rows is ${pct(secondPass.agreement.exact_agreement_rate)}.`,
    `Unsupported-answer and correct-abstention sanity buckets are relatively stable (${pct(byAuditType.unsupported_answer?.exact_agreement_rate)} and ${pct(byAuditType.correct_abstention_sanity_check?.exact_agreement_rate)} exact agreement).`,
    `Questionable-abstention rows are unstable: ${questionable.exact_agreements ?? 0}/${questionable.examples ?? 0} exact agreement, with the blind second pass judging all six sampled abstentions as correct abstentions.`,
    "Therefore, current scaffold improvements should be reported with answer rate and disagreement examples; abstention-boundary wins should not be treated as settled without human adjudication or a stronger judge.",
  ],
  manuscript_constraints: [
    "Call current support/correctness metrics model-judged, not human-validated.",
    "Report answer rate, abstention support, answer support, and second-pass disagreement together for any gate that suppresses answers.",
    "Do not claim abstention-boundary calibration is solved; describe it as an open limitation.",
    "Use the second-pass disagreement examples to motivate the Qwen 3B joint-action objective rather than another pure suppression gate.",
  ],
  required_next_evidence: [
    "Human-adjudicate the six questionable-abstention rows or rerun them with a stronger independent judge before final submission claims.",
    "For Qwen 3B, report separate answer-support and abstention-support agreement slices.",
    "Add human/private-KB evidence before claiming enterprise-private KB behavior.",
  ],
  disagreement_examples: disagreementExamples,
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
    note: "This audit reads the already-paid second-pass result and makes no new calls.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function summarizeBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row);
    out[key] ??= bucket();
    addToBucket(out[key], row);
  }
  finalizeBuckets(out);
  return out;
}

function bucket() {
  return {
    examples: 0,
    exact_agreements: 0,
    original_supported: 0,
    second_supported: 0,
    second_partial_or_unsupported: 0,
    second_correct_abstention: 0,
    second_incorrect_abstention: 0,
  };
}

function addToBucket(target, row) {
  target.examples += 1;
  if (row.judgment?.verdict === row.original_verdict) target.exact_agreements += 1;
  if (row.original_verdict === "supported") target.original_supported += 1;
  if (row.judgment?.verdict === "supported") target.second_supported += 1;
  if (["partial", "unsupported"].includes(row.judgment?.verdict)) target.second_partial_or_unsupported += 1;
  if (row.judgment?.verdict === "correct_abstention") target.second_correct_abstention += 1;
  if (row.judgment?.verdict === "incorrect_abstention") target.second_incorrect_abstention += 1;
}

function finalizeBuckets(buckets) {
  for (const bucket of Object.values(buckets)) {
    bucket.exact_agreement_rate = bucket.examples ? bucket.exact_agreements / bucket.examples : 0;
  }
}

function renderReport(result) {
  return `# Abstention Boundary Reliability Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source second-pass run: \`${result.source_second_pass_run_id}\`

## Findings

${result.key_findings.map((item) => `- ${item}`).join("\n")}

## Agreement By Audit Type

| Audit type | Cases | Exact agreement | Exact agreement rate | Second-pass supported | Second-pass correct abstention |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(result.by_audit_type).map(([key, row]) => `| ${key} | ${row.examples} | ${row.exact_agreements} | ${pct(row.exact_agreement_rate)} | ${row.second_supported} | ${row.second_correct_abstention} |`).join("\n")}

## Manuscript Constraints

${result.manuscript_constraints.map((item) => `- ${item}`).join("\n")}

## Required Next Evidence

${result.required_next_evidence.map((item) => `- ${item}`).join("\n")}

This audit makes no OpenAI calls, launches no GPU jobs, and records no new spend.
`;
}

async function readResult(runId) {
  return readJson(path.join(runDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
