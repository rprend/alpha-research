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
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/validate_joint_action_dataset_uv.py
HF_TOKEN=... uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/train_joint_action_lora_uv.py
```

Do not start the pod if the estimated total spend exceeds the remaining experiment budget.
