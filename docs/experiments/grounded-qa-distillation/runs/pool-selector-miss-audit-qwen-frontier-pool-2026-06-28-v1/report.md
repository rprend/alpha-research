# Pool Selector Miss Audit

Generated: 2026-06-28T10:40:15.241Z

Status: `pool_selector_regression_plus_claim_table_disagreement`

This audit makes no new OpenAI calls and launches no compute.

| Final examples | Hard selected supported | Pool selected supported | Hybrid selected supported |
| ---: | ---: | ---: | ---: |
| 8 | 4 | 3 | 3 |

## Selector Delta

| Bucket | Count |
| --- | ---: |
| both success | 3 |
| hard only success | 1 |
| pool only success | 0 |
| both fail | 4 |

## Audit Tags

| Tag | Count |
| --- | ---: |
| `pool_selected_candidate_has_existing_unsupported_claims` | 5 |
| `pool_selected_unsupported_candidate` | 5 |
| `both_selectors_miss_supported_candidate` | 4 |
| `citation_count_not_discriminative` | 4 |
| `supported_candidate_is_short` | 3 |
| `d259_existing_judge_pool_disagreement` | 1 |
| `gpt4o_answer_selection_conflicts_with_existing_claim_judge` | 1 |
| `hard_selector_better_pairwise_signal` | 1 |
| `pool_selected_longer_unsupported` | 1 |
| `pool_selector_regression_against_hard_pairwise` | 1 |
| `selected_claim_table_has_uncited_claim` | 1 |
| `selected_has_existing_unsupported_claims` | 1 |
| `selector_disagreement` | 1 |
| `short_answer_claim_table_mismatch` | 1 |

## Hard-Only Final Successes

- `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a`: hard picked `qwen3b_v4` supported; pool picked `qwen3b_v1` unsupported. Tags: `hard_selector_better_pairwise_signal`, `pool_selected_candidate_has_existing_unsupported_claims`, `pool_selected_unsupported_candidate`, `pool_selector_regression_against_hard_pairwise`, `selector_disagreement`.

## Pool Adjudication Disagreements

- `2004.01970:da21bcaa8e3a9eadc8a5194fd57ae797e93c3049:counterfactual-insufficient`: GPT-4o selected `2004.01970:da21bcaa8e3a9eadc8a5194fd57ae797e93c3049:counterfactual-insufficient::sample-0`, existing label `unsupported_answer`. Tags: `d259_existing_judge_pool_disagreement`, `gpt4o_answer_selection_conflicts_with_existing_claim_judge`, `selected_claim_table_has_uncited_claim`, `selected_has_existing_unsupported_claims`, `short_answer_claim_table_mismatch`.

## Decision

Buy more labels now: `false`

Next step: Train or score a constrained selector that uses D258 pairwise support as a regularizer for D259 pool-choice labels, and add an answer/claim-table consistency penalty before any more paid labels.
