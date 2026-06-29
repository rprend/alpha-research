# Hard Grounded Teacher Candidate Run

Generated: 2026-06-29T07:49:28.479Z

Status: `hard_grounded_teacher_candidate_surface_partial`

This run tests whether a stronger OpenAI teacher can construct candidates for the repaired-validation grounded rows where the existing cheap candidate pool had no contract-correct answer. It records every API call in the OpenAI ledger and launches no GPU compute.

| Model | Calls | Cost | Contract correct | Answer type correct | Citation exact | Evidence-first valid | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 24 | $0.117020 | 7/24 | 24/24 | 7/24 | 24/24 | $82.587146 |

## By Answer Form

| Answer form | Examples | Contract correct | Rate |
| --- | ---: | ---: | ---: |
| `multi_citation_synthesis` | 24 | 7 | 29.2% |

## Decision

- Mine non-final teacher packet now: no
- Launch Prime now: no
- Buy more OpenAI labels now: no
- Reason: The stronger teacher did not construct enough contract-correct candidates on cheap-pool absence rows to justify immediate packet mining.
- Next step: Audit failed teacher candidates for retrieval/table truncation versus instruction/format failure before spending more.
