# Overclaim/Citation Repair Qwen 3B Smoke Outcome

Status: `shape_gate_failed_do_not_judge`

The bounded Prime smoke completed on an A6000 and the pod was terminated. The result is negative: the repair packet did not recover citation-grounded behavior, and it should not receive paid OpenAI grounded-correctness judging.

## Metrics

| Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 6 | 50.0% | 0.0% | 0.0% | 14.3% | 0.0% |

## Shape Gate

| Overall shape | Answerable supported shape | Abstention shape | Citation exact | Parseable |
| ---: | ---: | ---: | ---: | ---: |
| 0.0% | 0.0% | 0.0% | 30.0% | 100.0% |

## Decision

- Run OpenAI grounded judge: no
- Launch more Qwen 3B Prime now: no
- Prime cost for this run: $0.18
- Total tracked spend: $14.0416 / $100

Next step: stop Qwen 3B smokes for this packet family unless a zero-cost output-contract intervention first restores citation-bearing shape.
