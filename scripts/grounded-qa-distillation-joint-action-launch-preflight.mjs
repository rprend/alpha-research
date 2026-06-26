import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const runId = args["run-id"] ?? `joint-action-launch-preflight-${packetRunId}`;
const outputDir = path.join(runDir, runId);
const packetDir = path.join(runDir, packetRunId);
const datasetDir = path.join(packetDir, "dataset");
const trainScriptPath = path.join(packetDir, "train_joint_action_lora_uv.py");
const validationScriptPath = path.join(packetDir, "validate_joint_action_dataset_uv.py");
const maxLength = numberArg(args["max-length"], 1536);
const maxPromptLength = numberArg(args["max-prompt-length"], 1280);

await fs.mkdir(outputDir, { recursive: true });

const packet = JSON.parse(await fs.readFile(path.join(packetDir, "result.json"), "utf8"));
const rows = {
  sft_train: await readJsonl(path.join(datasetDir, "sft_train.jsonl")),
  sft_validation: await readJsonl(path.join(datasetDir, "sft_validation.jsonl")),
  dpo_train: await readJsonl(path.join(datasetDir, "dpo_train.jsonl")),
  dpo_validation: await readJsonl(path.join(datasetDir, "dpo_validation.jsonl")),
  eval_prompts: await readJsonl(path.join(datasetDir, "eval_prompts.jsonl")),
};

const datasetValidation = runCommand("python3", [validationScriptPath]);
const trainScriptCompile = runCommand("python3", ["-m", "py_compile", trainScriptPath]);
const localDependencies = runDependencyCheck();
const trainScriptText = await fs.readFile(trainScriptPath, "utf8");
const launchSafety = inspectLaunchSafety(trainScriptText);
const promptProfile = profileRows(rows, { maxLength, maxPromptLength });
const conclusion = conclude({ datasetValidation, trainScriptCompile, localDependencies, launchSafety, promptProfile });

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  packet_run_id: packetRunId,
  packet_summary: {
    base_model: packet.base_model,
    hub_model_id: packet.hub_model_id,
    estimated_gpu_cost_usd: packet.estimated_gpu_cost_usd,
    sft_train: rows.sft_train.length,
    sft_validation: rows.sft_validation.length,
    dpo_train: rows.dpo_train.length,
    dpo_validation: rows.dpo_validation.length,
    eval_prompts: rows.eval_prompts.length,
  },
  checks: {
    dataset_validation: datasetValidation,
    train_script_compile: trainScriptCompile,
    local_dependencies: localDependencies,
    launch_safety: launchSafety,
    prompt_profile: promptProfile,
  },
  smoke_launch_contract: {
    max_sft_steps_env: "MAX_SFT_STEPS=20",
    max_dpo_steps_env: "MAX_DPO_STEPS=10",
    push_to_hub_env: "PUSH_TO_HUB=false",
    report_to_env: "REPORT_TO=none",
    estimated_smoke_cost_usd: 4,
    budget_cap_usd: 100,
  },
  conclusion,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This launch preflight makes no OpenAI calls and creates no GPU job.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

function runCommand(command, commandArgs) {
  const child = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
  });
  return {
    command: [command, ...commandArgs].join(" "),
    exit_code: child.status,
    passed: child.status === 0,
    stdout: child.stdout.trim(),
    stderr: child.stderr.trim(),
  };
}

function runDependencyCheck() {
  const code = `
import importlib.util, json
mods = ["torch", "transformers", "datasets", "accelerate", "peft", "trl", "bitsandbytes", "trackio"]
print(json.dumps({name: bool(importlib.util.find_spec(name)) for name in mods}, indent=2))
`;
  const check = runCommand("python3", ["-c", code]);
  return {
    ...check,
    modules: check.stdout ? JSON.parse(check.stdout) : {},
  };
}

function inspectLaunchSafety(text) {
  return {
    supports_max_sft_steps: text.includes("MAX_SFT_STEPS") && text.includes("max_steps=MAX_SFT_STEPS"),
    supports_max_dpo_steps: text.includes("MAX_DPO_STEPS") && text.includes("max_steps=MAX_DPO_STEPS"),
    push_to_hub_default_false: text.includes('PUSH_TO_HUB = os.environ.get("PUSH_TO_HUB", "false")'),
    report_to_default_none: text.includes('REPORT_TO = os.environ.get("REPORT_TO", "none")'),
    unconditional_push_removed: !text.includes("\ndpo.push_to_hub()\n"),
  };
}

