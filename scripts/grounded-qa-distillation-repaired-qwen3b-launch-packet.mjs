import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const repairedLaunchPacketRunId = args["repaired-launch-packet-run"] ?? "frontier-repaired-launch-packet-2026-06-29-v1";
const validationGatePacketRunId = args["validation-gate-packet-run"] ?? "frontier-repaired-validation-gate-packet-2026-06-29-v1";
const runnerTemplateRunId = args["runner-template-run-id"] ?? "evidence-first-targeted-contract-launch-packet-2026-06-29-v1";
const smokeRunId = args["smoke-run-id"] ?? "frontier-repaired-qwen3b-validation-smoke-v1";
const runId = args["run-id"] ?? "frontier-repaired-qwen3b-launch-packet-2026-06-29-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const repairedDatasetDir = path.join(runsDir, repairedLaunchPacketRunId, "dataset");
const validationDatasetDir = path.join(runsDir, validationGatePacketRunId, "dataset");
const templateDir = path.join(runsDir, runnerTemplateRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const repairedLaunchPacket = await readJson(path.join(runsDir, repairedLaunchPacketRunId, "result.json"));
const validationGatePacket = await readJson(path.join(runsDir, validationGatePacketRunId, "result.json"));
const datasetWriteSummary = await writeDataset();
await writeRunnerArtifacts();
const localChecks = await runLocalChecks();

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "frontier_repaired_qwen3b_launch_packet",
  status: localChecks.every((row) => row.status === "pass")
    ? "ready_for_bounded_repaired_qwen3b_smoke_after_fresh_price_gate"
    : "repaired_qwen3b_launch_packet_local_check_failed",
  purpose: "Wire the repaired train/DPO data into the bounded Qwen3B runner and evaluate on the broader 70-row repaired validation gate.",
  source_runs: {
    repaired_launch_packet: repairedLaunchPacketRunId,
    validation_gate_packet: validationGatePacketRunId,
    runner_template: runnerTemplateRunId,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  smoke_run_id: smokeRunId,
  examples: {
    sft_train: datasetWriteSummary["sft_train.jsonl"].written_rows,
    sft_validation: datasetWriteSummary["sft_validation.jsonl"].written_rows,
    dpo_train: datasetWriteSummary["dpo_train.jsonl"].written_rows,
    dpo_validation: datasetWriteSummary["dpo_validation.jsonl"].written_rows,
    eval_prompts: datasetWriteSummary["eval_prompts.jsonl"].written_rows,
    eval_targets: datasetWriteSummary["eval_targets_diagnostic.jsonl"].written_rows,
  },
  source_context: {
    repaired_launch_packet_status: repairedLaunchPacket.status,
    validation_gate_packet_status: validationGatePacket.status,
    validation_gate_distribution: validationGatePacket.examples,
  },
  dataset_write_summary: datasetWriteSummary,
  local_checks: localChecks,
  launch_gate: {
    launch_prime_now: false,
    required_before_launch: [
      "Run a fresh Prime auth/price gate immediately before pod creation.",
      "Confirm projected total OpenAI plus Prime spend stays below $100.",
      "Run this packet's local checks after any script changes.",
      "Launch only a bounded smoke: MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none.",
      "Accept the smoke only if it beats 62.9% overall contract correctness on the 70-row repaired validation gate.",
      "Do not buy OpenAI grounded-correctness judgments unless the deterministic repaired validation gate is beaten.",
    ],
    baseline_to_beat: {
      train_calibrated_scaffold_run_id: "frontier-repaired-train-calibrated-scaffold-smoke-2026-06-29-v1",
      repaired_validation_overall_contract_correct_rate: 44 / 70,
    },
    projected_total_after_one_dollar_smoke_usd: Number(budget.spend_usd.total_actual) + 1,
    budget_cap_usd: budget.max_budget_usd,
  },
  decision: {
    launch_prime_now: false,
    run_fresh_prime_price_gate_next: localChecks.every((row) => row.status === "pass"),
    buy_openai_judgments_now: false,
    reason: "The repaired Qwen3B packet is executable, but pod creation should be gated by a fresh Prime price/auth check and deterministic validation acceptance.",
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
    note: "Launch packet materialization and local checks make no model calls and create no GPU jobs.",
  },
  artifacts: {
    smoke_runner: rel(path.join(outputDir, "run_joint_action_smoke.sh")),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    eval_script: rel(path.join(outputDir, "eval_joint_action_adapter_uv.py")),
    report: rel(path.join(outputDir, "report.md")),
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  examples: result.examples,
  local_checks: result.local_checks,
  decision: result.decision,
}, null, 2));

