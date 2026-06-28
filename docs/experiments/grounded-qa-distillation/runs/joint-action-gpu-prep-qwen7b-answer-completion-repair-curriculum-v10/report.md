# Answer-Completion Repair Curriculum Packet

Generated: 2026-06-28T01:59:51.902Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Purpose

Prepare a leakage-safe Qwen 7B packet that targets the D215/D216 failure mode: short or underspecified cited answers and missing supported candidates on final-window oracle-gap rows.

## Counts

| Split | SFT rows | DPO rows | Answerable | Abstention | Completion negatives |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train | 240 | 546 | 157 | 83 | 157 |
| Validation | 75 | 173 | 49 | 26 | 49 |
| Eval | 69 | n/a | n/a | n/a | n/a |

## Final Eval Targets

| Oracle-gap answerable rows | V9 unsupported answer rows | Needed supported answers for 70% query answer rate |
| ---: | ---: | ---: |
| 13 | 14 | 11 |

## Leakage Guard

| Check | Value |
| --- | --- |
| Train/eval paper overlap | 0 |
| Validation/eval paper overlap | 0 |
| Final eval labels used for training | no |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
