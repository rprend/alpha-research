# Qwen 7B V10 Postmortem Audit

Generated: 2026-06-28T02:36:44.550Z

Status: `v10_adds_no_new_supported_answerable_coverage`

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| qwen7b_v4_support_aware | 50.7% | 65.7% | 82.6% | 23 | 12 |
| qwen7b_v5_coverage_aware | 63.8% | 50.0% | 68.1% | 22 | 22 |
| qwen7b_v6_answerability_gated | 49.3% | 61.8% | 81.2% | 21 | 13 |
| qwen7b_v7_structure_repair | 91.3% | 41.3% | 46.4% | 26 | 37 |
| qwen7b_v8_repair_regeneration | 0.0% | 0.0% | 95.7% | 0 | 0 |
| qwen7b_v9_span_claim | 40.6% | 50.0% | 78.3% | 14 | 14 |
| qwen7b_v10_answer_completion | 31.9% | 31.8% | 76.8% | 7 | 15 |

## V10 Incremental Coverage

| Row set | Count | Counterfactual |
| --- | ---: | ---: |
| v10_answered | 22 | 6 |
| v10_supported_answers | 7 | 1 |
| v10_unsupported_answers | 15 | 5 |
| v10_new_answers_over_prior | 0 | 0 |
| v10_new_supported_answers_over_prior | 0 | 0 |
| v10_new_non_counterfactual_supported_answers_over_prior | 0 | 0 |
| v10_supported_on_v4_v9_oracle_gap | 0 | 0 |
| v10_unsupported_on_v4_v9_oracle_gap | 3 | 0 |
| v10_lost_prior_supported_answers | 31 | 6 |
| v10_counterfactual_answered | 6 | 6 |

## Oracle Delta

| Oracle | Answered | Answer rate | Supported answers | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| v4-v9 | 38 | 55.1% | 38 | 100.0% |
| v4-v10 | 38 | 55.1% | 38 | 100.0% |

## Failure Tags

- unsupported_task_or_experiment: 12
- invalid_citation_id: 9
- too_short_or_yes_no: 9
- missing_direct_evidence: 6
- counterfactual_answered: 5
- partial_support: 4
- unsupported_context_or_annotation: 1

## Conclusion

- V10 adds 0 unique supported answers over the v4-v9 Qwen 7B pool; 0 are non-counterfactual answerable rows.
- V10 fills 0 v4-v9 oracle-gap answerable rows, while 13 answerable rows still lack any supported Qwen 7B candidate.
- The expanded v4-v10 oracle answers 38/69 rows (55.1%), a 0 supported-answer delta from the v4-v9 oracle.
- V10 as a standalone model still has 15/22 unsupported answered rows and 6 counterfactual answered rows.
- The candidate pool still needs 18 more supported answerable candidates to hit the 70% query-level target.

Next intervention: Do not launch another GPU job yet. First build a zero-cost oracle-gap repair audit that inspects the remaining answerable rows without supported Qwen 7B candidates and separates recoverable gold-span rows from genuinely evidence-insufficient or multi-hop rows.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
