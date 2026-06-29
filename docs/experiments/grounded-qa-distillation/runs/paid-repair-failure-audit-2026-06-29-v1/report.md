# Paid Repair Failure Audit

Generated: 2026-06-29T17:19:27.244Z

Status: `paid_failures_include_many_citation_minimality_cases`

This local audit diagnoses D432 without making new LLM calls. It separates answerability errors from citation exactness, selector adjudication, and label/contract calibration failures.

## Summary

- Examples audited: 28
- Evidence-first valid outputs: 28/28
- Citation exactness failures: 28/28
- Answer-type correct but citation-wrong: 10/28
- Relaxed citation-superset correct: 4/28
- Selector misses that chose a known-correct source: 0/15
- False abstentions against grounded labels: 14
- Over-answered abstain targets: 2

## Failure Families

| Family | Count |
| --- | ---: |
| `false_abstention_against_label` | 14 |
| `selector_failed_to_choose_known_correct_source` | 4 |
| `over_citation_exactness_failure` | 3 |
| `over_answered_counterfactual_or_abstain_target` | 2 |
| `under_citation_exactness_failure` | 2 |
| `wrong_citation_set_with_plausible_answer` | 2 |
| `wrong_citation_or_answer_content` | 1 |

## Citation Relation

| Relation | Count |
| --- | ---: |
| `empty_prediction` | 14 |
| `superset` | 5 |
| `subset` | 4 |
| `disjoint` | 2 |
| `over_answered_abstain` | 2 |
| `overlap` | 1 |

## Decision

- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Revise contract or labels first: yes
- Promote relaxed citation metric: no
- Reason: D432 had 28/28 citation exactness failures, 14 false abstentions against grounded labels, and 0/15 selector-miss calls selected a known-correct source.
- Next step: Build a zero-cost label/contract calibration audit over target citation minimality and counterfactual abstention labels before any more paid repair or GPU training.
