# Qwen 3B Prediction Integrity Gate

Prediction run: `joint-action-qwen3b-smoke-eval-v1`

Status: `refuse_paid_judge_prediction_integrity_failed`

| Check | Value |
| --- | ---: |
| Expected eval examples | 69 |
| Prediction rows | 69 |
| Unique prediction ids | 69 |
| Failures | 17 |
| Warnings | 59 |

This gate makes no OpenAI calls and launches no GPU jobs. It exists to refuse paid grounded-correctness judging when the Qwen 3B smoke artifacts are missing, incomplete, or malformed.
