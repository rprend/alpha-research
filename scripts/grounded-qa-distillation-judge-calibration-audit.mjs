import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "judge-calibration-audit-2026-06-26-v1";
const outputDir = path.join(runDir, runId);

const sourceRuns = [
  {
    policy: "direct_mini_repair",
    run_id: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1",
  },
  {
    policy: "direct_mini_repair",
    run_id: "openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1",
  },
  {
    policy: "balanced_risk_gate",
    run_id: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1",
  },
  {
    policy: "balanced_risk_gate",
    run_id: "openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1",
  },
  {
    policy: "claim_entailment_guard",
    run_id: "openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1",
  },
];

await fs.mkdir(outputDir, { recursive: true });

const sources = [];
const judgments = [];
for (const source of sourceRuns) {
  const result = await readJson(path.join(runDir, source.run_id, "result.json"));
  const rows = await readJsonl(path.join(runDir, source.run_id, "judgments.jsonl"));
  sources.push({
    policy: source.policy,
    run_id: source.run_id,
    model: result.model,
    calls_made: result.calls_made,
    examples_judged: result.metrics?.examples_judged,
    invalid_judgment_rate: result.metrics?.invalid_judgment_rate,
    answer_support_rate: result.metrics?.answer_support_rate,
    abstention_support_rate: result.metrics?.abstention_support_rate,
    overall_judged_correct_rate: result.metrics?.overall_judged_correct_rate,
  });
  for (const row of rows) judgments.push({ ...row, policy: source.policy, source_run_id: source.run_id });
}

const byExample = new Map();
for (const row of judgments) {
  if (!byExample.has(row.example_id)) byExample.set(row.example_id, []);
  byExample.get(row.example_id).push(row);
}

const unsupportedAnswers = judgments
  .filter((row) => row.prediction_answer_type === "grounded_answer" && row.judgment?.verdict === "unsupported")
  .sort((a, b) => String(a.example_id).localeCompare(String(b.example_id)));
const correctAbstentions = judgments
  .filter((row) => row.prediction_answer_type === "abstain" && row.judgment?.verdict === "correct_abstention")
  .sort((a, b) => String(a.example_id).localeCompare(String(b.example_id)));
const possiblyBadAbstentions = judgments
  .filter((row) => row.prediction_answer_type === "abstain" && row.judgment?.verdict !== "correct_abstention")
  .sort((a, b) => String(a.example_id).localeCompare(String(b.example_id)));
const invalidJudgments = judgments
  .filter((row) => row.judgment?.verdict === "invalid_judgment" || row.judgment?.verdict == null)
  .sort((a, b) => String(a.example_id).localeCompare(String(b.example_id)));

const disagreementRows = [];
for (const [exampleId, rows] of byExample.entries()) {
  const verdicts = new Set(rows.map((row) => row.judgment?.verdict).filter(Boolean));
  const answerTypes = new Set(rows.map((row) => row.prediction_answer_type).filter(Boolean));
  if (verdicts.size > 1 || answerTypes.size > 1) {
    disagreementRows.push({
      example_id: exampleId,
      policies: rows.map(summarizeJudgmentRow).sort((a, b) => a.policy.localeCompare(b.policy)),
      reason: verdicts.size > 1 ? "cross_policy_verdict_disagreement" : "cross_policy_action_disagreement",
    });
  }
}
disagreementRows.sort((a, b) => String(a.example_id).localeCompare(String(b.example_id)));

const auditQueue = [
  ...unsupportedAnswers.slice(0, 8).map((row) => ({ audit_type: "unsupported_answer", ...summarizeJudgmentRow(row) })),
  ...possiblyBadAbstentions.slice(0, 6).map((row) => ({ audit_type: "questionable_abstention", ...summarizeJudgmentRow(row) })),
  ...correctAbstentions.slice(0, 4).map((row) => ({ audit_type: "correct_abstention_sanity_check", ...summarizeJudgmentRow(row) })),
  ...disagreementRows.slice(0, 8).map((row) => ({ audit_type: "cross_policy_disagreement", ...row })),
  ...invalidJudgments.slice(0, 4).map((row) => ({ audit_type: "invalid_judgment", ...summarizeJudgmentRow(row) })),
];

