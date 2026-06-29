# Support-Boundary Schema Smoke Postmortem

Generated: 2026-06-29T07:32:54.829Z

Status: `support_boundary_schema_regresses_targeted_smoke`

This audit makes no OpenAI calls and launches no compute.

## Summary

| Metric | Count |
| --- | ---: |
| Examples | 10 |
| Baseline normalized correct | 7 |
| Candidate normalized correct | 4 |
| Candidate - baseline | -3 |
| Candidate recoveries | 0 |
| Candidate regressions from baseline | 3 |

## Buckets

| Bucket | Count |
| --- | ---: |
| `both_contract_correct` | 4 |
| `both_wrong` | 3 |
| `candidate_regression_from_baseline` | 3 |

## Tags

| Tag | Count |
| --- | ---: |
| `candidate_answer_type_regression` | 3 |
| `candidate_citation_regression` | 3 |
| `candidate_new_parse_error` | 3 |
| `candidate_over_answers_vs_baseline` | 3 |
| `candidate_empty_grounded_evidence_first` | 2 |
| `candidate_parse_recovered` | 2 |
| `candidate_cited_abstention_rationale` | 1 |
| `candidate_evidence_first_regression` | 1 |

## Conclusion

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Keep support-boundary packet: no
- Reason: The support-boundary packet loses 3 normalized contract-correct rows versus the earlier repaired-targeted smoke and introduces 3 direct regressions with only 0 recoveries.
- Next step: Stop adding synthetic schema/boundary DPO rows to this small-model branch. Revert to the smaller DPO-prompt-repaired packet for any future bounded smoke, or change the candidate construction mechanism with a simpler answerability objective.
