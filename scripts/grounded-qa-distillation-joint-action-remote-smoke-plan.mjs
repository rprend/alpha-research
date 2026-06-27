import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const runId = args["run-id"] ?? `joint-action-remote-smoke-plan-${packetRunId}`;
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const runnerPath = path.join(packetDir, "run_joint_action_smoke.sh");
const preflight = await readResult(`joint-action-launch-preflight-${packetRunId}`);
const launchPlan = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const evalPrep = await readResult(`joint-action-eval-prep-${packetRunId}`);
const judgePlan = await readResult(`joint-action-judge-plan-${predictionRunId}`);

await fs.mkdir(outputDir, { recursive: true });

const runner = await fs.readFile(runnerPath, "utf8");
const syntaxCheck = spawnSync("bash", ["-n", runnerPath], { encoding: "utf8" });
const stat = await fs.stat(runnerPath);
const command = `RUN_ID=${predictionRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none ${path.relative(rootDir, runnerPath)}`;

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  plan_type: "joint_action_remote_smoke_single_command_plan",
  packet_run_id: packetRunId,
  prediction_run_id: predictionRunId,
  source_runs: {
    preflight: preflight.run_id,
    launch_plan: launchPlan.run_id,
    eval_prep: evalPrep.run_id,
    judge_plan: judgePlan.run_id,
  },
  runner: {
    path: path.relative(rootDir, runnerPath),
    executable: Boolean(stat.mode & 0o111),
    bash_syntax_ok: syntaxCheck.status === 0,
    bash_syntax_stderr: syntaxCheck.stderr.trim(),
    validates_dataset: runner.includes("validate_joint_action_dataset_uv.py"),
    runs_bounded_train: runner.includes("MAX_SFT_STEPS") && runner.includes("MAX_DPO_STEPS") && runner.includes("train_joint_action_lora_uv.py"),
    runs_adapter_eval: runner.includes("eval_joint_action_adapter_uv.py") && runner.includes("joint-action-dpo-adapter"),
    writes_smoke_manifest: runner.includes("smoke_manifest.json"),
    points_to_judge_next_step: runner.includes("grounded-qa-distillation-openai-judge.mjs"),
  },
  command,
  expected_artifacts: {
    predictions_jsonl: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/predictions.jsonl`,
    result_json: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/result.json`,
    report_md: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/report.md`,
    smoke_manifest_json: `docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/smoke_manifest.json`,
  },
  budget_context: {
    actual_total_spend_usd: launchPlan.budget?.total_actual_before_plan_usd ?? 5.878323650000014,
    planned_gpu_estimate_usd: launchPlan.budget?.estimated_launch_cost_usd ?? 4,
    planned_judge_estimate_usd: judgePlan.budget_gate?.estimated_judge_cost_usd,
    estimated_total_after_smoke_and_judge_usd: (launchPlan.budget?.total_actual_before_plan_usd ?? 5.878323650000014)
      + (launchPlan.budget?.estimated_launch_cost_usd ?? 4)
      + Number(judgePlan.budget_gate?.estimated_judge_cost_usd ?? 0),
    max_budget_usd: 100,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This is a remote execution plan only. It does not launch a pod, train a model, or call OpenAI.",
  },
  conclusion: {
    status: "ready_for_backend_auth_then_single_command_smoke",
    next_step: "Refresh Prime auth or add HF credits, verify live GPU pricing, run the single smoke command, then run the budgeted judge plan.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runsDir, runId, "result.json"), "utf8"));
}

function renderReport(result) {
  return `# Joint-Action Remote Smoke Plan

This plan reduces the paid GPU run to one command after backend authentication is repaired.

\`\`\`bash
${result.command}
\`\`\`

## Runner Checks

| Check | Status |
| --- | --- |
| Executable | ${result.runner.executable ? "pass" : "fail"} |
| Bash syntax | ${result.runner.bash_syntax_ok ? "pass" : "fail"} |
| Dataset validation | ${result.runner.validates_dataset ? "pass" : "fail"} |
| Bounded train | ${result.runner.runs_bounded_train ? "pass" : "fail"} |
| Adapter eval | ${result.runner.runs_adapter_eval ? "pass" : "fail"} |
| Smoke manifest | ${result.runner.writes_smoke_manifest ? "pass" : "fail"} |

Estimated total after smoke and judge: $${result.budget_context.estimated_total_after_smoke_and_judge_usd.toFixed(4)} of $${result.budget_context.max_budget_usd}.
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
