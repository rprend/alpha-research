import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const driftPacketRunId = args["drift-packet-run"] ?? "frontier-drift-sample-packet-2026-06-29-v2";
const frontierRunId = args["frontier-run"] ?? "openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v2";
const judgeRunId = args["judge-run"] ?? "openai-packet-judge-frontier-gpt54-drift-sample-2026-06-29-v2";
const auditRunId = args["audit-run"] ?? "frontier-drift-sample-audit-2026-06-29-v2";
const runId = args["run-id"] ?? "frontier-drift-repair-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const sourcePacket = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const driftPacket = await readJson(path.join(runsDir, driftPacketRunId, "result.json"));
const frontier = await readJson(path.join(runsDir, frontierRunId, "result.json"));
const judge = await readJson(path.join(runsDir, judgeRunId, "result.json"));
const audit = await readJson(path.join(runsDir, auditRunId, "result.json"));
const prompts = await readJsonl(path.join(runsDir, driftPacketRunId, "dataset", "eval_prompts.jsonl"));
const targets = await readJsonl(path.join(runsDir, driftPacketRunId, "dataset", "eval_targets_diagnostic.jsonl"));
const predictions = await readJsonl(path.join(runsDir, frontierRunId, "predictions.jsonl"));
const judgments = await readJsonl(path.join(runsDir, judgeRunId, "judgments.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const targetById = new Map(targets.map((row) => [row.example_id, row]));
const predictionById = new Map(predictions.map((row) => [row.example_id, row]));
const judgmentById = new Map(judgments.map((row) => [row.example_id, row]));
const repairedSftRows = [];
const quarantinedRows = [];
const repairRows = [];

for (const prompt of prompts) {
  const target = targetById.get(prompt.example_id)?.target;
  const prediction = normalizeTarget(predictionById.get(prompt.example_id)?.prediction);
  const judgment = judgmentById.get(prompt.example_id)?.judgment;
  const judgedCorrect = isJudgedCorrect(prediction, judgment);
  const answerTypeChanged = target?.answer_type !== prediction?.answer_type;
  const repairRow = {
    example_id: prompt.example_id,
    root_example_id: prompt.root_example_id,
    source_split: prompt.source_split,
    source_target_answer_type: target?.answer_type ?? null,
    repaired_answer_type: prediction?.answer_type ?? null,
    answer_type_changed: answerTypeChanged,
    judged_correct: judgedCorrect,
    judge_verdict: judgment?.verdict ?? null,
  };
  if (!judgedCorrect) {
    quarantinedRows.push({
      ...repairRow,
      reason: "frontier_prediction_not_judged_correct",
      frontier_prediction: prediction,
      source_target: target,
    });
    repairRows.push({ ...repairRow, accepted_for_repair: false, reason: "frontier_prediction_not_judged_correct" });
    continue;
  }
  const repaired = {
    example_id: prompt.root_example_id ?? prompt.example_id,
    task: "citation_grounded_domain_qa_evidence_first_sft_frontier_repaired",
    messages: [
      ...prompt.messages,
      { role: "assistant", content: JSON.stringify(prediction) },
    ],
    input: prompt.input,
    target: prediction,
    original_target: target,
    label_source: {
      type: "frontier_judge_repaired_evidence_first_sft",
      source_packet_run_id: sourcePacketRunId,
      drift_packet_run_id: driftPacketRunId,
      frontier_run_id: frontierRunId,
      judge_run_id: judgeRunId,
      audit_run_id: auditRunId,
      source_split: prompt.source_split,
      original_answer_type: target?.answer_type ?? null,
      repaired_answer_type: prediction.answer_type,
      answer_type_changed: answerTypeChanged,
      leakage_use: "nonfinal_train_validation_repair_candidate",
    },
    repair_metadata: {
      prompt_example_id: prompt.example_id,
      judge_verdict: judgment.verdict,
      judge_notes: judgment.notes ?? "",
    },
  };
  repairedSftRows.push(repaired);
  repairRows.push({ ...repairRow, accepted_for_repair: true, reason: answerTypeChanged ? "answerability_repaired" : "frontier_trace_confirmed" });
}

const trainRows = repairedSftRows.filter((row) => row.label_source.source_split === "train");
const validationRows = repairedSftRows.filter((row) => row.label_source.source_split === "validation");
await writeJsonl(path.join(datasetDir, "sft_train_repaired_sample.jsonl"), trainRows);
await writeJsonl(path.join(datasetDir, "sft_validation_repaired_sample.jsonl"), validationRows);
await writeJsonl(path.join(outputDir, "repair_rows.jsonl"), repairRows);
await writeJsonl(path.join(outputDir, "quarantined_rows.jsonl"), quarantinedRows);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_drift_repair_packet",
  status: quarantinedRows.length ? "repair_packet_ready_with_quarantine" : "repair_packet_ready",
  purpose: "Convert frontier/judge-agreed drift-sample traces into nonfinal train/validation SFT repair candidates and quarantine unsupported frontier outputs.",
  source_runs: {
    source_packet_run_id: sourcePacketRunId,
    drift_packet_run_id: driftPacketRunId,
    frontier_run_id: frontierRunId,
    judge_run_id: judgeRunId,
    audit_run_id: auditRunId,
  },
  source_context: {
    source_packet_status: sourcePacket.status,
    drift_packet_status: driftPacket.status,
    frontier_status: frontier.status,
    judge_status: judge.status,
    audit_status: audit.status,
  },
  examples: {
    sampled: prompts.length,
    accepted_repair_candidates: repairedSftRows.length,
    quarantined: quarantinedRows.length,
    train_repair_candidates: trainRows.length,
    validation_repair_candidates: validationRows.length,
    answer_type_changed_accepted: repairRows.filter((row) => row.accepted_for_repair && row.answer_type_changed).length,
    accepted_grounded_answers: repairedSftRows.filter((row) => row.target.answer_type === "grounded_answer").length,
    accepted_abstentions: repairedSftRows.filter((row) => row.target.answer_type === "abstain").length,
    original_grounded_answers_in_accepted: repairedSftRows.filter((row) => row.original_target?.answer_type === "grounded_answer").length,
    original_abstentions_in_accepted: repairedSftRows.filter((row) => row.original_target?.answer_type === "abstain").length,
  },
  decision: {
    use_as_full_training_packet_now: repairedSftRows.length >= 250,
    use_as_repair_seed_for_larger_adjudication: repairedSftRows.length < 250,
    launch_prime_now: false,
    buy_more_openai_judgments_now: false,
    reason: repairedSftRows.length >= 250
      ? "The accepted rows cover the nonfinal train/validation distribution well enough to build a repaired launch packet; create a bounded student/scaffold run next, but do not launch Prime from this transform step."
      : "The accepted rows prove the repair transform, but a student run should wait for a larger repaired train/validation packet rather than training on a small sample.",
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
    note: "This repair packet is a deterministic transform of already-ledgered frontier and judge artifacts.",
  },
  artifacts: {
    sft_train_repaired_sample_jsonl: rel(path.join(datasetDir, "sft_train_repaired_sample.jsonl")),
    sft_validation_repaired_sample_jsonl: rel(path.join(datasetDir, "sft_validation_repaired_sample.jsonl")),
    repair_rows_jsonl: rel(path.join(outputDir, "repair_rows.jsonl")),
    quarantined_rows_jsonl: rel(path.join(outputDir, "quarantined_rows.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  decision: result.decision,
}, null, 2));

function normalizeTarget(prediction) {
  if (!prediction || typeof prediction !== "object") return null;
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

function isJudgedCorrect(prediction, judgment) {
  if (!prediction || !judgment) return false;
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
  return `# Frontier Drift Repair Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Source Runs

- Drift packet: \`${result.source_runs.drift_packet_run_id}\`
- Frontier: \`${result.source_runs.frontier_run_id}\`
- Judge: \`${result.source_runs.judge_run_id}\`
- Audit: \`${result.source_runs.audit_run_id}\`

## Examples

- Sampled: ${result.examples.sampled}
- Accepted repair candidates: ${result.examples.accepted_repair_candidates}
- Quarantined: ${result.examples.quarantined}
- Train repair candidates: ${result.examples.train_repair_candidates}
- Validation repair candidates: ${result.examples.validation_repair_candidates}
- Accepted answer-type changes: ${result.examples.answer_type_changed_accepted}
- Accepted grounded answers: ${result.examples.accepted_grounded_answers}
- Accepted abstentions: ${result.examples.accepted_abstentions}

## Decision

- Use as full training packet now: ${result.decision.use_as_full_training_packet_now ? "yes" : "no"}
- Use as repair seed for larger adjudication: ${result.decision.use_as_repair_seed_for_larger_adjudication ? "yes" : "no"}
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