async function writeDataset() {
  const summary = {};
  for (const file of ["sft_train.jsonl", "sft_validation.jsonl", "dpo_train.jsonl", "dpo_validation.jsonl"]) {
    const rows = await readJsonl(path.join(repairedDatasetDir, file));
    await writeJsonl(path.join(datasetDir, file), rows);
    summary[file] = { source: rel(path.join(repairedDatasetDir, file)), source_rows: rows.length, written_rows: rows.length };
  }
  for (const file of ["eval_prompts.jsonl", "eval_targets_diagnostic.jsonl"]) {
    const rows = await readJsonl(path.join(validationDatasetDir, file));
    await writeJsonl(path.join(datasetDir, file), rows);
    summary[file] = { source: rel(path.join(validationDatasetDir, file)), source_rows: rows.length, written_rows: rows.length };
  }
  return summary;
}

async function writeRunnerArtifacts() {
  for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "eval_joint_action_adapter_uv.py", "run_joint_action_smoke.sh"]) {
    let text = await fs.readFile(path.join(templateDir, file), "utf8");
    text = text.replaceAll(runnerTemplateRunId, runId);
    text = text.replaceAll("evidence-first-targeted-contract-qwen3b-smoke-v1", smokeRunId);
    text = text.replaceAll("evidence-first-targeted-contract-packet-2026-06-29-v1", runId);
    if (file === "run_joint_action_smoke.sh") {
      text = text.replace(
        "next_step\": \"Run grounded-correctness judging with scripts/grounded-qa-distillation-openai-judge.mjs after predictions.jsonl is present.\"",
        "next_step\": \"Accept only if the repaired validation contract gate beats the train-calibrated scaffold baseline before any paid judging.\""
      );
    }
    await fs.writeFile(path.join(outputDir, file), text);
  }
  await fs.chmod(path.join(outputDir, "run_joint_action_smoke.sh"), 0o755);
}

async function runLocalChecks() {
  const commands = [
    ["bash_syntax_smoke_runner", "bash", ["-n", path.join(outputDir, "run_joint_action_smoke.sh")]],
    ["python_syntax_validator", "python3", ["-m", "py_compile", path.join(outputDir, "validate_joint_action_dataset_uv.py")]],
    ["python_syntax_train", "python3", ["-m", "py_compile", path.join(outputDir, "train_joint_action_lora_uv.py")]],
    ["python_syntax_eval", "python3", ["-m", "py_compile", path.join(outputDir, "eval_joint_action_adapter_uv.py")]],
    ["dataset_validator", "uv", ["run", path.join(outputDir, "validate_joint_action_dataset_uv.py")]],
  ];
  return commands.map(([id, command, commandArgs]) => {
    const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
    return {
      id,
      status: completed.status === 0 ? "pass" : "fail",
      command: [command, ...commandArgs].join(" "),
      stdout: (completed.stdout ?? "").trim().slice(0, 1000),
      stderr: (completed.stderr ?? "").trim().slice(0, 1000),
    };
  });
}

function renderReport(result) {
  return `# Frontier Repaired Qwen3B Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Examples

- SFT train: ${result.examples.sft_train}
- SFT validation: ${result.examples.sft_validation}
- DPO train: ${result.examples.dpo_train}
- DPO validation: ${result.examples.dpo_validation}
- Eval prompts: ${result.examples.eval_prompts}
- Eval targets: ${result.examples.eval_targets}

## Local Checks

${result.local_checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}`).join("\n")}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Run fresh Prime price gate next: ${result.decision.run_fresh_prime_price_gate_next ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
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
