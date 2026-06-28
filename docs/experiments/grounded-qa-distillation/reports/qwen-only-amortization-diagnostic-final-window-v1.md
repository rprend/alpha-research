# Qwen-Only Amortization Diagnostic

Generated: 2026-06-28T05:00:07.594Z

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Qwen heuristic | 55.1% | 65.8% | 81.2% | 25 |
| Qwen high precision | 24.6% | 82.4% | 94.2% | 14 |
| Qwen judged oracle | 50.7% | 100.0% | 100.0% | 35 |

## Candidate Pool

Rows with non-counterfactual supported Qwen answers: 35/69

Rows with supported Qwen abstentions: 68/69

Status: `qwen_only_oracle_coverage_shortfall`

This artifact makes no LLM calls and launches no compute. It is an amortization diagnostic because OpenAI-mini scaffold candidates are removed from the selectable deployment pool.
