# Generation-Gap Span Constructor

Status: `span_constructor_ready_for_shape_eval`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: 10
- Grounded answers: 7
- Abstentions: 3

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the D322 shape harness. If this beats D331/D329 without diagnostic-target use, promote the two-stage scaffold into a trainable packet.
- Reason: This is a zero-cost scaffold test of the post-D331 hypothesis that constrained span construction is preferable to unconstrained generation.
