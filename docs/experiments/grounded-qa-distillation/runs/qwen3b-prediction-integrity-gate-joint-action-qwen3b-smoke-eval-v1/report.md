# Qwen 3B Prediction Integrity Gate

Prediction run: `joint-action-qwen3b-smoke-eval-v1`

Status: `waiting_for_qwen3b_predictions`

| Check | Value |
| --- | ---: |
| Expected eval examples | 69 |
| Prediction rows | 0 |
| Unique prediction ids | 0 |
| Failures | 1 |
| Warnings | 0 |

This gate makes no OpenAI calls and launches no GPU jobs. It exists to refuse paid grounded-correctness judging when the Qwen 3B smoke artifacts are missing, incomplete, or malformed.
