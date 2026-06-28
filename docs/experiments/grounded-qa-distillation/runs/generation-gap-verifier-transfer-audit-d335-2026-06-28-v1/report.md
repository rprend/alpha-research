# Generation-Gap Verifier Transfer Audit

Status: `generation_gap_verifier_transfer_ready_for_shape_eval`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: 10
- Candidates: 168
- Selected policy: `verifier_balanced_risk_blocked`
- Selected grounded answers: 6
- Selected abstentions: 4

## Policy Frontier

| Policy | Threshold | Grounded answers | Abstentions | Mean selected score |
| --- | ---: | ---: | ---: | ---: |
| verifier_balanced | 0.6597 | 10 | 0 | 0.9447 |
| verifier_balanced_risk_blocked | 0.6597 | 6 | 4 | 0.9398 |
| verifier_p90 | 0.9666 | 1 | 9 | 0.9683 |
| verifier_p95 | 0.9666 | 1 | 9 | 0.9683 |
| verifier_p90_direct_anchor | 0.9666 | 0 | 10 | 0.0000 |
| verifier_p90_risk_blocked | 0.9666 | 0 | 10 | 0.0000 |

## D322 Shape Results

| Policy | Status | Overall shape | Answerable shape | Abstention shape |
| --- | --- | ---: | ---: | ---: |
| verifier_balanced_risk_blocked | model_predictions_fail_shape_gate | 0.0% | 0.0% | 0.0% |
| verifier_balanced | model_predictions_fail_shape_gate | 0.0% | 0.0% | 0.0% |
| verifier_p90 | model_predictions_fail_shape_gate | 30.0% | 0.0% | 100.0% |

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Create generation-gap-specific candidate labels that distinguish answer-target relevance from evidence-local support before any more generator-only Prime training.
- Reason: The transferred verifier assigns high support scores to evidence-local spans, but D322 shape scoring shows those spans often do not answer the question.
