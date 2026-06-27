import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2";
const runId = args["run-id"] ?? `joint-action-eval-prep-${packetRunId}`;
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const trainScriptPath = path.join(packetDir, "train_joint_action_lora_uv.py");
const evalScriptPath = path.join(packetDir, "eval_joint_action_adapter_uv.py");
const datasetDir = path.join(packetDir, "dataset");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const evalRows = await readJsonl(path.join(datasetDir, "eval_prompts.jsonl"));

await fs.mkdir(outputDir, { recursive: true });

const trainScript = await fs.readFile(trainScriptPath, "utf8");
const evalScript = await fs.readFile(evalScriptPath, "utf8");
const trainCompile = compilePython(trainScriptPath);
const evalCompile = compilePython(evalScriptPath);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  prep_type: "joint_action_qwen3b_adapter_eval_prep",
  packet_run_id: packetRunId,
  eval_prompts: evalRows.length,
  script_checks: {
    train_compiles: trainCompile.ok,
    train_compile_stderr: trainCompile.stderr,
    eval_compiles: evalCompile.ok,
    eval_compile_stderr: evalCompile.stderr,
    train_saves_dpo_adapter: trainScript.includes("dpo.model.save_pretrained(DPO_ADAPTER_DIR)"),
    eval_loads_peft_adapter: evalScript.includes("PeftModel.from_pretrained"),
    eval_writes_predictions: evalScript.includes("predictions.jsonl"),
    eval_writes_result: evalScript.includes("result.json"),
    eval_reports_zero_openai_calls: evalScript.includes('"openai_calls": 0'),
  },
  output_contract: {
    prediction_run_id: "joint-action-qwen3b-smoke-eval-v1",
    result_json: "result.json",
    report_md: "report.md",
    predictions_jsonl: "predictions.jsonl",
    required_prediction_fields: ["example_id", "prediction", "reference", "scores", "raw_output", "parse_error", "metadata"],
    next_required_step: "Run the existing grounded-correctness judge over predictions.jsonl after GPU eval completes.",
  },
  commands: {
    bounded_train: [
      "MAX_SFT_STEPS=20",
      "MAX_DPO_STEPS=10",
      "PUSH_TO_HUB=false",
      "REPORT_TO=none",
      `uv run ${path.relative(rootDir, trainScriptPath)}`,
    ].join(" "),
    eval_after_train: [
      "ADAPTER_DIR=joint-action-dpo-adapter",
      `OUTPUT_DIR=${path.join("docs", "experiments", "grounded-qa-distillation", "runs", "joint-action-qwen3b-smoke-eval-v1")}`,
      `uv run ${path.relative(rootDir, evalScriptPath)}`,
    ].join(" "),
  },
  budget_context: {
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  conclusion: {
    status: trainCompile.ok && evalCompile.ok ? "eval_ready_after_gpu_training" : "eval_prep_failed",
    reason: "The packet now saves the DPO adapter locally and includes a deterministic adapter evaluator that emits predictions plus reference-overlap metrics. Grounded-correctness judging remains a separate paid OpenAI step after predictions exist.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function compilePython(scriptPath) {
  const result = spawnSync("python3", ["-m", "py_compile", scriptPath], { encoding: "utf8" });
  return {
    ok: result.status === 0,
    stderr: result.stderr.trim(),
  };
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function renderReport(result) {
  return `# Joint-Action Qwen 3B Eval Prep

This run prepares the post-training adapter evaluation path for \`${result.packet_run_id}\`.

## Checks

| Check | Status |
| --- | --- |
| Train script compiles | ${result.script_checks.train_compiles ? "pass" : "fail"} |
| Eval script compiles | ${result.script_checks.eval_compiles ? "pass" : "fail"} |
| Train saves DPO adapter | ${result.script_checks.train_saves_dpo_adapter ? "pass" : "fail"} |
| Eval loads PEFT adapter | ${result.script_checks.eval_loads_peft_adapter ? "pass" : "fail"} |
| Eval writes predictions | ${result.script_checks.eval_writes_predictions ? "pass" : "fail"} |

## Commands

\`\`\`bash
${result.commands.bounded_train}
${result.commands.eval_after_train}
\`\`\`

The evaluator makes no OpenAI calls. After \`predictions.jsonl\` exists, run the grounded-correctness judge as the remaining paid evaluation step.
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
