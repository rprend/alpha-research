# Mixed Metric Repair Curriculum Packet

Generated: 2026-06-28T02:45:31.709Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Purpose

Prepare a leakage-safe Qwen 7B packet for the D220 residual gap: table/metric/numeric extraction, exact cited span copying, and multi-evidence claim planning.

## Counts

| Split | SFT rows | DPO rows | Metric/numeric SFT | Multi-evidence SFT | Metric-span negatives | Incomplete metric negatives | Multi-evidence negatives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 240 | 631 | 157 | 77 | 157 | 157 | 77 |
| Validation | 75 | 194 | 49 | 21 | 49 | 49 | 21 |
| Eval | 69 | n/a | n/a | n/a | n/a | n/a | n/a |

## D220 Diagnostic Link

| Oracle-gap examples | Table/metric rows | Multi-evidence rows | Final labels used for training |
| ---: | ---: | ---: | --- |
| 13 | 13 | 6 | no |

## Leakage Guard

| Check | Value |
| --- | --- |
| Train/eval paper overlap | 0 |
| Validation/eval paper overlap | 0 |
| Final eval labels used for training | no |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
