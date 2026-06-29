# Fact Coverage vs Boundary Audit

Generated: 2026-06-29T19:52:40.271Z

Status: `fact_coverage_metric_changes_conclusion`

This audit separates complete-answer target-claim coverage from exact evidence-id boundary matching.

| Run | Examples | Exact contract | Fact coverage | Boundary-only losses | Missing-fact failures | Multi fact coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `nonreview-coverage-router-audit-2026-06-29-v1-contract-gate` | 64 | 42 | 49 | 11 | 15 | 9/14 |
| `nonreview-support-plan-scaffold-2026-06-29-v1-contract-gate` | 64 | 35 | 54 | 22 | 9 | 10/14 |
| `nonreview-contrastive-support-planner-2026-06-29-v1-contract-gate` | 64 | 32 | 48 | 18 | 13 | 7/14 |
| `openai-boundary-adjudication-probe-2026-06-29-v1` | 8 | 0 | 0 | 0 | 3 | 0/8 |

## Decision

- Replace exact citation metric: no
- Report fact coverage secondary metric: yes
- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Router fact coverage exceeds exact contract by 7 rows, so exact boundary scoring hides some answer-support progress but remains necessary for citation correctness.
- Next step: Use fact coverage as a secondary diagnostic in the paper and mine train-only examples where fact coverage is correct but boundary exactness fails.
