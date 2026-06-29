import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const runId = args["run-id"] ?? "joint-action-script-contract-audit-2026-06-26-v1";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);

const files = {
  train: path.join(packetDir, "train_joint_action_lora_uv.py"),
  eval: path.join(packetDir, "eval_joint_action_adapter_uv.py"),
  validator: path.join(packetDir, "validate_joint_action_dataset_uv.py"),
  runner: path.join(packetDir, "run_joint_action_smoke.sh"),
};

await fs.mkdir(outputDir, { recursive: true });

const [trainText, evalText, validatorText, runnerText] = await Promise.all([
  fs.readFile(files.train, "utf8"),
  fs.readFile(files.eval, "utf8"),
  fs.readFile(files.validator, "utf8"),
  fs.readFile(files.runner, "utf8"),
]);

const commands = [
  runCommand("python3", ["-m", "py_compile", files.train], { cwd: rootDir }),
  runCommand("python3", ["-m", "py_compile", files.eval], { cwd: rootDir }),
  runCommand("python3", [files.validator], { cwd: rootDir }),
  runCommand("bash", ["-n", files.runner], { cwd: rootDir }),
];

const checks = [
  check("python_train_compiles", commands[0].status === 0, commandEvidence(commands[0])),
  check("python_eval_compiles", commands[1].status === 0, commandEvidence(commands[1])),
  check("dataset_validator_passes", commands[2].status === 0, commandEvidence(commands[2])),
  check("runner_bash_syntax_passes", commands[3].status === 0, commandEvidence(commands[3])),
  check("trainer_has_bounded_step_hooks", includesAll(trainText, ["MAX_SFT_STEPS", "MAX_DPO_STEPS", "max_steps"]), "Trainer exposes bounded SFT/DPO step caps."),
  check(
    "trainer_has_no_required_hub_push",
    trainText.includes("PUSH_TO_HUB") && (
      trainText.includes("push_to_hub=False") ||
      trainText.includes("push_to_hub=PUSH_TO_HUB") ||
      trainText.includes('"push_to_hub": PUSH_TO_HUB')
    ),
    "Trainer can run with PUSH_TO_HUB=false.",
  ),
  check("trainer_saves_dpo_adapter_locally", includesAll(trainText, ["DPO_ADAPTER_DIR", "save_pretrained"]), "Trainer saves final DPO adapter for offline eval."),
  check("eval_writes_judge_ready_artifacts", includesAll(evalText, ["predictions.jsonl", "result.json", "report.md", "next_required_step"]), "Evaluator writes predictions, summary result, report, and judge next-step."),
  check("eval_makes_no_openai_calls", !/(from\s+openai\s+import|import\s+openai|OPENAI_API_KEY|chat\.completions|responses\.create)/i.test(evalText), "Evaluator has no OpenAI API import, key, or call site."),
  check("runner_executes_validate_train_eval_manifest", includesAll(runnerText, ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "eval_joint_action_adapter_uv.py", "smoke_manifest.json"]), "Runner performs validate -> train -> eval -> manifest."),
  check("runner_defaults_are_bounded_and_side_effect_free", includesAll(runnerText, ["MAX_SFT_STEPS=\"${MAX_SFT_STEPS:-20}\"", "MAX_DPO_STEPS=\"${MAX_DPO_STEPS:-10}\"", "PUSH_TO_HUB=\"${PUSH_TO_HUB:-false}\"", "REPORT_TO=\"${REPORT_TO:-none}\""]), "Runner defaults to bounded smoke settings and no reporting/hub push."),
  check(
    "runner_points_to_expected_prediction_run",
    runnerText.includes('RUN_ID="${RUN_ID:-') && runnerText.includes('OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${RUN_ID}}"'),
    `Runner can be invoked for prediction run ${predictionRunId} through RUN_ID.`,
  ),
];

const status = checks.every((row) => row.status === "pass") ? "script_contract_ready_for_paid_smoke" : "script_contract_risk";
const smokeCommand = `RUN_ID=${predictionRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none ${path.relative(rootDir, files.runner)}`;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "joint_action_script_contract_audit",
  status,
  packet_run_id: packetRunId,
  prediction_run_id: predictionRunId,
  purpose: "Run zero-cost local checks proving the Qwen 3B joint-action smoke scripts are bounded, compile, validate the packet, and produce judge-ready artifacts before any paid GPU launch.",
  commands,
  checks,
  audited_files: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, path.relative(rootDir, value)])),
  smoke_command: smokeCommand,
  expected_artifacts: {
    predictions_jsonl: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/predictions.jsonl`,
    result_json: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/result.json`,
    report_md: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/report.md`,
    smoke_manifest_json: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/smoke_manifest.json`,
  },
  evidence_boundary: [
    "This audit does not train Qwen 3B and does not evaluate model quality.",
    "This audit proves the next paid smoke path is locally coherent and should emit the artifacts required by the integrity and judge gates.",
    "The paper-readiness blockers remain the actual Qwen 3B predictions and the paid grounded-correctness judge over those predictions.",
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This audit runs local syntax/validator checks only; it does not launch a GPU job or call OpenAI.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  checks: result.checks.map(({ id, status }) => ({ id, status })),
}, null, 2));

function runCommand(command, commandArgs, options) {
  const completed = spawnSync(command, commandArgs, { ...options, encoding: "utf8" });
  return {
    command: [command, ...commandArgs.map((arg) => path.isAbsolute(arg) ? path.relative(rootDir, arg) : arg)].join(" "),
    status: completed.status,
    stdout: completed.stdout.trim().slice(0, 2000),
    stderr: completed.stderr.trim().slice(0, 2000),
  };
}

function commandEvidence(command) {
  return command.status === 0 ? `Passed: ${command.command}` : `Failed: ${command.command}; stderr=${command.stderr}`;
}

function includesAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "fail", evidence };
}

function renderReport(result) {
  return `# Joint-Action Script Contract Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Local Commands

| Command | Status |
| --- | ---: |
${result.commands.map((row) => `| \`${row.command}\` | ${row.status} |`).join("\n")}

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Bounded Smoke Command

\`\`\`bash
${result.smoke_command}
\`\`\`

## Boundary

${result.evidence_boundary.map((item) => `- ${item}`).join("\n")}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
