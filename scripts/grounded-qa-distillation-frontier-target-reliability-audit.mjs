import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const frontierRunId = args["frontier-run"] ?? "openai-evidence-first-frontier-gpt54-targeted-2026-06-29-v1";
const contractGateRunId = args["contract-gate-run"] ?? `${frontierRunId}-evidence-first-contract-gate`;
const judgeRunId = args["judge-run"] ?? "openai-judge-frontier-gpt54-targeted-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-target-reliability-audit-gpt54-targeted-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const frontier = await readJson(path.join(runsDir, frontierRunId, "result.json"));
const contractGate = await readJson(path.join(runsDir, contractGateRunId, "result.json"));
const judge = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const scoredRows = await readJsonl(path.join(runsDir, contractGateRunId, "scored_predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const auditRows = scoredRows.map((row) => {
  const judgment = judgmentById.get(row.example_id);
  const judgedCorrect = judgment?.judgment?.verdict === "supported"
    ? judgment.judgment.all_claims_supported && judgment.judgment.citation_ids_valid
    : judgment?.judgment?.verdict === "correct_abstention" && judgment.judgment.abstention_supported;
  return {
    example_id: row.example_id,
    target_answer_type: row.target_answer_type,
    prediction_answer_type: row.prediction_answer_type,
    contract_correct: row.contract_correct,
    answer_type_correct: row.answer_type_correct,
    citation_set_exact: row.citation_set_exact,
    judge_verdict: judgment?.judgment?.verdict ?? null,
    judged_correct: Boolean(judgedCorrect),
    frontier_answer: row.prediction?.answer ?? "",
    frontier_missing_support: row.prediction?.evidence_first?.missing_support ?? row.prediction?.abstention_reason ?? "",
  };
});

const contractFails = auditRows.filter((row) => !row.contract_correct);
const judgedCorrectContractFails = contractFails.filter((row) => row.judged_correct);
const targetAnswerabilityConflicts = auditRows.filter((row) =>
  row.target_answer_type === "grounded_answer"
  && row.prediction_answer_type === "abstain"
  && row.judged_correct
);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_target_reliability_audit",
  status: targetAnswerabilityConflicts.length >= 5 ? "diagnostic_targets_over_answer_relative_to_evidence" : "target_reliability_not_rejected",
  source_runs: {
    frontier_run_id: frontierRunId,
    contract_gate_run_id: contractGateRunId,
    judge_run_id: judgeRunId,
  },
  metrics: {
    examples: auditRows.length,
    frontier_calls_made: frontier.calls_made,
    frontier_run_cost_usd: frontier.run_cost_usd,
    judge_calls_made: judge.calls_made,
    judge_run_cost_usd: judge.run_cost_usd,
    contract_overall_correct_rate: contractGate.metrics.overall_contract_correct_rate,
    contract_evidence_first_valid_rate: contractGate.metrics.evidence_first_valid_rate,
    contract_answer_type_accuracy: contractGate.metrics.answer_type_accuracy,
    judge_overall_correct_rate: judge.metrics.overall_judged_correct_rate,
    judge_abstention_support_rate: judge.metrics.abstention_support_rate,
    contract_failures_judged_correct: judgedCorrectContractFails.length,
    target_answerability_conflicts: targetAnswerabilityConflicts.length,
  },
  interpretation: {
    qwen3b_failure_reinterpreted: "Qwen3B still failed to learn the schema/citation contract, but the frontier result shows the diagnostic answerability labels are also too permissive on this slice.",
    target_fixture_status: "Do not use the 10-row evidence-first diagnostic target as a sole ground truth for answerability. It is useful for schema/citation shape checks only after target reliability repair.",
    next_step: "Build a target-reliability repair packet: adjudicate answerability before using targets for student training or contract pass/fail. Prefer frontier/judge-agreed evidence-first traces as teacher data.",
  },
  decision: {
    promote_frontier_teacher_traces_for_distillation: false,
    buy_more_openai_judgments_now: false,
    launch_prime_now: false,
    repair_diagnostic_targets_next: true,
    reason: "Frontier predictions pass the independent judge but fail the target-based contract mostly by abstaining where the target expects answers.",
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
    note: "This audit reads already-ledgered frontier and judge outputs.",
    inherited_frontier_openai_calls: frontier.calls_made,
    inherited_frontier_openai_cost_usd: frontier.run_cost_usd,
    inherited_judge_openai_calls: judge.calls_made,
    inherited_judge_openai_cost_usd: judge.run_cost_usd,
  },
  artifacts: {
    audit_rows_jsonl: rel(path.join(outputDir, "audit_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "audit_rows.jsonl"), auditRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  metrics: result.metrics,
  decision: result.decision,
}, null, 2));

function renderReport(result) {
  return `# Frontier Target Reliability Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source Runs

- Frontier: \`${result.source_runs.frontier_run_id}\`
- Contract gate: \`${result.source_runs.contract_gate_run_id}\`
- Judge: \`${result.source_runs.judge_run_id}\`

## Metrics

- Examples: ${result.metrics.examples}
- Contract overall correct: ${pct(result.metrics.contract_overall_correct_rate)}
- Contract evidence-first valid: ${pct(result.metrics.contract_evidence_first_valid_rate)}
- Contract answer type accuracy: ${pct(result.metrics.contract_answer_type_accuracy)}
- Judge overall correct: ${pct(result.metrics.judge_overall_correct_rate)}
- Judge abstention support: ${pct(result.metrics.judge_abstention_support_rate)}
- Contract failures judged correct: ${result.metrics.contract_failures_judged_correct}
- Target answerability conflicts: ${result.metrics.target_answerability_conflicts}

## Interpretation

${result.interpretation.target_fixture_status}

${result.interpretation.next_step}

## Decision

- Promote frontier teacher traces now: ${result.decision.promote_frontier_teacher_traces_for_distillation ? "yes" : "no"}
- Buy more OpenAI judgments now: ${result.decision.buy_more_openai_judgments_now ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Repair diagnostic targets next: ${result.decision.repair_diagnostic_targets_next ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, rows) {
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
