#!/usr/bin/env bash
set -euo pipefail

PACKET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${PACKET_DIR}/../../../../.." && pwd)"
RUN_ID="${RUN_ID:-frontier-repaired-qwen3b-validation-smoke-v1}"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/docs/experiments/grounded-qa-distillation/runs/${RUN_ID}}"
MANIFEST_PATH="${OUTPUT_DIR}/smoke_manifest.json"

MAX_SFT_STEPS="${MAX_SFT_STEPS:-20}"
MAX_DPO_STEPS="${MAX_DPO_STEPS:-10}"
PUSH_TO_HUB="${PUSH_TO_HUB:-false}"
REPORT_TO="${REPORT_TO:-none}"
ADAPTER_DIR="${ADAPTER_DIR:-joint-action-dpo-adapter}"
MAX_NEW_TOKENS="${MAX_NEW_TOKENS:-384}"

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
uv run "${PACKET_DIR}/eval_joint_action_adapter_uv.py"

SMOKE_RUN_ID="${RUN_ID}" \
SMOKE_PACKET_DIR="${PACKET_DIR}" \
SMOKE_OUTPUT_DIR="${OUTPUT_DIR}" \
SMOKE_MAX_SFT_STEPS="${MAX_SFT_STEPS}" \
SMOKE_MAX_DPO_STEPS="${MAX_DPO_STEPS}" \
SMOKE_PUSH_TO_HUB="${PUSH_TO_HUB}" \
SMOKE_REPORT_TO="${REPORT_TO}" \
SMOKE_ADAPTER_DIR="${ADAPTER_DIR}" \
python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

output_dir = Path(os.environ["SMOKE_OUTPUT_DIR"])
manifest = {
    "run_id": os.environ["SMOKE_RUN_ID"],
    "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "packet_dir": os.environ["SMOKE_PACKET_DIR"],
    "max_sft_steps": int(os.environ["SMOKE_MAX_SFT_STEPS"]),
    "max_dpo_steps": int(os.environ["SMOKE_MAX_DPO_STEPS"]),
    "push_to_hub": os.environ["SMOKE_PUSH_TO_HUB"].lower() == "true",
    "report_to": os.environ["SMOKE_REPORT_TO"],
    "adapter_dir": os.environ["SMOKE_ADAPTER_DIR"],
    "output_dir": str(output_dir),
    "artifacts": {
        "predictions_jsonl": str(output_dir / "predictions.jsonl"),
        "result_json": str(output_dir / "result.json"),
        "report_md": str(output_dir / "report.md"),
        "smoke_manifest_json": str(output_dir / "smoke_manifest.json"),
    },
    "next_step": "Accept only if the repaired validation contract gate beats the train-calibrated scaffold baseline before any paid judging.",
}
(output_dir / "smoke_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
PY


CONTRACT_GATE_RUN_ID="${RUN_ID}-evidence-first-contract-gate"
node scripts/grounded-qa-distillation-evidence-first-contract-preflight.mjs \
  --packet-run-id=support-boundary-schema-packet-frontier-repaired-v1 \
  --prediction-file="${OUTPUT_DIR}/predictions.jsonl" \
  --run-id="${CONTRACT_GATE_RUN_ID}"

echo "Evidence-first joint-action smoke complete: ${MANIFEST_PATH}"
