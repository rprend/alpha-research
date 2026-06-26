import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const sftPrepRunId = args["sft-prep-run-id"] ?? "hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1";
const runId = args["run-id"] ?? `hf-sft-launch-preflight-${sftPrepRunId}`;
const outputDir = path.join(runDir, runId);
const prepDir = path.join(runDir, sftPrepRunId);
const resultPath = path.join(outputDir, "result.json");
const reportPath = path.join(outputDir, "report.md");

await fs.mkdir(outputDir, { recursive: true });

const prep = JSON.parse(await fs.readFile(path.join(prepDir, "result.json"), "utf8"));
const datasetValidation = runCommand("node", [path.join(prepDir, "validate_dataset.mjs")]);
const trainScriptCompile = runCommand("/Users/ryanprendergast/miniconda3/bin/python3", [
  "-m",
  "py_compile",
  path.join(prepDir, "train_lora_sft_uv.py"),
], {
  PYTHONPATH: "/tmp/groundedqa-hf-runtime",
});
const localDependencies = runPythonDependencyCheck();
const hfJobsPreflight = {
  attempted: args["hf-jobs-attempted"] === "true",
  operation: "uv cpu-basic auth preflight",
  account: args["hf-account"] ?? "rprendergast",
  status: args["hf-jobs-status"] ?? "not_attempted",
  error_code: args["hf-jobs-error-code"] ?? null,
  error_summary: args["hf-jobs-error-summary"] ?? null,
};

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  sft_prep_run_id: sftPrepRunId,
  sft_prep_summary: {
    teacher_label_prefix: prep.teacher_label_prefix,
    train_windows: prep.train_windows,
    eval_window: prep.eval_window,
    train_rows: prep.examples.train,
    validation_rows: prep.examples.validation,
    eval_prompts: prep.examples.eval_prompts,
    estimated_hf_job_cost_usd: prep.estimated_hf_job_cost_usd,
    base_model: prep.base_model,
    hub_model_id: prep.hub_model_id,
  },
  checks: {
    dataset_validation: datasetValidation,
    train_script_compile: trainScriptCompile,
    local_dependencies: localDependencies,
    hf_jobs_preflight: hfJobsPreflight,
  },
  conclusion: conclude({ datasetValidation, trainScriptCompile, localDependencies, hfJobsPreflight }),
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    note: "This launch preflight makes no OpenAI API calls.",
  },
};

await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(reportPath, renderReport(result));
console.log(JSON.stringify(result, null, 2));

function runCommand(command, commandArgs, env = {}) {
  const child = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: { ...process.env, ...env },
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

function runPythonDependencyCheck() {
  const code = `
import importlib.util, json
mods = ['torch', 'transformers', 'datasets', 'accelerate', 'peft', 'trl', 'trackio']
print(json.dumps({name: bool(importlib.util.find_spec(name)) for name in mods}, indent=2))
`;
  const check = runCommand("/Users/ryanprendergast/miniconda3/bin/python3", ["-c", code], {
    PYTHONPATH: "/tmp/groundedqa-hf-runtime",
  });
  return {
    ...check,
    modules: check.stdout ? JSON.parse(check.stdout) : {},
  };
}

function conclude({ datasetValidation, trainScriptCompile, localDependencies, hfJobsPreflight }) {
  if (!datasetValidation.passed || !trainScriptCompile.passed) {
    return {
      status: "blocked_by_packet_or_script_error",
      next_step: "Fix dataset or training script before any paid training attempt.",
    };
  }
  const missingLocal = Object.entries(localDependencies.modules)
    .filter(([name, present]) => name !== "torch" && name !== "transformers" && !present)
    .map(([name]) => name);
  if (hfJobsPreflight.status === "blocked" && hfJobsPreflight.error_code === "402") {
    return {
      status: "blocked_by_hf_jobs_credits",
      next_step: "Add prepaid Hugging Face Jobs credits or run the packet on another backend with TRL/PEFT dependencies.",
      missing_local_training_dependencies: missingLocal,
    };
  }
  if (missingLocal.length) {
    return {
      status: "local_training_unavailable_but_packet_ready",
      next_step: "Install local TRL/PEFT training dependencies or use Hugging Face Jobs.",
      missing_local_training_dependencies: missingLocal,
    };
  }
  return {
    status: "ready_for_training",
    next_step: "Launch the Qwen 0.5B LoRA SFT job and evaluate the resulting adapter on the temporal eval prompts.",
  };
}

function renderReport(result) {
  const modules = Object.entries(result.checks.local_dependencies.modules)
    .map(([name, present]) => `| ${name} | ${present ? "present" : "missing"} |`)
    .join("\n");
  return `# HF SFT Launch Preflight

## Scope

SFT prep run: \`${result.sft_prep_run_id}\`

This preflight checks whether the leakage-safe temporal SFT packet can be launched now.

## Packet

| Item | Value |
| --- | --- |
| Teacher labels | \`${result.sft_prep_summary.teacher_label_prefix}\` |
| Train windows | \`${result.sft_prep_summary.train_windows.join(", ")}\` |
| Eval window | \`${result.sft_prep_summary.eval_window}\` |
| Train rows | ${result.sft_prep_summary.train_rows} |
| Validation rows | ${result.sft_prep_summary.validation_rows} |
| Eval prompts | ${result.sft_prep_summary.eval_prompts} |
| Base model | \`${result.sft_prep_summary.base_model}\` |
| Hub model | \`${result.sft_prep_summary.hub_model_id}\` |
| Estimated HF cost | $${result.sft_prep_summary.estimated_hf_job_cost_usd.toFixed(4)} |

## Checks

| Check | Result |
| --- | --- |
| Dataset validator | ${result.checks.dataset_validation.passed ? "passed" : "failed"} |
| Training script compile | ${result.checks.train_script_compile.passed ? "passed" : "failed"} |
| HF Jobs preflight | ${result.checks.hf_jobs_preflight.status} |

## Local Dependencies

| Module | State |
| --- | --- |
${modules}

## Conclusion

Status: \`${result.conclusion.status}\`

Next step: ${result.conclusion.next_step}
`;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...valueParts] = arg.slice(2).split("=");
    parsed[key] = valueParts.length ? valueParts.join("=") : "true";
  }
  return parsed;
}
