# Hard Grounded Teacher Candidate Run

Generated: 2026-06-29T07:41:49.012Z

Status: `hard_grounded_teacher_candidate_surface_promising`

This run tests whether a stronger OpenAI teacher can construct candidates for the repaired-validation grounded rows where the existing cheap candidate pool had no contract-correct answer. It records every API call in the OpenAI ledger and launches no GPU compute.

| Model | Calls | Cost | Contract correct | Answer type correct | Citation exact | Evidence-first valid | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 12 | $0.054645 | 6/12 | 11/12 | 6/12 | 11/12 | $82.704166 |

## By Answer Form

| Answer form | Examples | Contract correct | Rate |
| --- | ---: | ---: | ---: |
| `multi_citation_synthesis` | 2 | 1 | 50.0% |
| `numeric_or_metric` | 9 | 5 | 55.6% |
| `yes_no_polarity` | 1 | 0 | 0.0% |

## Decision

- Mine non-final teacher packet now: yes
- Launch Prime now: no
- Buy more OpenAI labels now: no
- Reason: The stronger teacher constructs enough contract-correct candidates on cheap-pool absence rows to justify mining matched non-final/train hard rows.
- Next step: Build a leakage-safe non-final teacher-candidate packet for the same answer-form strata before any GPU smoke.
