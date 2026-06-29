import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const frontierRunId = args["frontier-run"] ?? "openai-evidence-first-frontier-gpt54-targeted-2026-06-29-v1";
const judgeRunId = args["judge-run"] ?? "openai-judge-frontier-gpt54-targeted-2026-06-29-v1";
const reliabilityAuditRunId = args["reliability-audit-run"] ?? "frontier-target-reliability-audit-gpt54-targeted-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-target-repair-packet-gpt54-targeted-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const sourcePacket = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const sourcePrompts = await readJsonl(path.join(runsDir, sourcePacketRunId, "dataset", "eval_prompts.jsonl"));
const sourceTargets = await readJsonl(path.join(runsDir, sourcePacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const frontier = await readJson(path.join(runsDir, frontierRunId, "result.json"));
const frontierPredictions = await readJsonl(path.join(runsDir, frontierRunId, "predictions.jsonl"));
const judge = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const reliability = await readJson(path.join(runsDir, reliabilityAuditRunId, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const sourceTargetById = new Map(sourceTargets.map((row) => [row.example_id, row]));
const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));
const repairedTargets = [];
const repairRows = [];

for (const prompt of sourcePrompts) {
  const predictionRow = frontierPredictions.find((row) => row.example_id === prompt.example_id);
  const judgment = judgmentById.get(prompt.example_id);
  if (!predictionRow?.prediction) throw new Error(`Missing frontier prediction for ${prompt.example_id}`);
  if (!isJudgedCorrect(predictionRow.prediction, judgment?.judgment)) {
    throw new Error(`Frontier prediction for ${prompt.example_id} was not independently judged correct.`);
  }
  const target = normalizeTarget(predictionRow.prediction);
  const sourceTarget = sourceTargetById.get(prompt.example_id)?.target;
  repairedTargets.push({
    example_id: prompt.example_id,
    task: "citation_grounded_domain_qa_generation_gap_eval_target_frontier_repaired",
    target,
    reference_output: targetToReferenceOutput(target),
    source_target_answer_type: sourceTarget?.answer_type ?? null,
    frontier_answer_type: target.answer_type,
    repair_source: "gpt5_4_frontier_prediction_gpt4o_mini_judged_correct",
    leakage_use: "diagnostic_only_not_training",
    eval_contract: "evidence_first_v1",
  });
  repairRows.push({
    example_id: prompt.example_id,
    source_answer_type: sourceTarget?.answer_type ?? null,
    repaired_answer_type: target.answer_type,
    changed_answer_type: sourceTarget?.answer_type !== target.answer_type,
    judge_verdict: judgment.judgment.verdict,
    repair_reason: target.answer_type === "abstain"
      ? target.evidence_first.missing_support
      : "Frontier/judge agreed supported grounded answer.",
  });
}

await fs.copyFile(
  path.join(runsDir, sourcePacketRunId, "dataset", "eval_prompts.jsonl"),
  path.join(datasetDir, "eval_prompts.jsonl"),
);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), repairedTargets);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_target_repair_packet",
  status: "frontier_judge_repaired_targets_ready_for_preflight",
  purpose: "Replace brittle diagnostic answerability targets with frontier predictions independently judged correct against the compact evidence pack.",
  source_runs: {
    source_packet_run_id: sourcePacketRunId,
    frontier_run_id: frontierRunId,
    judge_run_id: judgeRunId,
    reliability_audit_run_id: reliabilityAuditRunId,
  },
  source_context: {
    source_packet_status: sourcePacket.status,
    frontier_status: frontier.status,
    judge_overall_judged_correct_rate: judge.metrics.overall_judged_correct_rate,
    reliability_status: reliability.status,
    target_answerability_conflicts: reliability.metrics.target_answerability_conflicts,
  },
  examples: {
    eval_prompts: sourcePrompts.length,
    repaired_eval_targets: repairedTargets.length,
    answer_type_changed: repairRows.filter((row) => row.changed_answer_type).length,
    repaired_abstentions: repairedTargets.filter((row) => row.target.answer_type === "abstain").length,
    repaired_grounded_answers: repairedTargets.filter((row) => row.target.answer_type === "grounded_answer").length,
  },
  decision: {
    use_repaired_targets_for_future_contract_gate: true,
    use_original_targets_for_answerability_gate: false,
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    materialize_training_packet_next: false,
    reason: "This repairs the diagnostic target only; broader train/validation target repair should be done before another student-training launch.",
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
    note: "This packet is a deterministic transform of already-ledgered frontier and judge artifacts.",
  },
  artifacts: {
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    repair_rows_jsonl: rel(path.join(outputDir, "repair_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await writeJsonl(path.join(outputDir, "repair_rows.jsonl"), repairRows);
await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  decision: result.decision,
}, null, 2));

