# Fresh Nonfinal Pattern Constructor Audit

Generated: 2026-06-29T15:47:49.483Z

Status: `generic_pattern_constructor_fails_fresh_transfer`

This run makes no OpenAI calls and launches no Prime compute. It removes the D419 validation-specific exact-question rules and evaluates generic pattern construction on a fresh nonfinal packet.

## Metrics

- Examples: 315
- Contract correct: 100/315 (31.7%)
- Answer-type correct: 218/315
- Citation-set exact: 146/315
- Target grounded answers: 206
- Predicted grounded answers: 211
- False abstentions: 46
- Over-answered abstentions: 51
- Citation errors on grounded predictions: 118

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote constructor family: no
- Keep as fresh transfer signal: no
- Reason: The generic D419-style constructor reaches only 100/315 on fresh nonfinal, so the validation-informed D419 success does not transfer as a standalone rule family.
- Next step: Do not continue hand-built pattern constructors; move to a learned citation-set predictor or a small paid teacher-label packet.
