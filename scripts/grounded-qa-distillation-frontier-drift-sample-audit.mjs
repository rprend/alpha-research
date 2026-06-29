import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "frontier-drift-sample-packet-2026-06-29-v1";
const frontierRunId = args["frontier-run"] ?? "openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v1";
const judgeRunId = args["judge-run"] ?? "openai-packet-judge-frontier-gpt54-drift-sample-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-drift-sample-audit-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const packet = await readJson(path.join(runsDir, packetRunId, "result.json"));
const frontier = await readJson(path.join(runsDir, frontierRunId, "result.json"));
const judge = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const prompts = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, packetRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const predictions = await readJsonl(path.join(runsDir, frontierRunId, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const promptById = new Map(prompts.map((row) => [row.example_id, row]));
const targetById = new Map(targets.map((row) => [row.example_id, row]));
const predictionById = new Map(predictions.map((row) => [row.example_id, row]));
const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));

const auditRows = prompts.map((prompt) => {
  const target = targetById.get(prompt.example_id)?.target;
  const prediction = predictionById.get(prompt.example_id)?.prediction;
  const judgment = judgmentById.get(prompt.example_id);
  const judgedCorrect = isJudgedCorrect(prediction, judgment?.judgment);
  const targetAnswerType = target?.answer_type ?? null;
  const predictionAnswerType = prediction?.answer_type ?? null;
  return {
    example_id: prompt.example_id,
    root_example_id: prompt.root_example_id,
    source_split: prompt.source_split,
    source_stratum: prompt.source_stratum,
    target_answer_type: targetAnswerType,
    prediction_answer_type: predictionAnswerType,
    answer_type_changed: targetAnswerType !== predictionAnswerType,
    judged_correct: judgedCorrect,
    judge_verdict: judgment?.judgment?.verdict ?? null,
    target_over_answer_conflict: targetAnswerType === "grounded_answer" && predictionAnswerType === "abstain" && judgedCorrect,
    target_under_answer_conflict: targetAnswerType === "abstain" && predictionAnswerType === "grounded_answer" && judgedCorrect,
    frontier_answer: prediction?.answer ?? "",
    frontier_missing_support: prediction?.evidence_first?.missing_support ?? prediction?.abstention_reason ?? "",
  };
});

