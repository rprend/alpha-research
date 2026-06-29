#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/node-v20.15.1-linux-x64/bin:$PATH"

REPO_ROOT="$HOME/alpha-research"
RUN_ID="evidence-first-targeted-contract-qwen3b-smoke-v1"
PACKET_DIR="$REPO_ROOT/docs/experiments/grounded-qa-distillation/runs/evidence-first-targeted-contract-launch-packet-2026-06-29-v1"
OUTPUT_DIR="$REPO_ROOT/docs/experiments/grounded-qa-distillation/runs/$RUN_ID"
LOG_PATH="$OUTPUT_DIR/remote_smoke.log"

mkdir -p "$OUTPUT_DIR"

{
  echo "=== date ==="
  date -u +"%Y-%m-%dT%H:%M:%SZ"
  echo "=== gpu ==="
  nvidia-smi

  if ! command -v uv >/dev/null 2>&1; then
    echo "=== install uv ==="
    curl -LsSf https://astral.sh/uv/install.sh | sh || true
    export PATH="$HOME/.local/bin:$PATH"
    command -v uv
  fi
  echo "=== uv ==="
  uv --version

  if ! command -v node >/dev/null 2>&1; then
    echo "=== install node ==="
    cd "$HOME"
    curl -fsSLO https://nodejs.org/dist/v20.15.1/node-v20.15.1-linux-x64.tar.xz
    tar -xf node-v20.15.1-linux-x64.tar.xz
    export PATH="$HOME/node-v20.15.1-linux-x64/bin:$PATH"
  fi
  echo "=== node ==="
  node --version

  cd "$REPO_ROOT"
  echo "=== run targeted smoke ==="
  RUN_ID="$RUN_ID" \
    OUTPUT_DIR="$OUTPUT_DIR" \
    MAX_SFT_STEPS=20 \
    MAX_DPO_STEPS=10 \
    PUSH_TO_HUB=false \
    REPORT_TO=none \
    ADAPTER_DIR=joint-action-dpo-adapter \
    MAX_NEW_TOKENS=384 \
    bash "$PACKET_DIR/run_joint_action_smoke.sh"
} 2>&1 | tee "$LOG_PATH"
