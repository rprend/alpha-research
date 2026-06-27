# Prime GPU Plan

Prime CLI is installed, but the current local API key was unauthorized during prep. Refresh auth before launch:

```bash
prime login --headless
prime whoami
```

Budget guardrail:

- Current total budget cap: $100
- Estimated GPU cost for this run: $12.00
- Ledger actual spend in `docs/experiments/grounded-qa-distillation/spend/ledger.jsonl` after launch/termination.

Recommended hardware: 1x_L4_or_A10G; target model `Qwen/Qwen2.5-3B-Instruct`.

Launch options:

1. Create a Prime pod with one L4/A10G-class GPU.
2. Clone this repo at the commit containing `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`.
3. Run:

```bash
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_joint_action_smoke.sh
```

The smoke runner validates the dataset, trains the bounded SFT/DPO adapter, evaluates the saved DPO adapter on the 69 final-window prompts, and writes `predictions.jsonl`, `result.json`, `report.md`, and `smoke_manifest.json` under `runs/joint-action-qwen3b-smoke-eval-v1/`.

Do not start the pod if the estimated total spend exceeds the remaining experiment budget.
