# Calibrated Hybrid Selector

Generated: 2026-06-28T04:52:02.986Z

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | 60.9% | 73.8% | 82.6% | 31 |
| Calibrated hybrid | 71.0% | 71.4% | 79.7% | 35 |
| Qwen switch oracle | 72.5% | 78.0% | 84.1% | 39 |

## Switches

| Switches | Supported Qwen switches | Unsupported Qwen switches | Harmful switches from correct abstention |
| ---: | ---: | ---: | ---: |
| 7 | 4 | 3 | 3 |

Status: `hybrid_selector_minimum_positive_not_amortized`

This artifact makes no LLM calls and launches no compute. It is not a final amortized result because the candidate pool still includes OpenAI-mini scaffold candidates.
