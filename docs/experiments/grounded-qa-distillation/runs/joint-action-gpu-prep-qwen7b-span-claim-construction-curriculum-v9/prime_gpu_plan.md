# Prime GPU Plan

Prime CLI is authenticated locally, but do a fresh no-spend check immediately before launch:

```bash
prime --plain whoami
prime --plain wallet
prime --plain pods list --output json
```

Budget guardrail:

- Total project budget cap: $100
- Current tracked spend before this packet's launch: $10.2036706
- Estimated bounded GPU smoke cost for this run: $4.00
- Prime wallet balance observed before packet prep: $47.02
- Ledger actual spend in `docs/experiments/grounded-qa-distillation/spend/ledger.jsonl` after launch/termination.

Recommended hardware: one A6000/RTX6000Ada-class 48GB GPU for `Qwen/Qwen2.5-7B-Instruct`.

Launch command:

```bash
RUN_ID=joint-action-qwen7b-span-claim-construction-smoke-eval-v9 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9/run_joint_action_smoke.sh
```

The smoke runner validates the dataset, trains the bounded SFT/DPO adapter, evaluates the saved DPO adapter on the unchanged 69 final-window prompts, and writes `predictions.jsonl`, `result.json`, `report.md`, and `smoke_manifest.json` under `runs/joint-action-qwen7b-span-claim-construction-smoke-eval-v9/`.

Do not start the pod if active pods are nonzero, live pricing is unavailable, or projected total spend would exceed the remaining experiment budget.
