import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runsDir = path.join(experimentDir, "runs");
const reportsDir = path.join(experimentDir, "reports");
const args = parseArgs(process.argv.slice(2));

const sourcePacketRunId = args["source-packet"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1";
const runId = args["run-id"] ?? "joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2";
const smokeRunId = args["smoke-run-id"] ?? "joint-action-qwen7b-nonfinal-frontier-pool-v2";
const numReturnSequences = Number(args["num-return-sequences"] ?? 3);
const temperature = Number(args.temperature ?? 0.7);
const topP = Number(args["top-p"] ?? 0.9);
const maxEvalExamples = Number(args["max-eval-examples"] ?? 80);
const estimatedGpuCostUsd = Number(args["estimated-gpu-cost-usd"] ?? 5);
const sourceDir = path.join(runsDir, sourcePacketRunId);
const outputDir = path.join(runsDir, runId);
const sourceDatasetDir = path.join(sourceDir, "dataset");
const datasetDir = path.join(outputDir, "dataset");

await fs.mkdir(datasetDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const sourceResult = await readJson(path.join(sourceDir, "result.json"));
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));
const evalPrompts = await readJsonl(path.join(sourceDatasetDir, "eval_prompts.jsonl"));

for (const file of ["sft_train.jsonl", "sft_validation.jsonl", "dpo_train.jsonl", "dpo_validation.jsonl", "eval_prompts.jsonl", "README.md"]) {
  await fs.copyFile(path.join(sourceDatasetDir, file), path.join(datasetDir, file));
}
for (const file of ["validate_joint_action_dataset_uv.py", "train_joint_action_lora_uv.py", "run_prime_qwen3b_smoke_on_pod.sh"]) {
  await fs.copyFile(path.join(sourceDir, file), path.join(outputDir, file));
}

const evalScript = await renderFrontierPoolEvalScript(path.join(sourceDir, "eval_joint_action_adapter_uv.py"));
await fs.writeFile(path.join(outputDir, "eval_joint_action_frontier_pool_uv.py"), evalScript);
await fs.writeFile(path.join(outputDir, "run_joint_action_frontier_pool.sh"), renderRunner());
await fs.writeFile(path.join(outputDir, "run_prime_qwen3b_smoke_on_pod.sh"), renderPrimeBootstrap());
await fs.writeFile(path.join(outputDir, "prime_gpu_plan.md"), renderPrimePlan());
await fs.chmod(path.join(outputDir, "run_joint_action_frontier_pool.sh"), 0o755);
await fs.chmod(path.join(outputDir, "run_prime_qwen3b_smoke_on_pod.sh"), 0o755);

