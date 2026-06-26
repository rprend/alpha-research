# Abstention Boundary Reliability Audit

Generated: 2026-06-26T19:50:55.745Z

Status: `abstention_boundary_unstable`

Source second-pass run: `judge-reliability-second-pass-run-2026-06-26-v2`

## Findings

- Overall exact agreement on hard judge rows is 76.2%.
- Unsupported-answer and correct-abstention sanity buckets are relatively stable (87.5% and 100.0% exact agreement).
- Questionable-abstention rows are unstable: 0/6 exact agreement, with the blind second pass judging all six sampled abstentions as correct abstentions.
- Therefore, current scaffold improvements should be reported with answer rate and disagreement examples; abstention-boundary wins should not be treated as settled without human adjudication or a stronger judge.

## Agreement By Audit Type

| Audit type | Cases | Exact agreement | Exact agreement rate | Second-pass supported | Second-pass correct abstention |
| --- | ---: | ---: | ---: | ---: | ---: |
| unsupported_answer | 8 | 7 | 87.5% | 1 | 0 |
| questionable_abstention | 6 | 0 | 0.0% | 0 | 6 |
| correct_abstention_sanity_check | 4 | 4 | 100.0% | 0 | 4 |
| cross_policy_disagreement | 24 | 21 | 87.5% | 6 | 13 |

## Manuscript Constraints

- Call current support/correctness metrics model-judged, not human-validated.
- Report answer rate, abstention support, answer support, and second-pass disagreement together for any gate that suppresses answers.
- Do not claim abstention-boundary calibration is solved; describe it as an open limitation.
- Use the second-pass disagreement examples to motivate the Qwen 3B joint-action objective rather than another pure suppression gate.

## Required Next Evidence

- Human-adjudicate the six questionable-abstention rows or rerun them with a stronger independent judge before final submission claims.
- For Qwen 3B, report separate answer-support and abstention-support agreement slices.
- Add human/private-KB evidence before claiming enterprise-private KB behavior.

This audit makes no OpenAI calls, launches no GPU jobs, and records no new spend.
