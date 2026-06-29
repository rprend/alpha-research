# Qwen Surface Selector Miss Audit

Generated: 2026-06-29T06:50:11.759Z

Status: `simple_qwen_surface_rules_do_not_recover_oracle_headroom`

This audit makes no OpenAI calls and launches no compute.

## Split Summary

| Split | Examples | Selected correct | Oracle correct | Recoverable misses | All wrong |
| --- | ---: | ---: | ---: | ---: | ---: |
| train_heldout | 63 | 32 | 47 | 15 | 16 |
| repaired_validation_gate | 70 | 45 | 58 | 13 | 12 |

## Recoverable Miss Tags

| Tag | Count |
| --- | ---: |
| `oracle_candidate_available` | 28 |
| `probability_ranker_miscalibrated` | 28 |
| `router_selected_wrong_candidate` | 28 |
| `target_is_grounded_answer` | 27 |
| `candidate_answer_type_disagreement` | 26 |
| `learned_selector_overrode_correct_alternative` | 16 |
| `missed_correct_qwen_repaired` | 14 |
| `missed_correct_train_selected` | 12 |
| `missed_correct_qwen_scaffold_hybrid` | 10 |
| `missed_correct_scaffold` | 9 |
| `qwen_repaired_overrode_correct_alternative` | 9 |
| `target_is_abstention` | 1 |

## Policy Probes

These probes are diagnostic only. They were chosen before inspecting validation labels as simple structural alternatives to the learned top-probability router, but reported validation scores still use labels and are not promoted as trained policy evidence.

| Split | Policy | Correct | Rate | Selected systems |
| --- | --- | ---: | ---: | --- |
| train_heldout | `learned_router_top_probability` | 32 | 0.508 | {"learned_repaired_selector":39,"qwen_repaired_surface":19,"qwen_scaffold_hybrid_surface":4,"train_selected_constrained_policy":1} |
| repaired_validation_gate | `learned_router_top_probability` | 45 | 0.643 | {"learned_repaired_selector":49,"qwen_repaired_surface":15,"qwen_scaffold_hybrid_surface":6} |
| train_heldout | `prefer_qwen_repaired_when_learned_grounded` | 33 | 0.524 | {"learned_repaired_selector":38,"qwen_repaired_surface":20,"qwen_scaffold_hybrid_surface":4,"train_selected_constrained_policy":1} |
| repaired_validation_gate | `prefer_qwen_repaired_when_learned_grounded` | 45 | 0.643 | {"learned_repaired_selector":47,"qwen_repaired_surface":17,"qwen_scaffold_hybrid_surface":6} |
| train_heldout | `prefer_qwen_hybrid_when_it_answers` | 33 | 0.524 | {"learned_repaired_selector":30,"qwen_scaffold_hybrid_surface":27,"qwen_repaired_surface":6} |
| repaired_validation_gate | `prefer_qwen_hybrid_when_it_answers` | 45 | 0.643 | {"learned_repaired_selector":39,"qwen_scaffold_hybrid_surface":25,"qwen_repaired_surface":6} |
| train_heldout | `abstain_consensus_if_three_abstain` | 32 | 0.508 | {"learned_repaired_selector":39,"qwen_repaired_surface":19,"qwen_scaffold_hybrid_surface":4,"train_selected_constrained_policy":1} |
| repaired_validation_gate | `abstain_consensus_if_three_abstain` | 45 | 0.643 | {"learned_repaired_selector":50,"qwen_repaired_surface":14,"qwen_scaffold_hybrid_surface":6} |
| train_heldout | `oracle_upper_bound` | 47 | 0.746 | {"learned_repaired_selector":35,"qwen_repaired_surface":23,"qwen_scaffold_hybrid_surface":3,"train_selected_constrained_policy":2} |
| repaired_validation_gate | `oracle_upper_bound` | 58 | 0.829 | {"learned_repaired_selector":44,"train_selected_constrained_policy":3,"qwen_repaired_surface":15,"qwen_scaffold_hybrid_surface":7,"train_calibrated_scaffold":1} |

## Conclusion

The Qwen surface creates real oracle headroom, but misses are distributed across learned, Qwen, hybrid, scaffold, and train-selected alternatives. Simple family-priority or answer-type consensus rules do not recover validation performance.

Decision: Do not spend more on Prime or OpenAI judgments for this router. The next aligned intervention is a stronger support verifier or pairwise/listwise selector trained to discriminate candidate support, ideally with Qwen candidates included on train and fresh heldout.
