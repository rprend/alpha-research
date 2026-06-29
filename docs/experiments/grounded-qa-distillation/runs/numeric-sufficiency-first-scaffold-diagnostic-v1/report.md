# Numeric Sufficiency-First Scaffold Diagnostic

Generated: 2026-06-29T08:44:48.654Z

Status: `sufficiency_first_scaffold_beats_abstention_prior`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Surface | Contract correct | Rate |
| --- | ---: | ---: |
| Sufficiency-first scaffold | 10 / 10 | 100.0% |
| Abstention prior | 9 / 10 | 90.0% |
| DPO-prompt-repaired baseline | 7 / 10 | 70.0% |
| Numeric-teacher Qwen normalized | 4 / 10 | 40.0% |
| Prior constrained scaffold | 5 / 10 | 50.0% |

## Deltas

| Comparison | Rows |
| --- | ---: |
| Scaffold - abstention prior | +1 |
| Scaffold - DPO baseline | +3 |
| Scaffold - numeric-teacher Qwen | +6 |
| Scaffold - prior constrained scaffold | +5 |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Keep as scaffold floor: yes
- Broader surface required: yes
- Reason: The zero-cost scaffold beats the abstention prior on this skewed diagnostic by recovering the sole answerable row with exact citations, but it is hand-audited and too narrow to justify paid model work by itself.
- Next step: Generalize the sufficiency-first selector to a leakage-safe broader validation surface before spending Prime or OpenAI budget.
