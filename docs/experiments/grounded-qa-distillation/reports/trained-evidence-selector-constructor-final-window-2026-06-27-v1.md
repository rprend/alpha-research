# Trained Evidence Selector Constructor

Generated: 2026-06-28T00:20:04.432Z

Status: `coverage_or_support_limited_negative`

## Purpose

Test whether a zero-LLM trained evidence selector fixes the support-selection failure from the hand-weighted constrained span constructor.

## Setup

| Item | Value |
| --- | --- |
| Source file | `docs/experiments/grounded-qa-distillation/data/extended_temporal_future_holdout.jsonl` |
| Train window | `0-240` (240 examples) |
| Tune window | `240-320` (80 examples) |
| Eval window | `321-389` (69 examples) |
| Selected threshold | 0.75 |
| OpenAI calls | 0 |
| External compute | $0.00 |

## Tune Threshold Sweep

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.2 | 56 | 70.0% | 60.7% | 47.8% | 11.5% | 91.3% |
| 0.25 | 55 | 68.8% | 60.0% | 45.9% | 11.3% | 90.0% |
| 0.3 | 54 | 67.5% | 61.1% | 45.9% | 11.2% | 88.8% |
| 0.35 | 52 | 65.0% | 63.5% | 45.9% | 11.2% | 91.3% |
| 0.4 | 50 | 62.5% | 66.0% | 45.9% | 11.2% | 91.3% |
| 0.45 | 50 | 62.5% | 66.0% | 45.9% | 11.2% | 91.3% |
| 0.5 | 48 | 60.0% | 66.7% | 45.4% | 11.2% | 88.8% |
| 0.55 | 48 | 60.0% | 66.7% | 45.4% | 11.2% | 88.8% |
| 0.6 | 48 | 60.0% | 66.7% | 45.4% | 11.2% | 88.8% |
| 0.65 | 48 | 60.0% | 66.7% | 45.4% | 11.2% | 88.8% |
| 0.7 | 47 | 58.8% | 68.1% | 45.4% | 11.2% | 90.0% |
| 0.75 | 45 | 56.3% | 71.1% | 45.4% | 10.8% | 87.5% |
| 0.8 | 44 | 55.0% | 70.5% | 44.5% | 9.5% | 86.3% |

## Held-Out Final Window

| Examples | Answered | Abstained | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 43 | 26 | 62.3% | 51.2% | 35.4% | 6.5% | 89.9% |

## Eval Threshold Sweep For Diagnosis Only

This table uses held-out labels after the threshold has already been selected. It is diagnostic, not a threshold-selection procedure.

| Threshold | Answered | Answer rate | Ref-citation supported answers | Citation recall | Answer F1 | Answer-type acc. |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.2 | 50 | 72.5% | 48.0% | 38.3% | 6.5% | 91.3% |
| 0.25 | 49 | 71.0% | 49.0% | 38.3% | 6.5% | 89.9% |
| 0.3 | 47 | 68.1% | 48.9% | 36.0% | 6.5% | 87.0% |
| 0.35 | 47 | 68.1% | 48.9% | 36.0% | 6.5% | 87.0% |
| 0.4 | 47 | 68.1% | 48.9% | 36.0% | 6.5% | 87.0% |
| 0.45 | 46 | 66.7% | 50.0% | 36.0% | 6.5% | 88.4% |
| 0.5 | 44 | 63.8% | 52.3% | 36.0% | 6.5% | 91.3% |
| 0.55 | 44 | 63.8% | 52.3% | 36.0% | 6.5% | 91.3% |
| 0.6 | 44 | 63.8% | 52.3% | 36.0% | 6.5% | 91.3% |
| 0.65 | 44 | 63.8% | 52.3% | 36.0% | 6.5% | 91.3% |
| 0.7 | 43 | 62.3% | 51.2% | 35.4% | 6.5% | 89.9% |
| 0.75 | 43 | 62.3% | 51.2% | 35.4% | 6.5% | 89.9% |
| 0.8 | 42 | 60.9% | 50.0% | 33.1% | 6.5% | 88.4% |

## Interpretation

This isolates whether support selection is learnable from prior-window gold citations without per-query LLM calls.

Next step: Run a bounded paid support judge on this trained-selector surface before adding it to the cost/coverage/support Pareto table.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
