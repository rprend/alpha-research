import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run"] ?? "evidence-first-targeted-contract-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-full-nonfinal-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const sourcePacket = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const trainRows = await readJsonl(path.join(sourceDatasetDir, "sft_train.jsonl"));
const validationRows = await readJsonl(path.join(sourceDatasetDir, "sft_validation.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const selections = [
  ...trainRows.map((row, index) => ({ row, split: "train", source_index: index })),
  ...validationRows.map((row, index) => ({ row, split: "validation", source_index: index })),
];

const prompts = selections.map(({ row, split, source_index }) => ({
  example_id: fullExampleId(row.example_id, split),
  root_example_id: row.example_id,
  source_split: split,
  source_index,
  task: "citation_grounded_domain_qa_evidence_first_full_nonfinal_eval",
  messages: row.messages.filter((message) => message.role !== "assistant"),
  input: row.input,
  target_answer_type: row.target.answer_type,
  label_source: {
    ...row.label_source,
    full_nonfinal_source_packet_run_id: sourcePacketRunId,
    leakage_use: split === "validation" ? "nonfinal_validation_reliability_repair" : "nonfinal_train_reliability_repair",
  },
}));
const targets = selections.map(({ row, split, source_index }) => ({
  example_id: fullExampleId(row.example_id, split),
  root_example_id: row.example_id,
  source_split: split,
  source_index,
  task: "citation_grounded_domain_qa_evidence_first_full_nonfinal_target",
  target: row.target,
  reference_output: targetToReferenceOutput(row.target),
  label_source: {
    type: "existing_target_label_for_full_nonfinal_frontier_repair",
    source_packet_run_id: sourcePacketRunId,
    source_sft_split: split,
    source_answer_type: row.target.answer_type,
    leakage_use: "nonfinal_repair_only_not_final_eval",
  },
}));

await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), prompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), targets);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_full_nonfinal_packet",
  status: "full_nonfinal_packet_ready_for_frontier_teacher",
  purpose: "Expose every nonfinal evidence-first SFT train/validation row to the frontier/judge repair pipeline before another student run.",
  source_packet_run_id: sourcePacketRunId,
  source_packet_status: sourcePacket.status,
  examples: {
    total: prompts.length,
    train: summarize(prompts.filter((row) => row.source_split === "train")),
    validation: summarize(prompts.filter((row) => row.source_split === "validation")),
    all: summarize(prompts),
  },
  decision: {
    run_frontier_teacher_next: true,
    run_packet_local_judge_next: true,
    launch_prime_now: false,
    reason: "D375 showed sampled target drift; the next required artifact is a full nonfinal repaired target packet, not another sampled estimate.",
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
    note: "This packet is a deterministic local transform and makes no model calls.",
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
  examples: result.examples,
  decision: result.decision,
}, null, 2));

function fullExampleId(exampleId, split) {
  return `${exampleId}:full-nonfinal:${split}`;
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
  return `# Frontier Full Nonfinal Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

Source packet: \`${result.source_packet_run_id}\`

## Examples

- Total: ${result.examples.total}
- Train: ${result.examples.train.grounded_answer} grounded answers, ${result.examples.train.abstain} abstentions
- Validation: ${result.examples.validation.grounded_answer} grounded answers, ${result.examples.validation.abstain} abstentions

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

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=");
    parsed[key] = raw ?? "true";
  }
  return parsed;
}