function profileRows(rows, { maxLength, maxPromptLength }) {
  const sftTexts = [...rows.sft_train, ...rows.sft_validation].map((row) => row.messages.map((message) => message.content).join("\n"));
  const dpoPrompts = [...rows.dpo_train, ...rows.dpo_validation].map((row) => row.prompt.map((message) => message.content).join("\n"));
  const dpoFull = [...rows.dpo_train, ...rows.dpo_validation].flatMap((row) => [
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.chosen}`,
    `${row.prompt.map((message) => message.content).join("\n")}\n${row.rejected}`,
  ]);
  const evalTexts = rows.eval_prompts.map((row) => row.messages.map((message) => message.content).join("\n"));
  return {
    approximate_token_method: "ceil(characters / 4)",
    configured_max_length: maxLength,
    configured_max_prompt_length: maxPromptLength,
    sft_full: lengthStats(sftTexts, maxLength),
    dpo_prompt: lengthStats(dpoPrompts, maxPromptLength),
    dpo_full: lengthStats(dpoFull, maxLength),
    eval_prompt: lengthStats(evalTexts, maxPromptLength),
  };
}

function lengthStats(texts, limit) {
  const counts = texts.map((text) => Math.ceil(String(text).length / 4)).sort((a, b) => a - b);
  return {
    rows: counts.length,
    min_approx_tokens: counts[0] ?? 0,
    p50_approx_tokens: percentile(counts, 0.5),
    p95_approx_tokens: percentile(counts, 0.95),
    max_approx_tokens: counts.at(-1) ?? 0,
    rows_over_limit: counts.filter((count) => count > limit).length,
  };
}

function conclude({ datasetValidation, trainScriptCompile, localDependencies, launchSafety, promptProfile }) {
  const safetyOk = Object.values(launchSafety).every(Boolean);
  const promptOverflow = promptProfile.sft_full.rows_over_limit + promptProfile.dpo_prompt.rows_over_limit + promptProfile.dpo_full.rows_over_limit;
  const requiredRemoteMissing = ["torch", "transformers", "datasets", "peft", "trl", "accelerate"]
    .filter((name) => localDependencies.modules[name] !== true);
  if (!datasetValidation.passed || !trainScriptCompile.passed) {
    return {
      status: "blocked_by_packet_or_script_error",
      next_step: "Fix dataset validation or Python syntax before any paid launch.",
    };
  }
  if (!safetyOk) {
    return {
      status: "blocked_by_unbounded_launch_script",
      next_step: "Add step caps and disable default hub push before launching paid compute.",
    };
  }
  if (promptOverflow > 0) {
    return {
      status: "needs_length_mitigation_before_full_run",
      next_step: "Reduce evidence pack or raise max length before the full run; a bounded smoke can still test script execution.",
      required_remote_missing: requiredRemoteMissing,
    };
  }
  if (requiredRemoteMissing.length) {
    return {
      status: "remote_training_ready_local_runtime_incomplete",
      next_step: "Use a remote GPU environment with the missing TRL/PEFT stack, or install dependencies locally for a dry run.",
      required_remote_missing: requiredRemoteMissing,
    };
  }
  return {
    status: "ready_for_bounded_gpu_smoke",
    next_step: "After Prime auth succeeds, ledger a planned external-compute row and launch with MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false.",
    required_remote_missing: requiredRemoteMissing,
  };
}

function renderReport(result) {
  const modules = Object.entries(result.checks.local_dependencies.modules)
    .map(([name, present]) => `| ${name} | ${present ? "present" : "missing"} |`)
    .join("\n");
  return `# Joint-Action Launch Preflight

## Scope

- Packet: \`${result.packet_run_id}\`
- Base model: \`${result.packet_summary.base_model}\`
- Estimated full GPU run: $${result.packet_summary.estimated_gpu_cost_usd.toFixed(2)}
- OpenAI calls: ${result.llm_budget.openai_llm_calls}
- External compute cost: $${result.llm_budget.external_compute_cost_usd.toFixed(2)}

## Checks

| Check | Result |
| --- | --- |
| Dataset validator | ${result.checks.dataset_validation.passed ? "passed" : "failed"} |
| Training script compile | ${result.checks.train_script_compile.passed ? "passed" : "failed"} |
| Supports SFT step cap | ${result.checks.launch_safety.supports_max_sft_steps ? "yes" : "no"} |
| Supports DPO step cap | ${result.checks.launch_safety.supports_max_dpo_steps ? "yes" : "no"} |
| Push-to-hub default | ${result.checks.launch_safety.push_to_hub_default_false ? "off" : "unsafe"} |
| Tracking default | ${result.checks.launch_safety.report_to_default_none ? "off" : "unsafe"} |

## Prompt Profile

| Surface | Rows | p50 approx tok. | p95 approx tok. | Max approx tok. | Rows over configured limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT full | ${rowStats(result.checks.prompt_profile.sft_full)} |
| DPO prompt | ${rowStats(result.checks.prompt_profile.dpo_prompt)} |
| DPO full | ${rowStats(result.checks.prompt_profile.dpo_full)} |
| Eval prompt | ${rowStats(result.checks.prompt_profile.eval_prompt)} |

Approximate token counts use \`ceil(characters / 4)\`, so they are conservative enough for launch-risk triage but not a tokenizer substitute.

## Local Dependencies

| Module | State |
| --- | --- |
${modules}

## Conclusion

Status: \`${result.conclusion.status}\`

Next step: ${result.conclusion.next_step}
`;
}

function rowStats(stats) {
  return `${stats.rows} | ${stats.p50_approx_tokens} | ${stats.p95_approx_tokens} | ${stats.max_approx_tokens} | ${stats.rows_over_limit}`;
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return values[index];
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function numberArg(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
