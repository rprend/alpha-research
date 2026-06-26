import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));

const packetRunId = args["packet-run-id"] ?? "joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1";
const predictionRunId = args["prediction-run-id"] ?? "joint-action-qwen3b-smoke-eval-v1";
const runId = args["run-id"] ?? "prime-qwen3b-smoke-runbook-2026-06-26-v1";
const outputDir = path.join(runsDir, runId);
const packetDir = path.join(runsDir, packetRunId);
const bootstrapPath = path.join(packetDir, "run_prime_qwen3b_smoke_on_pod.sh");

await fs.mkdir(outputDir, { recursive: true });

const launchPlan = await readResult("joint-action-launch-plan-prime-qwen3b-smoke-v1");
const remotePlan = await readResult(`joint-action-remote-smoke-plan-${packetRunId}`);
const scriptContract = await readResult("joint-action-script-contract-audit-2026-06-26-v1");
const costFinalizer = await readResult(`joint-action-smoke-ledger-finalizer-${predictionRunId}`);
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const primeHelp = {
  pods_create: runCommand("prime", ["--plain", "pods", "create", "--help"]),
  pods_status: runCommand("prime", ["--plain", "pods", "status", "--help"]),
  availability_list: runCommand("prime", ["--plain", "availability", "list", "--help"]),
};

const bootstrap = renderBootstrap({ packetRunId, predictionRunId });
await fs.writeFile(bootstrapPath, bootstrap, { mode: 0o755 });
await fs.chmod(bootstrapPath, 0o755);

const bootstrapSyntax = runCommand("bash", ["-n", bootstrapPath]);
const stat = await fs.stat(bootstrapPath);

const checks = [
  check("prime_create_supports_noninteractive_flags", includesAll(primeHelp.pods_create.stdout, ["--id", "--gpu-type", "--gpu-count", "--name", "--disk-size", "--image", "--yes"]), "Prime pods create exposes noninteractive launch flags."),
  check("prime_status_supports_json", includesAll(primeHelp.pods_status.stdout, ["--output TEXT", "JSON output"]), "Prime pod status can emit JSON for SSH/pod metadata capture."),
  check("prime_availability_supports_json_and_price", includesAll(primeHelp.availability_list.stdout, ["--output TEXT", "price_per_hour", "gpu_resources"]), "Prime availability can emit JSON with pricing fields."),
  check("bootstrap_bash_syntax_passes", bootstrapSyntax.status === 0, commandEvidence(bootstrapSyntax)),
  check("bootstrap_is_executable", Boolean(stat.mode & 0o111), "Pod bootstrap script has execute bits."),
  check("script_contract_ready", scriptContract.status === "script_contract_ready_for_paid_smoke", `Current script contract status: ${scriptContract.status}.`),
  check("launch_plan_within_budget", launchPlan.budget.launch_within_budget === true, `Estimated total if launched: $${launchPlan.budget.estimated_total_if_launched_usd}.`),
  check("cost_finalizer_waiting", costFinalizer.status === "waiting_for_smoke_artifacts", `Current finalizer status: ${costFinalizer.status}.`),
];

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "prime_qwen3b_smoke_runbook",
  status: checks.every((row) => row.status === "pass") ? "ready_after_prime_auth_and_live_price" : "runbook_risk",
  packet_run_id: packetRunId,
  prediction_run_id: predictionRunId,
  source_artifacts: {
    launch_plan_run_id: launchPlan.run_id,
    remote_smoke_plan_run_id: remotePlan.run_id,
    script_contract_run_id: scriptContract.run_id,
    cost_finalizer_run_id: costFinalizer.run_id,
  },
  bootstrap_script: {
    path: path.relative(rootDir, bootstrapPath),
    executable: Boolean(stat.mode & 0o111),
    bash_syntax_status: bootstrapSyntax.status,
  },
  checks,
  budget_context: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    actual_external_compute_spend_usd: budget.spend_usd.external_compute,
    planned_gpu_estimate_usd: launchPlan.estimated_cost_usd,
    estimated_total_if_launched_usd: launchPlan.budget.estimated_total_if_launched_usd,
    remaining_budget_usd: budget.spend_usd.remaining,
  },
  runbook_steps: [
    {
      id: "verify_prime_auth",
      command: "prime --plain whoami && prime --plain wallet",
      guard: "Must succeed before any pod creation.",
    },
    {
      id: "query_live_l4_price",
      command: "prime --plain availability list --gpu-type L4 --gpu-count 1 --output json | jq '.gpu_resources[] | {id, cloud_id, gpu_type, gpu_count, provider, location, price_per_hour, price_value, stock_status}'",
      guard: "Choose an available resource whose estimated total keeps OpenAI plus GPU spend under $100.",
    },
    {
      id: "create_bounded_pod",
      command: "prime --plain pods create --id <availability-id> --name qwen3b-grounded-qa-smoke --disk-size 160 --gpu-count 1 --image pytorch/pytorch:2.4.1-cuda12.1-cudnn9-devel --yes",
      guard: "Only run after live price and total budget are checked. Record the returned pod id.",
    },
    {
      id: "capture_pod_status",
      command: "prime --plain pods status <pod-id> --output json > docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/prime_pod_status.json",
      guard: "Keep provider, GPU, image, created_at, and SSH metadata with the prediction artifacts.",
    },
    {
      id: "sync_repo_to_pod",
      command: "Use the SSH target from pod status to rsync this repo to the pod, excluding node_modules, dist, .git, and unrelated large artifacts.",
      guard: "Do not copy secrets or .env files. The smoke does not need OpenAI credentials.",
    },
    {
      id: "run_remote_bootstrap",
      command: `bash ${path.relative(rootDir, bootstrapPath)}`,
      guard: "Run inside the synced repo on the GPU pod.",
    },
    {
      id: "fetch_prediction_artifacts",
      command: `rsync -az <pod-ssh-target>:<remote-repo>/docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/ docs/experiments/grounded-qa-distillation/runs/${predictionRunId}/`,
      guard: "Must fetch predictions.jsonl, result.json, report.md, smoke_manifest.json, and remote_smoke_bootstrap_manifest.json.",
    },
    {
      id: "record_actual_compute_cost",
      command: "node scripts/grounded-qa-distillation-joint-action-smoke-ledger-finalizer.mjs --record=true --status=completed --actual-cost-usd=<backend-cost> --backend-run-id=<pod-id>",
      guard: "Only after artifacts exist and Prime billing/cost is known.",
    },
    {
      id: "terminate_pod",
      command: "prime --plain pods terminate <pod-id>",
      guard: "Terminate immediately after artifacts are fetched or on any failure.",
    },
  ],
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This runbook generates local files and reads no authenticated Prime resources.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  checks: result.checks.map(({ id, status }) => ({ id, status })),
}, null, 2));

