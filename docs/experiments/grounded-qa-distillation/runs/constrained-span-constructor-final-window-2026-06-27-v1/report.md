# Constrained Span Constructor

Generated: 2026-06-28T00:12:50.555Z

Status: `coverage_or_support_limited_negative`

## Purpose

Test whether a zero-LLM scaffold can preserve citation-groundedness by construction: it may only abstain or return one selected evidence sentence with one inline citation.

## Setup

| Item | Value |
| --- | --- |
| Source file | `docs/experiments/grounded-qa-distillation/data/extended_temporal_future_holdout.jsonl` |
| Threshold window | `240-320` (80 examples) |
| Eval window | `321-389` (69 examples) |
| Selected threshold | 0.3 |
| OpenAI calls | 0 |
| External compute | $0.00 |

## Prior-Window Threshold Sweep

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.12 | 80 | 100.0% | 41.3% | 43.2% | 12.3% | 66.3% |
| 0.15 | 80 | 100.0% | 41.3% | 43.2% | 12.3% | 66.3% |
| 0.18 | 70 | 87.5% | 45.7% | 42.8% | 12.3% | 68.8% |
| 0.2 | 69 | 86.3% | 46.4% | 42.8% | 12.3% | 67.5% |
| 0.22 | 67 | 83.8% | 47.8% | 42.8% | 12.1% | 65.0% |
| 0.25 | 61 | 76.3% | 49.2% | 40.3% | 11.8% | 60.0% |
| 0.28 | 52 | 65.0% | 53.8% | 36.5% | 11.0% | 61.3% |
| 0.3 | 49 | 61.3% | 57.1% | 36.5% | 11.0% | 62.5% |
| 0.35 | 36 | 45.0% | 58.3% | 28.5% | 7.6% | 56.3% |
| 0.4 | 27 | 33.8% | 63.0% | 23.7% | 7.2% | 52.5% |
| 0.45 | 14 | 17.5% | 64.3% | 11.8% | 5.0% | 46.3% |
| 0.5 | 8 | 10.0% | 62.5% | 5.2% | 1.8% | 38.8% |

## Held-Out Final Window

| Examples | Answered | Abstained | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 37 | 32 | 53.6% | 35.1% | 23.9% | 6.3% | 58.0% |

## Interpretation

A constrained extractive constructor is a valid low-cost scaffold only if it recovers enough answer coverage while selecting reference-supported evidence ids.

Next step: Do not spend on judging this exact surface; improve constrained construction or use it as a negative control.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
