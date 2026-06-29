# Targeted Paid Repair And Adjudication

Generated: 2026-06-29T17:11:53.984Z

Status: `targeted_paid_repair_no_gain`

This run spends a bounded amount on the exact fresh-validation rows exposed by D431: selector misses where another existing candidate may be right, and no-source-correct construction misses where a teacher may need to build a new cited answer. Fresh-validation paid outputs are reporting-only and must not become training labels.

| Model | Calls | Cost | Fresh contract | Targeted contract | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 28 | $0.223095 | 47/75 | 0/28 | $82.192699 |

## Targeted Rows

- Selector miss adjudications: 15
- No-source-correct construction repairs: 13
- Paid answer-type correct: 12/28
- Paid citation-set exact: 0/28

## By Repair Type

| Repair type | Examples | Contract correct | Citation exact |
| --- | ---: | ---: | ---: |
| selector miss adjudication | 15 | 0 | 0 |
| no-source-correct construction | 13 | 0 | 0 |

## Decision

- Promote paid repair source: no
- Mine matched non-final/train repairs next: no
- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Paid targeted repairs did not beat the structured-group baseline: 47/75 versus 47/75.
- Next step: Audit the paid failures for prompt insufficiency versus evidence/target mismatch before spending more.