function renderBootstrap({ packetRunId, predictionRunId }) {
  return `#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="\${REPO_ROOT:-$(pwd)}"
PACKET_DIR="\${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${packetRunId}"
RUN_ID="\${RUN_ID:-${predictionRunId}}"
OUTPUT_DIR="\${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/\${RUN_ID}"
BOOTSTRAP_MANIFEST="\${OUTPUT_DIR}/remote_smoke_bootstrap_manifest.json"
export REPO_ROOT PACKET_DIR RUN_ID OUTPUT_DIR

mkdir -p "\${OUTPUT_DIR}"
cd "\${REPO_ROOT}"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="\${HOME}/.local/bin:\${PATH}"
fi

{
  echo "=== date ==="
  date -u +"%Y-%m-%dT%H:%M:%SZ"
  echo "=== uname ==="
  uname -a
  echo "=== gpu ==="
  nvidia-smi || true
  echo "=== uv ==="
  uv --version
  echo "=== git ==="
  git rev-parse HEAD 2>/dev/null || true
} | tee "\${OUTPUT_DIR}/remote_environment.txt"

RUN_ID="\${RUN_ID}" \\
MAX_SFT_STEPS="\${MAX_SFT_STEPS:-20}" \\
MAX_DPO_STEPS="\${MAX_DPO_STEPS:-10}" \\
PUSH_TO_HUB="\${PUSH_TO_HUB:-false}" \\
REPORT_TO="\${REPORT_TO:-none}" \\
"\${PACKET_DIR}/run_joint_action_smoke.sh"

python3 - <<'PY'
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(os.environ["OUTPUT_DIR"])
def capture(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT).strip()
    except Exception as exc:
        return str(exc)

manifest = {
    "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "run_id": os.environ["RUN_ID"],
    "packet_dir": os.environ["PACKET_DIR"],
    "repo_root": os.environ["REPO_ROOT"],
    "git_head": capture("git rev-parse HEAD"),
    "gpu": capture("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader"),
    "uv_version": capture("uv --version"),
    "artifacts": {
        "predictions_jsonl": str(output_dir / "predictions.jsonl"),
        "result_json": str(output_dir / "result.json"),
        "report_md": str(output_dir / "report.md"),
        "smoke_manifest_json": str(output_dir / "smoke_manifest.json"),
        "remote_environment_txt": str(output_dir / "remote_environment.txt"),
        "remote_smoke_bootstrap_manifest_json": str(output_dir / "remote_smoke_bootstrap_manifest.json"),
    },
}
(output_dir / "remote_smoke_bootstrap_manifest.json").write_text(json.dumps(manifest, indent=2) + "\\n")
print(json.dumps(manifest, indent=2))
PY
`;
}

function runCommand(command, commandArgs) {
  const completed = spawnSync(command, commandArgs, { cwd: rootDir, encoding: "utf8" });
  return {
    command: [command, ...commandArgs].join(" "),
    status: completed.status,
    stdout: completed.stdout.trim(),
    stderr: completed.stderr.trim(),
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

async function readResult(runId) {
  return readJson(path.join(runsDir, runId, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function renderReport(result) {
  return `# Prime Qwen 3B Smoke Runbook

Generated: ${result.generated_at}

Status: \`${result.status}\`

## Checks

${result.checks.map((row) => `- ${row.status === "pass" ? "PASS" : "FAIL"} ${row.id}: ${row.evidence}`).join("\n")}

## Budget

- Actual total spend: $${result.budget_context.actual_total_spend_usd.toFixed(6)}
- Actual external compute spend: $${result.budget_context.actual_external_compute_spend_usd.toFixed(6)}
- Planned GPU estimate: $${Number(result.budget_context.planned_gpu_estimate_usd).toFixed(6)}
- Estimated total if launched: $${Number(result.budget_context.estimated_total_if_launched_usd).toFixed(6)}
- Remaining budget: $${result.budget_context.remaining_budget_usd.toFixed(6)}

## Steps

${result.runbook_steps.map((step, index) => `${index + 1}. ${step.id}\n\n   \`\`\`bash\n   ${step.command}\n   \`\`\`\n\n   Guard: ${step.guard}`).join("\n\n")}

This runbook makes no OpenAI calls, launches no GPU jobs, and records no spend.
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