const projectedTotal = budget.spend_usd.total_actual + estimatedGpuCostUsd;
const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "qwen_nonfinal_frontier_pool_launch_packet",
  status: "ready_for_bounded_gpu_frontier_pool_after_preflight",
  purpose: "Generate multiple leakage-safe non-final Qwen candidates per input so verifier training can use frontier-style selected-vs-supported contrasts rather than reference-vs-unsupported contrasts.",
  source_packet_run_id: sourcePacketRunId,
  smoke_run_id: smokeRunId,
  base_model: sourceResult.base_model ?? "Qwen/Qwen2.5-7B-Instruct",
  eval_sampling: {
    num_return_sequences: numReturnSequences,
    temperature,
    top_p: topP,
    max_eval_examples: maxEvalExamples,
    projected_predictions: Math.min(evalPrompts.length, maxEvalExamples || evalPrompts.length) * numReturnSequences,
  },
  inherited_windows: sourceResult.windows,
  inherited_examples: sourceResult.examples,
  leakage_guard: {
    inherited_final_window_labels_used: sourceResult.leakage_guard?.final_window_labels_used,
    inherited_eval_window_is_final_window: sourceResult.leakage_guard?.eval_window_is_final_window,
    inherited_train_eval_paper_overlap: sourceResult.leakage_guard?.train_eval_paper_overlap ?? [],
    final_window_labels_used_for_training: false,
    final_window_training_use: "not_final_window",
    expected_candidate_use: "allowed_for_nonfinal_verifier_supervision_after_judging",
  },
  launch_gate: {
    launch_next_gpu_now: false,
    estimated_gpu_cost_usd: estimatedGpuCostUsd,
    projected_total_after_frontier_pool_usd: projectedTotal,
    within_budget: projectedTotal <= budget.max_budget_usd,
    required_before_launch: [
      "Run the copied dataset validator.",
      "Run python syntax checks for train/eval scripts.",
      "Run grounded-QA repository validator.",
      "Check Prime auth, wallet, active pods, and live GPU availability.",
      "Run bounded smoke with MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, NUM_RETURN_SEQUENCES=3, PUSH_TO_HUB=false, and REPORT_TO=none.",
      "After predictions exist, citation-repair and judge the non-final frontier pool before using it as verifier supervision.",
    ],
  },
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    openai_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "Packet materialization is local and deterministic. No API/model calls and no GPU job.",
  },
  artifacts: {
    dataset_dir: rel(datasetDir),
    validate_script: rel(path.join(outputDir, "validate_joint_action_dataset_uv.py")),
    train_script: rel(path.join(outputDir, "train_joint_action_lora_uv.py")),
    frontier_pool_eval_script: rel(path.join(outputDir, "eval_joint_action_frontier_pool_uv.py")),
    frontier_pool_runner: rel(path.join(outputDir, "run_joint_action_frontier_pool.sh")),
    prime_bootstrap: rel(path.join(outputDir, "run_prime_qwen3b_smoke_on_pod.sh")),
    prime_plan: rel(path.join(outputDir, "prime_gpu_plan.md")),
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This packet creates launch artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
const report = renderReport(result);
await fs.writeFile(path.join(outputDir, "report.md"), report);
await fs.writeFile(path.join(reportsDir, `${runId}.md`), report);

console.log(JSON.stringify({
  run_id: result.run_id,
  status: result.status,
  eval_sampling: result.eval_sampling,
  launch_gate: result.launch_gate,
}, null, 2));

async function renderFrontierPoolEvalScript(sourceFile) {
  const source = await fs.readFile(sourceFile, "utf8");
  return source
    .replace('MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "384"))\nMODEL_DEVICE_MAP = os.environ.get("MODEL_DEVICE_MAP", "auto").lower()',
      'MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "384"))\nNUM_RETURN_SEQUENCES = int(os.environ.get("NUM_RETURN_SEQUENCES", "3"))\nTEMPERATURE = float(os.environ.get("TEMPERATURE", "0.7"))\nTOP_P = float(os.environ.get("TOP_P", "0.9"))\nMODEL_DEVICE_MAP = os.environ.get("MODEL_DEVICE_MAP", "auto").lower()')
    .replace('def render_report(result):\n    metrics = result["eval"]\n    return f"""# Joint-Action Qwen 7B Span/Claim Adapter Eval',
      'def render_report(result):\n    metrics = result["eval"]\n    return f"""# Joint-Action Qwen 7B Non-Final Frontier Pool Eval')
    .replace('for row in eval_rows:\n    prompt = tokenizer.apply_chat_template(row["messages"], tokenize=False, add_generation_prompt=True)\n    inputs = tokenizer(prompt, return_tensors="pt")\n    inputs = {key: value.to(model.device) for key, value in inputs.items()}\n    with torch.no_grad():\n        output = model.generate(\n            **inputs,\n            max_new_tokens=MAX_NEW_TOKENS,\n            do_sample=False,\n            pad_token_id=tokenizer.eos_token_id,\n        )\n    generated = tokenizer.decode(output[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)\n    prediction, parse_error = parse_prediction(generated)\n    predictions.append({\n        "example_id": row["example_id"],\n        "prediction": prediction,\n        "reference": row["reference"],\n        "scores": score_prediction(row, prediction),\n        "raw_output": generated,\n        "parse_error": parse_error,\n        "metadata": {\n            "base_model": BASE_MODEL,\n            "adapter_dir": ADAPTER_DIR,\n        },\n    })',
      'for row in eval_rows:\n    prompt = tokenizer.apply_chat_template(row["messages"], tokenize=False, add_generation_prompt=True)\n    inputs = tokenizer(prompt, return_tensors="pt")\n    inputs = {key: value.to(model.device) for key, value in inputs.items()}\n    for sample_index in range(NUM_RETURN_SEQUENCES):\n        with torch.no_grad():\n            output = model.generate(\n                **inputs,\n                max_new_tokens=MAX_NEW_TOKENS,\n                do_sample=True,\n                temperature=TEMPERATURE,\n                top_p=TOP_P,\n                pad_token_id=tokenizer.eos_token_id,\n            )\n        generated = tokenizer.decode(output[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)\n        prediction, parse_error = parse_prediction(generated)\n        predictions.append({\n            "example_id": f"{row[\'example_id\']}::sample-{sample_index}",\n            "root_example_id": row["example_id"],\n            "sample_index": sample_index,\n            "prediction": prediction,\n            "reference": row["reference"],\n            "scores": score_prediction(row, prediction),\n            "raw_output": generated,\n            "parse_error": parse_error,\n            "metadata": {\n                "base_model": BASE_MODEL,\n                "adapter_dir": ADAPTER_DIR,\n                "num_return_sequences": NUM_RETURN_SEQUENCES,\n                "temperature": TEMPERATURE,\n                "top_p": TOP_P,\n                "candidate_pool_use": "allowed_nonfinal_frontier_supervision_after_judging",\n                "final_window": False,\n            },\n        })')
    .replace('"model_family": "qwen2_5_7b_nonfinal_frontier_joint_action_lora",',
      '"model_family": "qwen2_5_7b_nonfinal_frontier_pool_joint_action_lora",')
    .replace('"next_required_step": "Run grounded-correctness judging over predictions.jsonl.",',
      '"eval_sampling": {"num_return_sequences": NUM_RETURN_SEQUENCES, "temperature": TEMPERATURE, "top_p": TOP_P},\n    "next_required_step": "Run citation repair and grounded-correctness judging over the non-final frontier pool predictions.jsonl.",');
}

function renderRunner() {
  return `#!/usr/bin/env bash
set -euo pipefail

PACKET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "\${PACKET_DIR}/../../../../.." && pwd)"
RUN_ID="\${RUN_ID:-${smokeRunId}}"
OUTPUT_DIR="\${OUTPUT_DIR:-\${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/\${RUN_ID}}"
MANIFEST_PATH="\${OUTPUT_DIR}/smoke_manifest.json"

MAX_SFT_STEPS="\${MAX_SFT_STEPS:-20}"
MAX_DPO_STEPS="\${MAX_DPO_STEPS:-10}"
PUSH_TO_HUB="\${PUSH_TO_HUB:-false}"
REPORT_TO="\${REPORT_TO:-none}"
ADAPTER_DIR="\${ADAPTER_DIR:-joint-action-dpo-adapter}"
MAX_NEW_TOKENS="\${MAX_NEW_TOKENS:-384}"
NUM_RETURN_SEQUENCES="\${NUM_RETURN_SEQUENCES:-${numReturnSequences}}"
TEMPERATURE="\${TEMPERATURE:-${temperature}}"
TOP_P="\${TOP_P:-${topP}}"
MAX_EVAL_EXAMPLES="\${MAX_EVAL_EXAMPLES:-${maxEvalExamples}}"

mkdir -p "\${OUTPUT_DIR}"
cd "\${REPO_ROOT}"

uv run "\${PACKET_DIR}/validate_joint_action_dataset_uv.py"

MAX_SFT_STEPS="\${MAX_SFT_STEPS}" \\
MAX_DPO_STEPS="\${MAX_DPO_STEPS}" \\
PUSH_TO_HUB="\${PUSH_TO_HUB}" \\
REPORT_TO="\${REPORT_TO}" \\
uv run "\${PACKET_DIR}/train_joint_action_lora_uv.py"

ADAPTER_DIR="\${ADAPTER_DIR}" \\
OUTPUT_DIR="\${OUTPUT_DIR}" \\
MAX_NEW_TOKENS="\${MAX_NEW_TOKENS}" \\
NUM_RETURN_SEQUENCES="\${NUM_RETURN_SEQUENCES}" \\
TEMPERATURE="\${TEMPERATURE}" \\
TOP_P="\${TOP_P}" \\
MAX_EVAL_EXAMPLES="\${MAX_EVAL_EXAMPLES}" \\
uv run "\${PACKET_DIR}/eval_joint_action_frontier_pool_uv.py"

python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(os.environ.get("OUTPUT_DIR", "docs/experiments/grounded-qa-distillation/runs/${smokeRunId}")).resolve()
manifest = {
    "run_id": os.environ.get("RUN_ID", "${smokeRunId}"),
    "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "packet_dir": str(Path("${runId}")),
    "max_sft_steps": int(os.environ.get("MAX_SFT_STEPS", "20")),
    "max_dpo_steps": int(os.environ.get("MAX_DPO_STEPS", "10")),
    "num_return_sequences": int(os.environ.get("NUM_RETURN_SEQUENCES", "${numReturnSequences}")),
    "temperature": float(os.environ.get("TEMPERATURE", "${temperature}")),
    "top_p": float(os.environ.get("TOP_P", "${topP}")),
    "output_dir": str(output_dir),
    "artifacts": {
        "predictions_jsonl": str(output_dir / "predictions.jsonl"),
        "result_json": str(output_dir / "result.json"),
        "report_md": str(output_dir / "report.md"),
        "smoke_manifest_json": str(output_dir / "smoke_manifest.json"),
    },
    "next_step": "Citation-repair and judge this non-final frontier pool before verifier training.",
}
(output_dir / "smoke_manifest.json").write_text(json.dumps(manifest, indent=2) + "\\n")
print(json.dumps(manifest, indent=2))
PY

echo "Joint-action frontier pool smoke complete: \${MANIFEST_PATH}"
`;
}

function renderPrimePlan() {
  return `# Prime GPU Plan: Qwen 7B Non-Final Frontier Pool

Packet: \`${runId}\`

Smoke run id: \`${smokeRunId}\`

This is a bounded candidate-pool generation run for verifier supervision. It is not a final-window student result.

\`\`\`bash
uv run docs/experiments/grounded-qa-distillation/runs/${runId}/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=${smokeRunId} MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 NUM_RETURN_SEQUENCES=${numReturnSequences} TEMPERATURE=${temperature} TOP_P=${topP} MAX_EVAL_EXAMPLES=${maxEvalExamples} PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/${runId}/run_joint_action_frontier_pool.sh
\`\`\`

Budget guard: do not launch if live price plus tracked spend would exceed $100. Fetch artifacts, terminate the pod, and ledger actual compute spend immediately.
`;
}

function renderPrimeBootstrap() {
  return `#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="\${REPO_ROOT:-$(pwd)}"
PACKET_DIR="\${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${runId}"
RUN_ID="\${RUN_ID:-${smokeRunId}}"
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
NUM_RETURN_SEQUENCES="\${NUM_RETURN_SEQUENCES:-${numReturnSequences}}" \\
TEMPERATURE="\${TEMPERATURE:-${temperature}}" \\
TOP_P="\${TOP_P:-${topP}}" \\
MAX_EVAL_EXAMPLES="\${MAX_EVAL_EXAMPLES:-${maxEvalExamples}}" \\
PUSH_TO_HUB="\${PUSH_TO_HUB:-false}" \\
REPORT_TO="\${REPORT_TO:-none}" \\
"\${PACKET_DIR}/run_joint_action_frontier_pool.sh"

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

echo "Joint-action frontier pool remote bootstrap complete: \${BOOTSTRAP_MANIFEST}"
`;
}

function renderReport(result) {
  return `# Qwen Non-Final Frontier Pool Launch Packet

Generated: ${result.generated_at}

Status: \`${result.status}\`

This packet makes no OpenAI calls and launches no compute.

| Eval prompts | Samples per prompt | Projected predictions | Estimated GPU cost | Projected total |
| ---: | ---: | ---: | ---: | ---: |
| ${Math.min(maxEvalExamples, result.inherited_examples.eval_prompts)} | ${result.eval_sampling.num_return_sequences} | ${result.eval_sampling.projected_predictions} | $${result.launch_gate.estimated_gpu_cost_usd.toFixed(2)} | $${result.launch_gate.projected_total_after_frontier_pool_usd.toFixed(2)} |

## Decision

Launch now: \`${result.launch_gate.launch_next_gpu_now}\`

The next paid run should produce multiple non-final candidates per input, then citation-repair and judge them before verifier training.
`;
}

function rel(file) {
  return path.relative(rootDir, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.length ? rest.join("=") : true;
  }
  return parsed;
}
