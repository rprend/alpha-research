# Qwen 7B V4/V5/V6 Tradeoff Audit

Generated: 2026-06-27T19:32:04.705Z

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| qwen7b_v4_support_aware | 50.7% | 65.7% | 82.6% | 23 | 12 |
| qwen7b_v5_coverage_aware | 63.8% | 50.0% | 68.1% | 22 | 22 |
| qwen7b_v6_answerability_gated | 49.3% | 61.8% | 81.2% | 21 | 13 |

## Transitions

| Transition | Newly answered | Supported newly answered | Newly abstained | Useful suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| v4 -> v5 | 19 | 6 | 10 | 5 | 5 |
| v5 -> v6 | 5 | 1 | 15 | 11 | 4 |
| v4 -> v6 | 7 | 4 | 8 | 4 | 4 |

## Selector Diagnostics

| Policy | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| v4_baseline | 50.7% | 65.7% | 82.6% | 23 | 12 |
| v5_baseline | 63.8% | 50.0% | 68.1% | 22 | 22 |
| v6_baseline | 49.3% | 61.8% | 81.2% | 21 | 13 |
| majority_answer_priority_v4_v6_v5 | 50.7% | 68.6% | 60.9% | 24 | 11 |
| v4_plus_v5_when_v6_also_answers | 59.4% | 65.9% | 63.8% | 27 | 14 |
| v4_plus_v5_non_counterfactual | 66.7% | 60.9% | 65.2% | 28 | 18 |
| oracle_over_v4_v5_v6_existing_candidates | 53.6% | 89.2% | 94.2% | 33 | 4 |

## Conclusion

Status: `candidate_pool_has_headroom_but_simple_agreement_selectors_do_not_solve_coverage`

- V5 newly answers 19 rows over v4, but only 6 of those are supported.
- V6 suppresses 15 v5 answers, with 11 useful and 4 harmful suppressions.
- The oracle over existing v4/v5/v6 candidates reaches 94.2% correctness at 53.6% answer rate, so the candidate pool has some headroom.
- The best tested deployable agreement selector is v4_baseline, reaching 82.6% correctness at 50.7% answer rate.

Next intervention: Do not run another blanket coverage or hard-gate curriculum. Build a soft answerability target or selector that learns which v5 recovered answers are safe, using train/validation support labels and features that distinguish the few supported recovered answers from the larger unsupported set.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
