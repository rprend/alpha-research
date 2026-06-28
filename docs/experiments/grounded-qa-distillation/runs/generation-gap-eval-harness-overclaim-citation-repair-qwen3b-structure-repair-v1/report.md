# Generation Gap Eval Harness

Status: `model_predictions_fail_shape_gate`

Prediction mode: `external_predictions`

This run makes no OpenAI calls and launches no Prime job.

## Metrics

| Examples | Parseable | Answer type accuracy | Answerable supported shape | Abstention shape | Citation exact | Mean answer F1 | Overall shape correct |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 100.0% | 40.0% | 0.0% | 0.0% | 30.0% | 0.0% | 0.0% |

## Decision

- Eval harness fixed: yes
- Fixture passed: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: Run a bounded local or Prime model preflight that writes predictions in this schema, then run this harness before any paid grounded-correctness judging.
- Reason: The harness is now fixed and fixture-validated, but no actual generation model has been run on the D321 prompts in this artifact.
