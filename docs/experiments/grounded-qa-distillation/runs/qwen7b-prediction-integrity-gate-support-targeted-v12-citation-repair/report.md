# Qwen 3B Prediction Integrity Gate

Prediction run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair`

Status: `ready_for_paid_judge`

| Check | Value |
| --- | ---: |
| Expected eval examples | 69 |
| Prediction rows | 69 |
| Unique prediction ids | 69 |
| Failures | 0 |
| Warnings | 88 |

This gate makes no OpenAI calls and launches no GPU jobs. It exists to refuse paid grounded-correctness judging when the Qwen 3B smoke artifacts are missing, incomplete, or malformed.