const totalCost = judgments.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "judge_calibration_audit",
  status: "audit_packet_ready",
  purpose: "Create a zero-cost calibration and spot-check packet for existing grounded-correctness judge outputs before relying on model-judged support as paper evidence.",
  source_runs: sources,
  summary: {
    source_runs: sources.length,
    judgments_loaded: judgments.length,
    unique_examples: byExample.size,
    unsupported_answer_rows: unsupportedAnswers.length,
    correct_abstention_rows: correctAbstentions.length,
    questionable_abstention_rows: possiblyBadAbstentions.length,
    invalid_judgment_rows: invalidJudgments.length,
    cross_policy_disagreement_examples: disagreementRows.length,
    audit_queue_rows: auditQueue.length,
    source_judge_cost_usd: totalCost,
  },
  calibration_limits: [
    "This artifact audits existing gpt-4o judge outputs; it does not create independent human labels.",
    "Cross-policy disagreements can be caused by different predictions, not necessarily judge inconsistency.",
    "The final Qwen 3B student still needs its own grounded-correctness judge and optional human spot-check.",
  ],
  recommended_paper_treatment: [
    "Report metrics as model-judged grounded correctness unless independent adjudication is later added.",
    "Include judge prompt/schema and example-level failure categories in the appendix.",
    "Before submission, manually review the audit queue or run an independent second-judge/human audit on the sampled rows.",
  ],
  audit_queue: auditQueue,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit reads existing local judge artifacts only; source judge costs are historical and not new spend.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "audit_queue.jsonl"), `${auditQueue.map((row) => JSON.stringify(row)).join("\n")}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function summarizeJudgmentRow(row) {
  return {
    example_id: row.example_id,
    policy: row.policy,
    source_run_id: row.source_run_id,
    prediction_answer_type: row.prediction_answer_type,
    verdict: row.judgment?.verdict ?? null,
    all_claims_supported: row.judgment?.all_claims_supported ?? null,
    citation_ids_valid: row.judgment?.citation_ids_valid ?? null,
    abstention_supported: row.judgment?.abstention_supported ?? null,
    unsupported_claims: row.judgment?.unsupported_claims ?? [],
    missing_citations: row.judgment?.missing_citations ?? [],
    judge_notes: row.judgment?.notes ?? "",
  };
}

function renderReport(result) {
  return `# Judge Calibration Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

This audit makes no new OpenAI calls. It samples existing judge outputs for manual or independent spot-checking.

## Summary

- Source judge runs: ${result.summary.source_runs}
- Judgments loaded: ${result.summary.judgments_loaded}
- Unique examples: ${result.summary.unique_examples}
- Unsupported answer rows: ${result.summary.unsupported_answer_rows}
- Questionable abstention rows: ${result.summary.questionable_abstention_rows}
- Cross-policy disagreement examples: ${result.summary.cross_policy_disagreement_examples}
- Audit queue rows: ${result.summary.audit_queue_rows}
- Historical source judge cost represented: $${result.summary.source_judge_cost_usd.toFixed(6)}

## Source Runs

| Policy | Run | Examples | Overall judged correct | Answer support | Abstention support | Invalid rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${result.source_runs.map((row) => `| ${row.policy} | \`${row.run_id}\` | ${row.examples_judged} | ${pct(row.overall_judged_correct_rate)} | ${pct(row.answer_support_rate)} | ${pct(row.abstention_support_rate)} | ${pct(row.invalid_judgment_rate)} |`).join("\n")}

## Calibration Limits

${result.calibration_limits.map((item) => `- ${item}`).join("\n")}

## Recommended Paper Treatment

${result.recommended_paper_treatment.map((item) => `- ${item}`).join("\n")}

See \`audit_queue.jsonl\` for the sampled rows.
`;
}

function pct(value) {
  return value == null ? "n/a" : `${(100 * Number(value)).toFixed(1)}%`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
