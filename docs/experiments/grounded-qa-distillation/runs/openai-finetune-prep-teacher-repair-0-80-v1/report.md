# OpenAI Fine-Tune Prep

## Status

- Launch requested: no
- Launch performed: no
- Candidate model: `gpt-4.1-mini-2025-04-14`
- Teacher label packet: `teacher-repair-temporal-test-0-80-v1`
- Train rows: 52
- Validation rows: 13

## Budget Gate

| Item | Value |
| --- | ---: |
| Current ledger spend | $1.71184505 |
| Remaining budget | $98.28815495 |
| Training dollars/hour assumption | $100.00 |
| Training dollars / 1M tokens | $5.00 |
| Epochs | 3 |
| Max training hours | 0 |
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

The prepared files are OpenAI chat-format JSONL, but the job is not launched by default. A live launch needs file upload, job polling, and ledger rows for upload/job/status calls plus a hard stop that can enforce the project-wide $100 key budget.
