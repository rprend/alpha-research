import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "joint-action-local-qwen3b-feasibility-probe-2026-06-26-v1";
const outputDir = path.join(runDir, runId);
const packetRunId = "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const preflightRunId = `joint-action-launch-preflight-${packetRunId}`;
const trainScript = path.join(runDir, packetRunId, "train_joint_action_lora_uv.py");

await fs.mkdir(outputDir, { recursive: true });

const trainScriptText = await fs.readFile(trainScript, "utf8");
const preflight = await readResult(preflightRunId);
const packet = await readResult(packetRunId);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  probe_type: "local_qwen3b_joint_action_training_feasibility",
  packet_run_id: packetRunId,
  preflight_run_id: preflightRunId,
  local_environment: {
    machine_memory_bytes: 25769803776,
    cpu_count: 10,
    torch_version: "2.8.0",
    mps_available: true,
    uv_version: "0.10.9",
  },
  script_patch: {
    model_device_map_env_supported: trainScriptText.includes("MODEL_DEVICE_MAP"),
    no_offload_mode: "MODEL_DEVICE_MAP=none maps to model_init_kwargs {'device_map': None}",
    remote_default_unchanged: "MODEL_DEVICE_MAP defaults to auto for remote/GPU launches.",
  },
  attempted_commands: [
    {
      id: "auto_device_map_1step",
      command: "MAX_SFT_STEPS=1 MAX_DPO_STEPS=1 PUSH_TO_HUB=false REPORT_TO=none uv run .../train_joint_action_lora_uv.py",
      outcome: "failed",
      stage_reached: "Qwen 2.5 3B loaded with disk/meta offload; SFT dataset tokenized; first backward pass started.",
      failure_class: "local_offload_training_incompatible",
      error_summary: "RuntimeError: Function MmBackward0 returned an invalid gradient at index 1 - expected device meta but got mps:0",
      spend_usd: 0,
    },
    {
      id: "no_offload_mps_1step",
      command: "MODEL_DEVICE_MAP=none MAX_SFT_STEPS=1 MAX_DPO_STEPS=1 PUSH_TO_HUB=false REPORT_TO=none uv run .../train_joint_action_lora_uv.py",
      outcome: "stopped_after_timeout",
      stage_reached: "Qwen 2.5 3B loaded without meta/disk offload warning; SFT dataset tokenized; first backward pass ran for about 5 minutes without completing one step.",
      failure_class: "local_training_too_slow_for_bounded_smoke",
      error_summary: "KeyboardInterrupt after about 5 minutes at 0/1 SFT steps; no checkpoint written.",
      spend_usd: 0,
    },
  ],
  conclusions: {
    dependency_status: "uv can resolve and install the TRL/PEFT/Transformers stack locally.",
    local_training_status: "not_practical_for_qwen3b_joint_action_smoke",
    remote_training_status: "still_required",
    reason: "The local Mac can load Qwen 3B and start SFT, but auto offload breaks backward and no-offload MPS does not complete a single bounded step in a reasonable smoke window.",
    next_step: "Refresh Prime auth or add HF credits, then execute the existing budget-gated remote GPU smoke plan.",
  },
  budget_context: {
    actual_spend_usd_before_and_after: 5.878323650000014,
    external_compute_spend_usd: 0,
    remaining_budget_usd: 94.12167634999999,
    planned_prime_smoke_estimate_usd: 4,
  },
  packet_summary: packet.examples,
  preflight_status: preflight.conclusion?.status ?? null,
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Local feasibility probe used uv/model downloads only; it made no OpenAI calls and created no paid GPU job.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(runId) {
  return JSON.parse(await fs.readFile(path.join(runDir, runId, "result.json"), "utf8"));
}

function renderReport(result) {
  const attemptRows = result.attempted_commands.map((attempt) => `| ${attempt.id} | ${attempt.outcome} | ${attempt.stage_reached} | ${attempt.failure_class} |`).join("\n");
  return `# Joint-Action Qwen 3B Local Feasibility Probe

This records local no-spend attempts to run the bounded Qwen 3B joint-action smoke before using paid GPU compute.

## Environment

- Memory: ${(result.local_environment.machine_memory_bytes / 1024 / 1024 / 1024).toFixed(1)} GiB
- CPU count: ${result.local_environment.cpu_count}
- Torch: ${result.local_environment.torch_version}
- MPS available: ${result.local_environment.mps_available}
- uv: ${result.local_environment.uv_version}

## Attempts

| Attempt | Outcome | Stage reached | Failure class |
| --- | --- | --- | --- |
${attemptRows}

## Conclusion

${result.conclusions.reason}

Next step: ${result.conclusions.next_step}

## Budget

- OpenAI calls: 0
- OpenAI cost: $0
- External compute cost: $0
- Actual total spend remains $${result.budget_context.actual_spend_usd_before_and_after}
- Remaining budget: $${result.budget_context.remaining_budget_usd}
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
