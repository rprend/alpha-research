# Prime GPU Plan

Run fresh no-spend checks immediately before launch:

```bash
prime --plain whoami
prime --plain wallet
prime --plain pods list --output json
```

Budget guardrail:

- Total project budget cap: $100
- Current tracked spend before this packet's launch: $10.8938081
- Estimated bounded GPU smoke cost for this run: $4.00
- Ledger actual spend in `docs/experiments/grounded-qa-distillation/spend/ledger.jsonl` after launch/termination.

Launch command:

```bash
RUN_ID=joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-v11/run_joint_action_smoke.sh
```

Do not start the pod if active pods are nonzero, live pricing is unavailable, or projected total spend would exceed the remaining experiment budget.
