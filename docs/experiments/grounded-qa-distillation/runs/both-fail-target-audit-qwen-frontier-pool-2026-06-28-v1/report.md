# Both-Fail Target Audit

Generated: 2026-06-28T10:53:07.807Z

Status: `both_failures_have_existing_unsupported_claim_targets`

This audit makes no OpenAI calls, launches no compute, and uses final-window labels only as forbidden diagnostics.

| Audited examples | Selected unsupported with judge claims | Short supported lost to expansion | Numeric/list scope misses |
| ---: | ---: | ---: | ---: |
| 4 | 4 | 1 | 4 |

## Mechanisms

| Mechanism | Count |
| --- | ---: |
| `citation_count_not_discriminative` | 4 |
| `existing_judge_unsupported_claim_available` | 4 |
| `numeric_or_list_scope_overclaim` | 4 |
| `selected_unsupported_over_supported_candidate` | 4 |
| `multiple_supported_candidates_ranked_below` | 2 |
| `same_citation_different_claim` | 1 |
| `short_supported_answer_lost_to_expansion` | 1 |

## Supervision Targets

| Target | Count |
| --- | ---: |
| `numeric_or_list_scope_guard` | 4 |
| `selected_vs_best_supported_pair` | 4 |
| `unsupported_judge_claim_penalty` | 4 |
| `minimal_supported_span_preference` | 1 |
| `require_claim_table_for_short_numeric_answers` | 1 |
| `same_citation_claim_difference_contrast` | 1 |

## Examples

- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137`: selected `qwen3b_v3`; best supported `qwen7b_v11`; targets `minimal_supported_span_preference`, `numeric_or_list_scope_guard`, `selected_vs_best_supported_pair`, `unsupported_judge_claim_penalty`.
- `2004.03744:66bf0d61ffc321f15e7347aaed191223f4ce4b4a`: selected `qwen7b_v7`; best supported `qwen3b_v3`; targets `numeric_or_list_scope_guard`, `same_citation_claim_difference_contrast`, `selected_vs_best_supported_pair`, `unsupported_judge_claim_penalty`.
- `2004.03744:a08b5018943d4428f067c08077bfff1af3de9703`: selected `qwen3b_v3`; best supported `qwen7b_v5`; targets `numeric_or_list_scope_guard`, `require_claim_table_for_short_numeric_answers`, `selected_vs_best_supported_pair`, `unsupported_judge_claim_penalty`.
- `2004.03744:f33236ebd6f5a9ccb9b9dbf05ac17c3724f93f91`: selected `qwen3b_v3`; best supported `qwen7b_v7`; targets `numeric_or_list_scope_guard`, `selected_vs_best_supported_pair`, `unsupported_judge_claim_penalty`.

## Decision

Buy more labels now: `false`

Next step: Build a zero-cost minimal-span/overexpansion contrast packet from existing non-final judged Qwen pools, then test a selector that explicitly rewards exact supported spans and penalizes unsupported judge claims.
