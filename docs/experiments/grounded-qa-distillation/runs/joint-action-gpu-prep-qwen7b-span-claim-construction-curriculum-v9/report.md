# Span/Claim Construction Curriculum Packet

Generated: 2026-06-28T00:42:04.174Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Purpose

Prepare a leakage-safe post-training packet that directly targets D210 answer-span and structured-claim construction failures.

## Counts

| Split | SFT rows | DPO rows | Answerable | Abstention | High-oracle answer spans |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train | 240 | 389 | 157 | 83 | 42 |
| Validation | 75 | 124 | 49 | 26 | 13 |
| Eval | 69 | n/a | n/a | n/a | n/a |

## DPO Mix

| Split | Question-mismatch negatives | Answer-over-abstain | Abstention contrasts |
| --- | ---: | ---: | ---: |
| Train | 157 | 157 | 75 |
| Validation | 49 | 49 | 26 |

## Leakage Guard

| Check | Value |
| --- | --- |
| Train/eval paper overlap | 0 |
| Validation/eval paper overlap | 0 |
| Final eval labels used for training | no |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
