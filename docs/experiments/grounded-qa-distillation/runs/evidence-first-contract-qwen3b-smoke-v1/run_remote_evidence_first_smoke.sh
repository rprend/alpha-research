#!/usr/bin/env bash
set -euo pipefail

export REPO_ROOT="${REPO_ROOT:-$HOME/alpha-research}"
export PACKET_DIR="${PACKET_DIR:-$REPO_ROOT/docs/experiments/grounded-qa-distillation/runs/evidence-first-contract-launch-packet-2026-06-28-v1}"
export RUN_ID="${RUN_ID:-evidence-first-contract-qwen3b-smoke-v1}"
export OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/docs/experiments/grounded-qa-distillation/runs/$RUN_ID}"
export MAX_SFT_STEPS="${MAX_SFT_STEPS:-20}"
export MAX_DPO_STEPS="${MAX_DPO_STEPS:-10}"
export PUSH_TO_HUB="${PUSH_TO_HUB:-false}"
export REPORT_TO="${REPORT_TO:-none}"
export ADAPTER_DIR="${ADAPTER_DIR:-joint-action-dpo-adapter}"
export MAX_NEW_TOKENS="${MAX_NEW_TOKENS:-512}"

mkdir -p "$OUTPUT_DIR"
cd "$REPO_ROOT"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

{
  echo "=== date ==="
  date -u +"%Y-%m-%dT%H:%M:%SZ"
  echo "=== gpu ==="
  nvidia-smi || true
  echo "=== uv ==="
  uv --version
  echo "=== validate ==="
  uv run "$PACKET_DIR/validate_joint_action_dataset_uv.py"
  echo "=== train ==="
  MAX_SFT_STEPS="$MAX_SFT_STEPS" \
    MAX_DPO_STEPS="$MAX_DPO_STEPS" \
    PUSH_TO_HUB="$PUSH_TO_HUB" \
    REPORT_TO="$REPORT_TO" \
    uv run "$PACKET_DIR/train_joint_action_lora_uv.py"
  echo "=== eval ==="
  ADAPTER_DIR="$ADAPTER_DIR" \
    OUTPUT_DIR="$OUTPUT_DIR" \
    MAX_NEW_TOKENS="$MAX_NEW_TOKENS" \
    uv run "$PACKET_DIR/eval_joint_action_adapter_uv.py"
  echo "=== manifest ==="
  python3 - <<'PY'
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

out = Path(os.environ["OUTPUT_DIR"])

def cap(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT).strip()
    except Exception as exc:
        return str(exc)

manifest = {
    "run_id": os.environ["RUN_ID"],
    "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "packet_dir": os.environ["PACKET_DIR"],
    "max_sft_steps": int(os.environ["MAX_SFT_STEPS"]),
    "max_dpo_steps": int(os.environ["MAX_DPO_STEPS"]),
    "push_to_hub": os.environ["PUSH_TO_HUB"].lower() == "true",
    "report_to": os.environ["REPORT_TO"],
    "adapter_dir": os.environ["ADAPTER_DIR"],
    "gpu": cap("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader"),
    "artifacts": {
        "predictions_jsonl": str(out / "predictions.jsonl"),
        "result_json": str(out / "result.json"),
        "report_md": str(out / "report.md"),
        "smoke_manifest_json": str(out / "smoke_manifest.json"),
        "remote_smoke_log": str(out / "remote_smoke.log"),
    },
}
(out / "smoke_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
PY
} 2>&1 | tee "$OUTPUT_DIR/remote_smoke.log"
