# Prime GPU Plan: Qwen 7B Coverage-Gap Scaffold v13

Packet: `joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13`

Smoke run id: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13`

This packet is ready for bounded smoke only after live Prime and budget preflight.

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13/run_joint_action_smoke.sh
```

Budget guard: do not launch if estimated total OpenAI plus external compute spend would exceed $100. Terminate the Prime pod and record actual spend immediately after the run.
