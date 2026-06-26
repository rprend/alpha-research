# Joint-Action Qwen 3B Eval Prep

This run prepares the post-training adapter evaluation path for `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`.

## Checks

| Check | Status |
| --- | --- |
| Train script compiles | pass |
| Eval script compiles | pass |
| Train saves DPO adapter | pass |
| Eval loads PEFT adapter | pass |
| Eval writes predictions | pass |

## Commands

```bash
MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/train_joint_action_lora_uv.py
ADAPTER_DIR=joint-action-dpo-adapter OUTPUT_DIR=docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1 uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/eval_joint_action_adapter_uv.py
```

The evaluator makes no OpenAI calls. After `predictions.jsonl` exists, run the grounded-correctness judge as the remaining paid evaluation step.
