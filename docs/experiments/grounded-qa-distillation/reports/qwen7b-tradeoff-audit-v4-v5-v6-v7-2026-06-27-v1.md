# Qwen 7B V4/V5/V6/V7 Tradeoff Audit

Generated: 2026-06-27T20:34:58.144Z

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| qwen7b_v4_support_aware | 50.7% | 65.7% | 82.6% | 23 | 12 |
| qwen7b_v5_coverage_aware | 63.8% | 50.0% | 68.1% | 22 | 22 |
| qwen7b_v6_answerability_gated | 49.3% | 61.8% | 81.2% | 21 | 13 |
| qwen7b_v7_structure_repair | 91.3% | 41.3% | 46.4% | 26 | 37 |

## Transitions

| Transition | Newly answered | Supported newly answered | Newly abstained | Useful suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| v4 -> v5 | 19 | 6 | 10 | 5 | 5 |
| v5 -> v6 | 5 | 1 | 15 | 11 | 4 |
| v4 -> v6 | 7 | 4 | 8 | 4 | 4 |
| v6 -> v7 | 32 | 8 | 3 | 1 | 2 |
| v4 -> v7 | 32 | 8 | 4 | 0 | 4 |

## Selector Diagnostics

| Policy | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| v4_baseline | 50.7% | 65.7% | 82.6% | 23 | 12 |
| v5_baseline | 63.8% | 50.0% | 68.1% | 22 | 22 |
| v6_baseline | 49.3% | 61.8% | 81.2% | 21 | 13 |
| v7_structure_repair_baseline | 91.3% | 41.3% | 46.4% | 26 | 37 |
| majority_answer_priority_v4_v6_v5 | 50.7% | 68.6% | 60.9% | 24 | 11 |
| v4_plus_v5_when_v6_also_answers | 59.4% | 65.9% | 63.8% | 27 | 14 |
| v4_plus_v5_non_counterfactual | 66.7% | 60.9% | 65.2% | 28 | 18 |
| v4_plus_v7_when_v5_or_v6_agree | 68.1% | 61.7% | 66.7% | 29 | 18 |
| oracle_over_v4_v5_v6_v7_existing_candidates | 59.4% | 90.2% | 94.2% | 37 | 4 |

## Conclusion

Status: `candidate_pool_still_missing_supported_answers_after_v7`

- V5 newly answers 19 rows over v4, but only 6 of those are supported.
- V6 suppresses 15 v5 answers, with 11 useful and 4 harmful suppressions.
- V7 structure repair answers 63 rows at 91.3% answer rate, but only 26 are supported.
- V7 adds 32 answers over v4, but only 8 of those new answers are supported.
- The oracle over existing v4/v5/v6/v7 candidates reaches 94.2% correctness at 59.4% answer rate.
- The best tested deployable agreement selector is v4_baseline, reaching 82.6% correctness at 50.7% answer rate.

Next intervention: The candidate pool still lacks enough supported answers; the next experiment must create new supported answer candidates through repair/regeneration training rather than selection.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
