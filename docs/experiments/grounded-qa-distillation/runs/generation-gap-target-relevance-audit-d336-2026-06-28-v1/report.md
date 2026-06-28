# Generation-Gap Target Relevance Audit

Status: `target_relevance_audit_ready_for_shape_eval`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Examples: 10
- Candidate spans: 168
- Heuristic grounded answers: 6
- Heuristic abstentions: 4
- Diagnostic oracle grounded answers: 3
- Diagnostic oracle abstentions: 7
- Oracle answerable recoverable rate: 42.9%

## Shape Evaluation

- Heuristic overall shape: 10.0%
- Heuristic answerable shape: 14.3%
- Heuristic abstention shape: 0.0%
- Diagnostic oracle overall shape: 60.0%
- Diagnostic oracle answerable shape: 42.9%
- Diagnostic oracle abstention shape: 100.0%


## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Build answer-construction and question-target relevance supervision before spending on another Prime generator run.
- Reason: The deployable heuristic fails the generation-gap shape gate, while the diagnostic oracle ceiling shows the span pool still cannot construct yes/no and multi-span answers.
