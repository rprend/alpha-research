# Generation-Gap Candidate Span Selector Audit

Status: `candidate_span_selector_audit_ready_for_shape_eval`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: 10
- Candidate spans: 168
- Selected policy: `anchored_direct_span_selector`
- Selected grounded answers: 3
- Selected abstentions: 7

## Policy Frontier

| Policy | Grounded answers | Abstentions | Estimated precision floor |
| --- | ---: | ---: | ---: |
| strict_direct_quote_selector | 1 | 9 | 100.0% |
| anchored_direct_span_selector | 3 | 7 | 66.7% |
| constructor_judge_failure_taxonomy_selector | 1 | 9 | 100.0% |

## D322 Shape Results

| Policy | Status | Overall shape | Answerable shape | Abstention shape |
| --- | --- | ---: | ---: | ---: |
| anchored_direct_span_selector | model_predictions_fail_shape_gate | 40.0% | 14.3% | 100.0% |
| strict_direct_quote_selector | model_predictions_fail_shape_gate | 40.0% | 14.3% | 100.0% |
| constructor_judge_failure_taxonomy_selector | model_predictions_fail_shape_gate | 40.0% | 14.3% | 100.0% |

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the D322 shape harness on selector_predictions.jsonl, then decide whether to train a verifier on non-final judged span candidates before any more Prime generator runs.
- Reason: The audit is zero-cost and isolates the selector failure mode: direct support requires rejecting plausible but inferred constructor answers rather than asking a small generator to self-police support.
