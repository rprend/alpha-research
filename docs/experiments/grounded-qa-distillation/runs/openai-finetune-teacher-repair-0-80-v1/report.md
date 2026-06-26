# OpenAI Fine-Tune Prep

## Status

- Launch requested: yes
- Launch performed: no
- Candidate model: `gpt-4.1-mini-2025-04-14`
- Teacher label packet: `teacher-repair-temporal-test-0-80-v1`
- Train rows: 52
- Validation rows: 13
- Fine-tune job id: n/a
- Fine-tune status: `launch_error`
- Fine-tuned model: n/a
- Uploaded files deleted after failure: yes

## Budget Gate

| Item | Value |
| --- | ---: |
| Current ledger spend | $1.71184505 |
| Remaining budget | $98.28815495 |
| Training dollars/hour assumption | $100.00 |
| Training dollars / 1M tokens | $5.00 |
| Epochs | 3 |
| Max training hours | 1 |
| Estimated token training cost | $0.85656000 |
| Estimated hourly training cost | $0.00000000 |
| Estimated training cost | $0.85656000 |

## Token Estimate

| Split | Approx tokens |
| --- | ---: |
| Train | 57104 |
| Validation | 10429 |
| Total | 67533 |

## Launch Decision

- No refusal reasons recorded.

The launch attempt uploaded train/validation files, but job creation failed with OpenAI `training_not_available`: the organization can no longer create self-serve fine-tuning jobs while the platform is being wound down. No fine-tune job was created, no training spend was reserved in the ledger, and the uploaded files were deleted after the failure.
