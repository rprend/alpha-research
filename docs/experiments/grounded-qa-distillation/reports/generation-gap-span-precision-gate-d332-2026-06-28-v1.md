# Generation-Gap Span Precision Gate

Status: `span_precision_gate_ready_for_shape_eval`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: 10
- Source grounded answers: 7
- Kept grounded answers: 1
- Abstentions: 9

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the D322 shape harness. If precision improves but coverage collapses, mine trainable direct-extractive answerability features instead of launching another generator.
- Reason: The paid judge showed inferred yes/no and relation answers were unsupported despite passing shape; this gate tests a stricter deployable precision/coverage tradeoff.
