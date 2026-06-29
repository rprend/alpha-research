import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-drift-sample-packet-2026-06-29-v1";
const perSplit = numberArg(args["per-split"], 12);
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const sourcePacket = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const trainRows = await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const selections = [
  ...selectRows(trainRows, "train", perSplit),
  ...selectRows(validationRows, "validation", perSplit),
];
const prompts = selections.map(({ row, split, stratum, stratum_index }) => ({
  example_id: driftExampleId(row.example_id, split),
  root_example_id: row.example_id,
  source_split: split,
  source_stratum: stratum,
  source_stratum_index: stratum_index,
  task: "citation_grounded_domain_qa_evidence_first_drift_sample_eval",
  messages: row.messages.filter((message) => message.role !== "assistant"),
  input: row.input,
  target_answer_type: row.target.answer_type,
  label_source: {
    ...row.label_source,
    drift_sample_source_packet_run_id: sourcePacketRunId,
    leakage_use: split === "validation" ? "nonfinal_validation_reliability_audit" : "nonfinal_train_reliability_audit",
  },
}));
const targets = selections.map(({ row, split, stratum, stratum_index }) => ({
  example_id: driftExampleId(row.example_id, split),
  root_example_id: row.example_id,
  source_split: split,
  source_stratum: stratum,
  source_stratum_index: stratum_index,
  task: "citation_grounded_domain_qa_evidence_first_drift_sample_target",
  target: row.target,
  reference_output: targetToReferenceOutput(row.target),
  label_source: {
    type: "existing_target_label_for_frontier_drift_audit",
    source_packet_run_id: sourcePacketRunId,
    source_sft_split: split,
    source_answer_type: row.target.answer_type,
    leakage_use: "audit_only_not_final_eval",
  },
}));

await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), prompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), targets);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_drift_sample_packet",
  status: "drift_sample_packet_ready_for_frontier_teacher",
  purpose: "Sample existing train/validation evidence-first SFT targets to estimate answerability drift before spending on another student run.",
  source_packet_run_id: sourcePacketRunId,
  source_packet_status: sourcePacket.status,
  selection: {
    per_split: perSplit,
    examples: prompts.length,
    train: summarize(prompts.filter((row) => row.source_split === "train")),
    validation: summarize(prompts.filter((row) => row.source_split === "validation")),
    total: summarize(prompts),
    policy: "deterministic interleaved sample, balanced across grounded_answer and abstain within each split",
  },
  decision: {
    run_frontier_teacher_next: true,
    run_packet_local_judge_next: true,
    launch_prime_now: false,
    reason: "The 10-row diagnostic target was repaired, but train/validation labels remain un-audited for over-answering relative to compact evidence packs.",
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
    note: "This packet is a deterministic local sample and makes no model calls.",
  },
  artifacts: {
    eval_prompts_jsonl: rel(path.join(datasetDir, "eval_prompts.jsonl")),
    eval_targets_diagnostic_jsonl: rel(path.join(datasetDir, "eval_targets_diagnostic.jsonl")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  selection: result.selection.total,
  decision: result.decision,
}, null, 2));

function selectRows(rows, split, count) {
  const answerCount = Math.ceil(count / 2);
  const abstainCount = count - answerCount;
  const selected = [
    ...takeInterleaved(rows.filter((row) => row.target.answer_type === "grounded_answer"), answerCount, "grounded_answer"),
    ...takeInterleaved(rows.filter((row) => row.target.answer_type === "abstain"), abstainCount, "abstain"),
  ];
  return selected
    .sort((left, right) => left.source_index - right.source_index)
    .map((item, index) => ({ ...item, split, stratum_index: index }));
}

function takeInterleaved(rows, count, stratum) {
  if (rows.length < count) throw new Error(`Not enough ${stratum} rows to select ${count}.`);
  if (count === 1) return [{ row: rows[0], source_index: 0, stratum }];
  const step = (rows.length - 1) / (count - 1);
  const used = new Set();
  const selected = [];
  for (let i = 0; i < count; i += 1) {
    let index = Math.round(i * step);
    while (used.has(index) && index + 1 < rows.length) index += 1;
    while (used.has(index) && index > 0) index -= 1;
    used.add(index);
    selected.push({ row: rows[index], source_index: index, stratum });
  }
  return selected;
}

function driftExampleId(exampleId, split) {
  return `${exampleId}:drift-sample:${split}`;
}

function targetToReferenceOutput(target) {
  return {
    answer_type: target.answer_type,
    answer: target.answer,
    citations: normalizeCitations(target.citations ?? []).map((evidence_id) => ({ evidence_id, supports: "answer" })),
    claim_table: Array.isArray(target.claim_table) ? target.claim_table : [],
    abstention_reason: target.abstention_reason,
  };
}

function normalizeCitations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((citation) => typeof citation === "string" ? citation : citation?.evidence_id ?? citation?.id)
    .map((citation) => String(citation ?? "").trim())
    .filter(Boolean);
}

function summarize(rows) {
  return {
    examples: rows.length,
    grounded_answer: rows.filter((row) => row.target_answer_type === "grounded_answer").length,
    abstain: rows.filter((row) => row.target_answer_type === "abstain").length,
  };
}

function renderReport(result) {
  return `# Frontier Drift Sample Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source packet: \`${result.source_packet_run_id}\`

## Selection

- Examples: ${result.selection.examples}
- Train: ${result.selection.train.grounded_answer} grounded answers, ${result.selection.train.abstain} abstentions
- Validation: ${result.selection.validation.grounded_answer} grounded answers, ${result.selection.validation.abstain} abstentions
- Policy: ${result.selection.policy}

## Decision

- Run frontier teacher next: ${result.decision.run_frontier_teacher_next ? "yes" : "no"}
- Run packet-local judge next: ${result.decision.run_packet_local_judge_next ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
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

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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