const metrics = summarize(auditRows);
const repairThreshold = Number(args["repair-threshold"] ?? 0.2);
const status = metrics.target_answerability_conflict_rate >= repairThreshold
  ? "broad_target_answerability_drift_detected"
  : metrics.judge_overall_correct_rate >= 0.9
    ? "frontier_teacher_reliable_on_drift_sample"
    : "frontier_teacher_or_judge_needs_review";
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_drift_sample_audit",
  status,
  source_runs: {
    packet_run_id: packetRunId,
    frontier_run_id: frontierRunId,
    judge_run_id: judgeRunId,
  },
  source_context: {
    packet_status: packet.status,
    frontier_status: frontier.status,
    judge_status: judge.status,
  },
  metrics,
  interpretation: {
    main_result: metrics.target_answerability_conflicts > 0
      ? "Existing SFT targets over-answer on a nontrivial subset when compared with frontier abstentions independently judged correct against the compact evidence pack."
      : "This sample does not show broad over-answering by existing SFT targets.",
    student_path: "Do not launch another Prime student run against unrepaired labels when target conflicts exceed the drift threshold.",
    teacher_path: "Use frontier/judge-agreed traces as candidate repair labels, then train/evaluate a scaffold or stronger student against repaired targets.",
  },
  decision: {
    repair_train_validation_targets_next: metrics.target_answerability_conflict_rate >= repairThreshold,
    promote_existing_targets_without_repair: metrics.target_answerability_conflict_rate < 0.1 && metrics.judge_overall_correct_rate >= 0.9,
    launch_prime_now: false,
    buy_more_openai_judgments_now: false,
    reason: status === "broad_target_answerability_drift_detected"
      ? "A larger train/validation target repair is required before another student run."
      : "This was a bounded reliability sample; use it to decide the next repair or training step rather than launching immediately.",
  },
  thresholds: {
    repair_target_answerability_conflict_rate: repairThreshold,
    promote_existing_targets_max_conflict_rate: 0.1,
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
    inherited_frontier_openai_calls: frontier.calls_made,
    inherited_frontier_openai_cost_usd: frontier.run_cost_usd,
    inherited_judge_openai_calls: judge.calls_made,
    inherited_judge_openai_cost_usd: judge.run_cost_usd,
    note: "This audit reads already-ledgered frontier and judge artifacts.",
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

function summarize(rows) {
  const judged = rows.filter((row) => row.judge_verdict);
  const judgedCorrect = judged.filter((row) => row.judged_correct);
  const over = rows.filter((row) => row.target_over_answer_conflict);
  const under = rows.filter((row) => row.target_under_answer_conflict);
  return {
    examples: rows.length,
    train_examples: rows.filter((row) => row.source_split === "train").length,
    validation_examples: rows.filter((row) => row.source_split === "validation").length,
    target_grounded_answers: rows.filter((row) => row.target_answer_type === "grounded_answer").length,
    target_abstentions: rows.filter((row) => row.target_answer_type === "abstain").length,
    frontier_grounded_answers: rows.filter((row) => row.prediction_answer_type === "grounded_answer").length,
    frontier_abstentions: rows.filter((row) => row.prediction_answer_type === "abstain").length,
    answer_type_changed: rows.filter((row) => row.answer_type_changed).length,
    answer_type_change_rate: rate(rows.filter((row) => row.answer_type_changed).length, rows.length),
    judge_overall_correct: judgedCorrect.length,
    judge_overall_correct_rate: rate(judgedCorrect.length, judged.length),
    target_answerability_conflicts: over.length + under.length,
    target_answerability_conflict_rate: rate(over.length + under.length, rows.length),
    target_over_answer_conflicts: over.length,
    target_under_answer_conflicts: under.length,
    conflict_by_split: {
      train: rows.filter((row) => row.source_split === "train" && (row.target_over_answer_conflict || row.target_under_answer_conflict)).length,
      validation: rows.filter((row) => row.source_split === "validation" && (row.target_over_answer_conflict || row.target_under_answer_conflict)).length,
    },
  };
}

function isJudgedCorrect(prediction, judgment) {
  if (!prediction || !judgment) return false;
  if (prediction.answer_type === "abstain") {
    return judgment.verdict === "correct_abstention" && judgment.abstention_supported === true;
  }
  return judgment.verdict === "supported" && judgment.all_claims_supported === true && judgment.citation_ids_valid === true;
}

function renderReport(result) {
  return `# Frontier Drift Sample Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source Runs

- Packet: \`${result.source_runs.packet_run_id}\`
- Frontier: \`${result.source_runs.frontier_run_id}\`
- Judge: \`${result.source_runs.judge_run_id}\`

## Metrics

- Examples: ${result.metrics.examples}
- Frontier grounded answers: ${result.metrics.frontier_grounded_answers}
- Frontier abstentions: ${result.metrics.frontier_abstentions}
- Answer type changed: ${result.metrics.answer_type_changed} (${pct(result.metrics.answer_type_change_rate)})
- Judge overall correct: ${pct(result.metrics.judge_overall_correct_rate)}
- Target answerability conflicts: ${result.metrics.target_answerability_conflicts} (${pct(result.metrics.target_answerability_conflict_rate)})
- Over-answer conflicts: ${result.metrics.target_over_answer_conflicts}
- Under-answer conflicts: ${result.metrics.target_under_answer_conflicts}

## Interpretation

${result.interpretation.main_result}

${result.interpretation.student_path}

## Decision

- Repair train/validation targets next: ${result.decision.repair_train_validation_targets_next ? "yes" : "no"}
- Promote existing targets without repair: ${result.decision.promote_existing_targets_without_repair ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy more OpenAI judgments now: ${result.decision.buy_more_openai_judgments_now ? "yes" : "no"}
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

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
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
