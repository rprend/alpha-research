# Qwen 3B Result Integration

Generated: 2026-06-28T01:34:33.333Z

Status: `qwen3b_negative_ready_for_pareto_update`

## Artifact Status

| Surface | Complete |
| --- | --- |
| Prediction run | yes |
| Paid judge run | yes |

## Target

- Direct baseline answer support: 65.2%
- Direct baseline overall judged correct: 72.5%
- Deployable selector answer support: 66.0%
- Deployable selector overall judged correct: 75.4%
- 70% frontier answer support: 68.5%
- 70% frontier overall judged correct: 77.3%

## Qwen Metrics

- Answer rate: 40.6%
- Answer support: 50.0%
- Abstention support: 97.6%
- Overall judged correct: 78.3%
- Citation recall: 38.3%

## Required Next Steps

- Update cost-coverage-support Pareto with pareto_row_to_add and recompute the frontier.
- Treat the Qwen smoke as a negative result; analyze failure modes before claiming support-preserving distillation.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
