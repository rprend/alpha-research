#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(pwd)}"
PACKET_DIR="${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6"
RUN_ID="${RUN_ID:-joint-action-qwen3b-smoke-eval-v1}"
OUTPUT_DIR="${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${RUN_ID}"
BOOTSTRAP_MANIFEST="${OUTPUT_DIR}/remote_smoke_bootstrap_manifest.json"
export REPO_ROOT PACKET_DIR RUN_ID OUTPUT_DIR

mkdir -p "${OUTPUT_DIR}"
cd "${REPO_ROOT}"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
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
} | tee "${OUTPUT_DIR}/remote_environment.txt"

RUN_ID="${RUN_ID}" \
MAX_SFT_STEPS="${MAX_SFT_STEPS:-20}" \
MAX_DPO_STEPS="${MAX_DPO_STEPS:-10}" \
PUSH_TO_HUB="${PUSH_TO_HUB:-false}" \
REPORT_TO="${REPORT_TO:-none}" \
"${PACKET_DIR}/run_joint_action_smoke.sh"

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
(output_dir / "remote_smoke_bootstrap_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
PY
