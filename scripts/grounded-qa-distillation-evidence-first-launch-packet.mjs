import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet-run-id"] ?? "evidence-first-contract-packet-2026-06-28-v1";
const runnerTemplateRunId = args["runner-template-run-id"] ?? "generation-gap-form-specific-construction-packet-d338-2026-06-28-v1";
const smokeRunId = args["smoke-run-id"] ?? "evidence-first-contract-qwen3b-smoke-v1";
const runId = args["run-id"] ?? "evidence-first-contract-launch-packet-2026-06-28-v1";
const outputDir = path.join(runsDir, runId);
const datasetDir = path.join(outputDir, "dataset");
const sourceDatasetDir = path.join(runsDir, sourcePacketRunId, "dataset");
const templateDir = path.join(runsDir, runnerTemplateRunId);

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const sourceResult = await readJson(path.join(runsDir, sourcePacketRunId, "result.json"));
const remoteGate = await readJson(path.join(runsDir, "remote-backend-readiness-gate-current-2026-06-28-v2", "result.json"));
const datasetFiles = ["sft_train.jsonl", "sft_validation.jsonl", "dpo_train.jsonl", "dpo_validation.jsonl", "eval_prompts.jsonl", "eval_targets_diagnostic.jsonl"];
const datasetWriteSummary = await writeDataset();

await writeLaunchArtifacts();

const checks = await runLocalChecks();
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "evidence_first_contract_launch_packet",
  status: checks.every((row) => row.status === "pass") ? "ready_for_bounded_evidence_first_smoke_after_price_check" : "launch_packet_local_check_failed",
  purpose: "Wire the evidence-first contract packet into the bounded Qwen smoke runner and post-generation evidence-first contract gate.",
  source_runs: {
    evidence_first_contract_packet: sourcePacketRunId,
    runner_template: runnerTemplateRunId,
    remote_backend_readiness_gate: remoteGate.run_id,
  },
  base_model: "Qwen/Qwen2.5-3B-Instruct",
  smoke_run_id: smokeRunId,
  examples: sourceResult.examples,
  dataset_write_summary: datasetWriteSummary,
  local_checks: checks,
  launch_gate: {
    launch_prime_now: false,
    required_before_launch: [
      "Re-run remote backend readiness gate immediately before launch.",
      "Confirm projected OpenAI plus Prime spend stays below $100.",
      "Run dataset validator and bash syntax checks.",
      "Launch only with MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none.",
      "Run evidence-first contract preflight on generated predictions before any OpenAI judging.",
    ],
    projected_total_after_smoke_usd: Number(budget.spend_usd.total_actual) + 1,
    budget_cap_usd: budget.max_budget_usd,
  },
  decision: {
    launch_prime_now: false,
    buy_openai_judgments_now: false,
    run_remote_smoke_next_if_user_continuation_allows_spend: checks.every((row) => row.status === "pass") && remoteGate.status === "remote_backend_ready_for_qwen3b_smoke",
    reason: "The evidence-first packet is now wired into a bounded runner and contract gate; paid judging remains forbidden until generated predictions pass the evidence-first gate.",
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
    prime_intellect_cost_usd: 0,
    note: "Launch packet materialization and local checks are zero-call and zero-compute.",
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
  local_checks: result.local_checks,
  decision: result.decision,
  budget: result.budget,
  llm_budget: result.llm_budget,
}, null, 2));

async function writeLaunchArtifacts() {
  for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "eval_joint_action_adapter_uv.py", "run_joint_action_smoke.sh"]) {
    let text = await fs.readFile(path.join(templateDir, file), "utf8");
    text = text.replaceAll(runnerTemplateRunId, runId);
    text = text.replaceAll("generation-gap-form-specific-construction-packet-d338-2026-06-28-v1", runId);
    text = text.replaceAll("joint-action-qwen3b-smoke-eval-v1", smokeRunId);
    if (file === "eval_joint_action_adapter_uv.py") text = patchEvalScript(text);
    if (file === "run_joint_action_smoke.sh") text = patchSmokeRunner(text);
    await fs.writeFile(path.join(outputDir, file), text);
  }
  await fs.chmod(path.join(outputDir, "run_joint_action_smoke.sh"), 0o755);
}

