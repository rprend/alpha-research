import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const repairPacketRunId = args["repair-packet-run"] ?? "frontier-full-nonfinal-repair-packet-2026-06-29-v1";
const runId = args["run-id"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });

const repairPacket = await readJson(path.join(runsDir, repairPacketRunId, "result.json"));
const validationRows = await readJsonl(path.join(runsDir, repairPacketRunId, "dataset", "sft_validation_repaired_sample.jsonl"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const evalPrompts = validationRows.map((row, index) => ({
  example_id: `${row.example_id}:repaired-validation-gate`,
  root_example_id: row.example_id,
  source_split: "validation",
  source_index: index,
  task: "citation_grounded_domain_qa_repaired_validation_gate_prompt",
  messages: row.messages.filter((message) => message.role !== "assistant"),
  input: row.input,
  target_answer_type: row.target.answer_type,
  label_source: {
    type: "frontier_repaired_validation_gate_prompt",
    repair_packet_run_id: repairPacketRunId,
    leakage_use: "nonfinal_validation_gate_not_final_eval",
  },
}));
const evalTargets = validationRows.map((row, index) => ({
  example_id: `${row.example_id}:repaired-validation-gate`,
  root_example_id: row.example_id,
  source_split: "validation",
  source_index: index,
  task: "citation_grounded_domain_qa_repaired_validation_gate_target",
  target: row.target,
  reference_output: {
    answer_type: row.target.answer_type,
    answer: row.target.answer,
    citations: (row.target.citations ?? []).map((evidence_id) => ({ evidence_id, supports: "answer" })),
    claim_table: row.target.claim_table ?? [],
    abstention_reason: row.target.abstention_reason,
  },
  label_source: {
    type: "frontier_judge_repaired_validation_target",
    repair_packet_run_id: repairPacketRunId,
    leakage_use: "nonfinal_validation_gate_not_final_eval",
  },
}));

await writeJsonl(path.join(datasetDir, "eval_prompts.jsonl"), evalPrompts);
await writeJsonl(path.join(datasetDir, "eval_targets_diagnostic.jsonl"), evalTargets);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_repaired_validation_gate_packet",
  status: "repaired_validation_gate_packet_ready",
  purpose: "Use the repaired validation split as a broader deterministic gate so models cannot pass by exploiting the abstention-heavy 10-row diagnostic.",
  source_runs: {
    full_nonfinal_repair_packet: repairPacketRunId,
  },
  source_context: {
    repair_packet_status: repairPacket.status,
  },
  examples: {
    eval_prompts: evalPrompts.length,
    eval_targets: evalTargets.length,
    grounded_answer: evalTargets.filter((row) => row.target.answer_type === "grounded_answer").length,
    abstain: evalTargets.filter((row) => row.target.answer_type === "abstain").length,
  },
  decision: {
    use_as_primary_pre_prime_gate: true,
    launch_prime_now: false,
    reason: "The repaired diagnostic can be passed by abstaining; this broader repaired validation gate is a better pre-Prime acceptance test.",
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
    note: "This gate packet is a deterministic local transform of repaired validation labels.",
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

function renderReport(result) {
  return `# Frontier Repaired Validation Gate Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Examples

- Eval prompts: ${result.examples.eval_prompts}
- Grounded answers: ${result.examples.grounded_answer}
- Abstentions: ${result.examples.abstain}

## Decision

- Use as primary pre-Prime gate: ${result.decision.use_as_primary_pre_prime_gate ? "yes" : "no"}
- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Reason: ${result.decision.reason}
`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
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
