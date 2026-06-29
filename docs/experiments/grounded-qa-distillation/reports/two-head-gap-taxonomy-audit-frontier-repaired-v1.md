# Two-Head Gap Taxonomy Audit

Generated: 2026-06-29T09:32:16.895Z

Status: `construction_gap_slightly_dominates`

This audit makes no OpenAI calls and launches no Prime compute. It decomposes the D417 two-head selector misses after the augmented constructor pool.

## Baseline Comparison

- Two-head selector: 47/70
- Augmented router: 46/70
- Augmented pool oracle: 58/70
- Remaining gap to augmented oracle: 11

## Gap Summary

- Selected misses: 23
- Recoverable selection gaps: 11 (47.8%)
- Irrecoverable construction gaps: 12 (52.2%)
- Selected abstention misses: 19
- Selected grounded-answer misses: 4
- Multi-citation misses: 11
- Multi-citation irrecoverable: 6
- Irrecoverable rows with zero grounded-answer candidates: 6
- All miss targets are grounded answers: yes
- All target citations are present in evidence packs: yes

## Breakdown

- By answer form: {"numeric_or_metric":15,"multi_citation_synthesis":4,"list_or_structured_answer":3,"yes_no_polarity":1}
- Recoverable by answer form: {"numeric_or_metric":8,"list_or_structured_answer":2,"multi_citation_synthesis":1}
- Irrecoverable by answer form: {"numeric_or_metric":7,"multi_citation_synthesis":3,"list_or_structured_answer":1,"yes_no_polarity":1}
- By selected system: {"learned_repaired_selector":18,"broad_sufficiency_constructor":3,"train_calibrated_scaffold":1,"train_selected_constrained_policy":1}
- Recoverable correct systems: {"broad_sufficiency_constructor":8,"train_selected_constrained_policy":4,"train_calibrated_scaffold":2,"learned_repaired_selector":1}
- Failure tags: {"answer_type_error":19,"selected_abstention":19,"numeric_metric_target":15,"irrecoverable_construction_gap":12,"correct_candidate_available":11,"multi_citation_target":11,"recoverable_selection_gap":11,"constructor_candidate_was_correct":8,"legacy_candidate_was_correct":7,"grounded_candidates_all_wrong":6,"no_grounded_answer_candidates":6,"citation_set_error":4,"multi_citation_synthesis_target":4,"selected_grounded_answer":4,"list_or_structured_target":3,"yes_no_polarity_target":1}

## Decision

- Use saved OpenAI key now: no
- Buy OpenAI judgments now: no
- Launch Prime now: no
- Train GPU model now: no
- Reason: After D417, 11/23 misses have a correct candidate already available, while 12/23 have no contract-correct candidate in the augmented pool. A paid judge or larger selector alone cannot close the construction side of the gap.
- Next step: Build a zero- or low-cost targeted candidate constructor for the irrecoverable rows while separately preparing richer support supervision for the recoverable rows.
