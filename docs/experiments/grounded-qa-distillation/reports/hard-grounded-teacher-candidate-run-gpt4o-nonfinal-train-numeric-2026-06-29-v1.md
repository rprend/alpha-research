# Hard Grounded Teacher Candidate Run

Generated: 2026-06-29T07:50:39.698Z

Status: `hard_grounded_teacher_candidate_surface_promising`

This run tests whether a stronger OpenAI teacher can construct candidates for the repaired-validation grounded rows where the existing cheap candidate pool had no contract-correct answer. It records every API call in the OpenAI ledger and launches no GPU compute.

| Model | Calls | Cost | Contract correct | Answer type correct | Citation exact | Evidence-first valid | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 22 | $0.081352 | 20/22 | 20/22 | 20/22 | 20/22 | $82.505794 |

## By Answer Form

| Answer form | Examples | Contract correct | Rate |
| --- | ---: | ---: | ---: |
| `numeric_or_metric` | 22 | 20 | 90.9% |

## Decision

- Mine non-final teacher packet now: yes
- Launch Prime now: no
- Buy more OpenAI labels now: no
- Reason: The stronger teacher constructs enough contract-correct candidates on cheap-pool absence rows to justify mining matched non-final/train hard rows.
- Next step: Convert accepted non-final teacher candidates into SFT/DPO contrasts and preflight the packet before any GPU smoke.
