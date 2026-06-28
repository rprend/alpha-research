# Generation Gap Trained Evidence Preflight

Status: `trained_evidence_preflight_failed_shape_gate`

This run makes no OpenAI calls and launches no Prime job.

## Shape Eval

Selected validation threshold: `1`

Validation shape proxy at selected threshold: 34.7%

| Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 30.0% | 0.0% | 100.0% | 30.0% | n/a | 30.0% |

## Decision

- Trained preflight passed shape gate: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: Do not spend on judging this local scorer; move to a small adapter/generator preflight using the D321 SFT/DPO packet.
- Reason: The trained local scorer still fails the D322 shape gate, so the D321 gap requires a stronger generator than local evidence scoring.
