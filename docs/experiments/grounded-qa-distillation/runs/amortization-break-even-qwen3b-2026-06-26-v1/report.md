# Qwen 3B Amortization Break-Even

Generated: 2026-06-27T17:13:43.899Z

Status: `amortization_accounting_ready_not_quality_evidence`

## Planned Offline Investment

- Current actual tracked spend: $6.583861
- Planned GPU estimate: $4.000000
- Planned judge estimate: $0.467165
- Planned offline investment: $4.467165
- Estimated total after Qwen smoke and judge: $11.051026
- Within $100 budget: yes

## Break-Even Against Historical API Baselines

| Baseline | Ledger cost/query | Calls/query | Break-even planned offline queries | Break-even total project queries |
| --- | ---: | ---: | ---: | ---: |
| direct_mini_student_generation | $0.000293 | 1 | 15242 | 37706 |
| direct_gpt4o_teacher_generation | $0.004597 | 1 | 972 | 2404 |
| multistep_teacher_recall_repair_generation | $0.010008 | 2 | 447 | 1105 |

## Sensitivity

| Assumed API cost/query | Break-even planned offline queries | Break-even total project queries |
| ---: | ---: | ---: |
| $0.00010 | 44672 | 110511 |
| $0.00025 | 17869 | 44205 |
| $0.00100 | 4468 | 11052 |
| $0.00500 | 894 | 2211 |
| $0.01000 | 447 | 1106 |
| $0.05000 | 90 | 222 |

## Claim Boundaries

- This artifact is cost accounting only; it does not prove that Qwen 3B preserves citation-grounded correctness.
- The current zero-call local/tiny-model rows are cheap but not quality substitutes, so economics must be conditioned on passing the Qwen support/coverage gate.
- If Qwen 3B fails the paid grounded-correctness judge, report the negative result and do not claim amortized success.
- The planned GPU and judge estimates are preflight estimates; actual Prime/HF cost must be recorded by the smoke ledger finalizer after the run.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
