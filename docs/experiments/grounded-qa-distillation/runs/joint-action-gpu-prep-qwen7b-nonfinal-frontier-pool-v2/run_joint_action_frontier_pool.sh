#!/usr/bin/env bash
set -euo pipefail

PACKET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${PACKET_DIR}/../../../../.." && pwd)"
RUN_ID="${RUN_ID:-joint-action-qwen7b-nonfinal-frontier-pool-v2}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${RUN_ID}}"
MANIFEST_PATH="${OUTPUT_DIR}/smoke_manifest.json"

MAX_SFT_STEPS="${MAX_SFT_STEPS:-20}"
MAX_DPO_STEPS="${MAX_DPO_STEPS:-10}"
PUSH_TO_HUB="${PUSH_TO_HUB:-false}"
REPORT_TO="${REPORT_TO:-none}"
ADAPTER_DIR="${ADAPTER_DIR:-joint-action-dpo-adapter}"
MAX_NEW_TOKENS="${MAX_NEW_TOKENS:-384}"
NUM_RETURN_SEQUENCES="${NUM_RETURN_SEQUENCES:-3}"
TEMPERATURE="${TEMPERATURE:-0.7}"
TOP_P="${TOP_P:-0.9}"
MAX_EVAL_EXAMPLES="${MAX_EVAL_EXAMPLES:-80}"

mkdir -p "${OUTPUT_DIR}"
cd "${REPO_ROOT}"

uv run "${PACKET_DIR}/validate_joint_action_dataset_uv.py"

MAX_SFT_STEPS="${MAX_SFT_STEPS}" \
MAX_DPO_STEPS="${MAX_DPO_STEPS}" \
PUSH_TO_HUB="${PUSH_TO_HUB}" \
REPORT_TO="${REPORT_TO}" \
uv run "${PACKET_DIR}/train_joint_action_lora_uv.py"

ADAPTER_DIR="${ADAPTER_DIR}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
MAX_NEW_TOKENS="${MAX_NEW_TOKENS}" \
NUM_RETURN_SEQUENCES="${NUM_RETURN_SEQUENCES}" \
TEMPERATURE="${TEMPERATURE}" \
TOP_P="${TOP_P}" \
MAX_EVAL_EXAMPLES="${MAX_EVAL_EXAMPLES}" \
uv run "${PACKET_DIR}/eval_joint_action_frontier_pool_uv.py"

python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(os.environ.get("OUTPUT_DIR", "docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-nonfinal-frontier-pool-v2")).resolve()
manifest = {
    "run_id": os.environ.get("RUN_ID", "joint-action-qwen7b-nonfinal-frontier-pool-v2"),
    "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "packet_dir": str(Path("joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2")),
    "max_sft_steps": int(os.environ.get("MAX_SFT_STEPS", "20")),
    "max_dpo_steps": int(os.environ.get("MAX_DPO_STEPS", "10")),
    "num_return_sequences": int(os.environ.get("NUM_RETURN_SEQUENCES", "3")),
    "temperature": float(os.environ.get("TEMPERATURE", "0.7")),
    "top_p": float(os.environ.get("TOP_P", "0.9")),
    "output_dir": str(output_dir),
    "artifacts": {
        "predictions_jsonl": str(output_dir / "predictions.jsonl"),
        "result_json": str(output_dir / "result.json"),
        "report_md": str(output_dir / "report.md"),
        "smoke_manifest_json": str(output_dir / "smoke_manifest.json"),
    },
    "next_step": "Citation-repair and judge this non-final frontier pool before verifier training.",
}
(output_dir / "smoke_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
PY

echo "Joint-action frontier pool smoke complete: ${MANIFEST_PATH}"
