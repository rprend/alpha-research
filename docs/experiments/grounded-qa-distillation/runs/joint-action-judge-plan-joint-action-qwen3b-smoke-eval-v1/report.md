# Joint-Action Qwen 3B Judge Plan

Prediction run: `joint-action-qwen3b-smoke-eval-v1`

Prediction artifact exists: no

| Examples | Judge model | Estimated judge cost | Current actual spend | Estimated total after judge | Within budget |
| ---: | --- | ---: | ---: | ---: | --- |
| 69 | gpt-4o | $0.4672 | $5.8964 | $6.3636 | yes |

## Commands

```bash
ADAPTER_DIR=joint-action-dpo-adapter OUTPUT_DIR=docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1 uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/eval_joint_action_adapter_uv.py
node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100
node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true
```

This plan makes no OpenAI calls and records no spend. It exists to prevent a trained Qwen 3B adapter from sitting unevaluated after GPU execution.
