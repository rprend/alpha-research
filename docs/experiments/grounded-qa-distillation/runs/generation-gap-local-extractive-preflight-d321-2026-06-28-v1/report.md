# Generation Gap Local Extractive Preflight

Status: `local_extractive_preflight_failed_shape_gate`

This run makes no OpenAI calls and launches no Prime job.

## Prediction Counts

| Examples | Answered | Abstained | Citation-complete answers |
| ---: | ---: | ---: | ---: |
| 10 | 7 | 3 | 7 |

## Shape Eval

| Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 80.0% | 0.0% | 66.7% | 20.0% | 5.3% | 20.0% |

## Decision

- Local preflight passed shape gate: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: Do not judge or scale this extractor; use its failures to justify a small trained generation/repair model preflight.
- Reason: The zero-spend extractor does not clear the fixed D322 shape gate, so cheap extraction is insufficient for the D320 generation gaps.