async function writeDataset() {
  const summary = {};
  for (const file of datasetFiles) {
    const source = await readJsonl(path.join(sourceDatasetDir, file));
    let rows = source;
    let droppedIdentical = 0;
    if (file.startsWith("dpo_")) {
      rows = source.filter((row) => {
        const keep = row.chosen !== row.rejected;
        if (!keep) droppedIdentical += 1;
        return keep;
      });
    }
    await writeJsonl(path.join(datasetDir, file), rows);
    summary[file] = { source_rows: source.length, written_rows: rows.length, dropped_identical_preferences: droppedIdentical };
  }
  return summary;
}

function patchEvalScript(text) {
  return text
    .replace(
      `    return {
        "answer_type": answer_type,
        "answer": str(value.get("answer", "")),
        "citations": [] if answer_type == "abstain" else citations,
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason", "")) if answer_type == "abstain" else None,
    }`,
      `    evidence_first = value.get("evidence_first") if isinstance(value.get("evidence_first"), dict) else {}
    return {
        "answer_type": answer_type,
        "evidence_first": evidence_first,
        "answer": str(value.get("answer", "")),
        "citations": [] if answer_type == "abstain" else citations,
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason", "")) if answer_type == "abstain" else None,
    }`
    )
    .replace(
      `"model_family": "qwen2_5_3b_generation_gap_lora",`,
      `"model_family": "qwen2_5_3b_evidence_first_contract_lora",`
    );
}

function patchSmokeRunner(text) {
  const gate = `
CONTRACT_GATE_RUN_ID="\${RUN_ID}-evidence-first-contract-gate"
node scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs \\
  --packet-run-id=${sourcePacketRunId} \\
  --prediction-file="\${OUTPUT_DIR}/predictions.jsonl" \\
  --run-id="\${CONTRACT_GATE_RUN_ID}"
`;
  return text
    .replace(`RUN_ID="\${RUN_ID:-joint-action-qwen3b-smoke-eval-v1}"`, `RUN_ID="\${RUN_ID:-${smokeRunId}}"`)
    .replace("echo \"Joint-action smoke complete: ${MANIFEST_PATH}\"", `${gate}\necho "Evidence-first joint-action smoke complete: \${MANIFEST_PATH}"`);
}

async function runLocalChecks() {
  const commands = [
    ["bash_syntax_smoke_runner", "bash", ["-n", path.join(outputDir, "run_joint_action_smoke.sh")]],
    ["python_syntax_validator", "python3", ["-m", "py_compile", path.join(outputDir, "validate_joint_action_dataset_uv.py")]],
    ["python_syntax_train", "python3", ["-m", "py_compile", path.join(outputDir, "train_joint_action_lora_uv.py")]],
    ["python_syntax_eval", "python3", ["-m", "py_compile", path.join(outputDir, "eval_joint_action_adapter_uv.py")]],
    ["dataset_validator", "uv", ["run", path.join(outputDir, "validate_joint_action_dataset_uv.py")]],
  ];
  const rows = [];
  for (const [id, command, commandArgs] of commands) {
    const { spawnSync } = await import("node:child_process");
    const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
    rows.push({
      id,
      status: completed.status === 0 ? "pass" : "fail",
      command: [command, ...commandArgs].join(" "),
      stdout: (completed.stdout ?? "").trim().slice(0, 1000),
      stderr: (completed.stderr ?? "").trim().slice(0, 1000),
    });
  }
  return rows;
}

function renderReport(result) {
  return `# Evidence-First Contract Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Local Checks

${result.local_checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}`).join("\n")}

## Decision

- Launch Prime now: ${result.decision.launch_prime_now ? "yes" : "no"}
- Buy OpenAI judgments now: ${result.decision.buy_openai_judgments_now ? "yes" : "no"}
- Remote smoke next if spend is allowed: ${result.decision.run_remote_smoke_next_if_user_continuation_allows_spend ? "yes" : "no"}
- Reason: ${result.decision.reason}

The runner calls the evidence-first contract gate on generated predictions before any paid judging.
`;
}

function rel(filePath) {
  return path.relative(rootDir, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.trim() ? text.trim().split(/\n+/).map((line) => JSON.parse(line)) : [];
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
