# Current Grounded Gap Taxonomy Audit

Generated: 2026-06-29T04:27:00.215Z

Status: `grounded_gap_candidate_absence_dominates`

This audit makes no API calls and launches no GPU jobs. It decomposes the repaired-validation grounded-answer misses after D391.

## Summary

- Grounded examples: 31
- Router grounded correct: 8/31 (25.8%)
- Three-system selector-gap rows: 7
- Three-system candidate-surface-only rows: 4
- Five-system candidate-absence rows: 12
- Five-system oracle grounded correct: 19/31
- Evidence constructor grounded correct: 8/31
- Multi-citation targets: 11
- Multi-citation candidate-absence rows: 7
- All targets have cited evidence in pack: yes

## Breakdown

- By gap class: {"candidate_absence_gap_five_system_pool":12,"candidate_surface_gap_three_system_pool_only":4,"router_selected_correct":8,"router_selection_gap_three_system_pool":7}
- By answer form: {"multi_citation_synthesis":3,"numeric_or_metric":20,"yes_no_polarity":1,"list_or_structured_answer":7}
- Candidate absence by answer form: {"multi_citation_synthesis":2,"numeric_or_metric":9,"yes_no_polarity":1}
- Failure tags: {"shallow_constructor_failed":23,"numeric_metric_target":20,"no_existing_candidate_contract_correct":12,"multi_citation_target":11,"list_or_structured_target":7,"selector_missed_correct_three_system_candidate":7,"needs_validation_only_or_qwen_candidate_surface":4,"yes_no_polarity_target":1}

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Train selector now: no
- Reason: The repaired-validation grounded gap is dominated by 12 five-system candidate-absence rows versus 7 three-system selector-gap rows.
- Next step: Build a targeted grounded-answer construction packet for the dominant unrecovered answer forms before another selector or judge run.
