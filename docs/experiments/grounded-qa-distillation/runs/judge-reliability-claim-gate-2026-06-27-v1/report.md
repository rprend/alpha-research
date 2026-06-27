# Judge Reliability Claim Gate

Generated: 2026-06-27T03:37:48.481Z

Status: `judge_reliability_requires_final_adjudication`

## Summary

| Compared cases | Exact agreement | Disagreement rate | P0 rows | P1 rows |
| ---: | ---: | ---: | ---: | ---: |
| 42 | 76.2% | 23.8% | 6 | 4 |

## Claim Permissions

| Claim | Allowed |
| --- | --- |
| Model-judged screening metrics with caveat | yes |
| Human-validated correctness | no |
| Uncaveated model-judge correctness | no |
| Abstention boundary solved | no |

## Required Before Submission Claim

- Adjudicate all P0 abstention-boundary rows with a human or stronger independent judge before claiming abstention calibration is solved.
- Spot-adjudicate P1 support-boundary rows before treating unsupported/support rates as human truth.
- Report judge prompts, schemas, model, exact-agreement rate, disagreement taxonomy, and examples in the paper.
- Label Qwen 3B support metrics as model-judged unless a human/stronger-judge adjudication file closes this gate.

## Manuscript Constraints

- Use 'model-judged grounded correctness' for current metrics.
- Do not use 'human-validated' or 'gold correctness' for model-judge outputs.
- Report answer support, abstention support, answer rate, and judge disagreement together.
- Describe abstention-boundary calibration as unresolved unless the P0 queue is adjudicated.

Priority adjudication rows are written to `docs/experiments/grounded-qa-distillation/runs/judge-reliability-claim-gate-2026-06-27-v1/priority_adjudication.jsonl`.

No OpenAI calls, GPU jobs, or new spend were made for this gate.