function normalizeTarget(prediction) {
  const answerType = prediction.answer_type === "abstain" ? "abstain" : "grounded_answer";
  const evidenceFirst = prediction.evidence_first ?? {};
  return {
    answer_type: answerType,
    evidence_first: {
      sufficiency: answerType === "abstain" ? "insufficient" : "sufficient",
      supported_claims: answerType === "abstain" ? [] : normalizeSupportedClaims(evidenceFirst.supported_claims ?? []),
      missing_support: answerType === "abstain" ? String(evidenceFirst.missing_support ?? prediction.abstention_reason ?? "") : "",
      question_target: String(evidenceFirst.question_target ?? "exact_question_target"),
    },
    answer: String(prediction.answer ?? ""),
    citations: answerType === "abstain" ? [] : normalizeCitations(prediction.citations ?? []),
    claim_table: answerType === "abstain" ? [] : normalizeClaimTable(prediction.claim_table ?? [], evidenceFirst.supported_claims ?? []),
    abstention_reason: answerType === "abstain" ? String(prediction.abstention_reason ?? evidenceFirst.missing_support ?? "") : null,
  };
}

function normalizeSupportedClaims(claims) {
  return claims.map((claim, index) => ({
    claim_id: String(claim.claim_id ?? `C${index + 1}`),
    claim: String(claim.claim ?? ""),
    citations: normalizeCitations(claim.citations ?? []),
    support_status: claim.support_status === "supported" ? "supported" : "supported",
  }));
}

function normalizeClaimTable(claimTable, supportedClaims) {
  if (Array.isArray(claimTable) && claimTable.length) {
    return claimTable.map((claim) => ({
      claim: String(claim.claim ?? ""),
      support: String(claim.support ?? claim.support_status ?? "supported"),
      citations: normalizeCitations(claim.citations ?? []),
    }));
  }
  return normalizeSupportedClaims(supportedClaims).map((claim) => ({
    claim: claim.claim,
    support: claim.support_status,
    citations: claim.citations,
  }));
}

function targetToReferenceOutput(target) {
  return {
    answer_type: target.answer_type,
    answer: target.answer,
    citations: target.citations.map((evidence_id) => ({ evidence_id, supports: "answer" })),
    claim_table: target.claim_table,
    abstention_reason: target.abstention_reason,
  };
}

function isJudgedCorrect(prediction, judgment) {
  if (!judgment) return false;
  if (prediction.answer_type === "abstain") {
    return judgment.verdict === "correct_abstention" && judgment.abstention_supported === true;
  }
  return judgment.verdict === "supported" && judgment.all_claims_supported === true && judgment.citation_ids_valid === true;
}

function normalizeCitations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((citation) => typeof citation === "string" ? citation : citation?.evidence_id ?? citation?.id)
    .map((citation) => String(citation ?? "").trim())
    .filter(Boolean);
}

function renderReport(result) {
  return `# Frontier Target Repair Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source

- Source packet: \`${result.source_runs.source_packet_run_id}\`
- Frontier run: \`${result.source_runs.frontier_run_id}\`
- Judge run: \`${result.source_runs.judge_run_id}\`
- Reliability audit: \`${result.source_runs.reliability_audit_run_id}\`

## Examples

- Eval prompts: ${result.examples.eval_prompts}
- Repaired targets: ${result.examples.repaired_eval_targets}
- Answer type changed: ${result.examples.answer_type_changed}
- Repaired abstentions: ${result.examples.repaired_abstentions}
- Repaired grounded answers: ${result.examples.repaired_grounded_answers}

## Decision

- Use repaired targets for future contract gate: ${result.decision.use_repaired_targets_for_future_contract_gate ? "yes" : "no"}
- Use original targets for answerability gate: ${result.decision.use_original_targets_for_answerability_gate ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
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
