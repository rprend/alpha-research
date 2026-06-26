# Joint-Action Qwen 3B Judge Plan

Prediction run: `joint-action-qwen3b-smoke-eval-v1`

Prediction artifact exists: no

| Examples | Judge model | Estimated judge cost | Current actual spend | Estimated total after judge | Within budget |
| ---: | --- | ---: | ---: | ---: | --- |
| 69 | gpt-4o | $0.4672 | $5.8783 | $6.3455 | yes |

## Commands

```bash
ADAPTER_DIR=joint-action-dpo-adapter OUTPUT_DIR=docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1 uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/eval_joint_action_adapter_uv.py
node scripts/grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-prediction-integrity-gate-joint-action-qwen3b-smoke-eval-v1
node scripts/grounded-qa-distillation-openai-judge.mjs --dry-run=true --split=extended_temporal_future_holdout --prediction-run=joint-action-qwen3b-smoke-eval-v1 --run-id=openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1-dry-run --model=gpt-4o --max-budget-usd=100
set -a; source ~/.codex/secrets.env; set +a; node scripts/grounded-qa-distillation-openai-judge.mjs --split=extended_temporal_future_holdout --prediction-run=joint-action-qwen3b-smoke-eval-v1 --run-id=openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --max-budget-usd=100
```

This plan makes no OpenAI calls and records no spend. It exists to prevent a trained Qwen 3B adapter from sitting unevaluated after GPU execution.
