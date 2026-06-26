# Hard Grounded Research Review Triage

This generated packet ranks pilot review rows using observed failures from eligible external model baselines. It does not complete reviewer fields or promote gold; it tells reviewers which rows deserve first attention because real models already failed there.

## Summary

- Eligible model baselines: anthropic-grounded-baseline-v1, openai-grounded-baseline-v1
- Model baseline count: 2
- Pilot items ranked: 30
- Urgent or high-priority items: 23
- Review triage ready: true

## Category Triage

| Category | Items | Urgent/high | Max score | Top items |
| --- | --- | --- | --- | --- |
| cross-document contradiction | 3 | 3 | 27.8571 | hgr_contradiction_001_pilot_003<br>hgr_contradiction_001_pilot_001<br>hgr_contradiction_001_pilot_002 |
| evidence insufficiency / abstention | 3 | 3 | 27.5 | hgr_abstain_001_pilot_003<br>hgr_abstain_001_pilot_001<br>hgr_abstain_001_pilot_002 |
| temporal questions: as of date X | 3 | 3 | 25.8333 | hgr_as_of_date_001_pilot_003<br>hgr_as_of_date_001_pilot_002<br>hgr_as_of_date_001_pilot_001 |
| stale-vs-current document conflicts | 3 | 3 | 25.8333 | hgr_stale_current_001_pilot_003<br>hgr_stale_current_001_pilot_001<br>hgr_stale_current_001_pilot_002 |
| source authority conflicts | 3 | 3 | 25.5 | hgr_authority_conflict_001_pilot_001<br>hgr_authority_conflict_001_pilot_003<br>hgr_authority_conflict_001_pilot_002 |
| table + text reasoning | 3 | 3 | 25.5 | hgr_table_text_001_pilot_003<br>hgr_table_text_001_pilot_001<br>hgr_table_text_001_pilot_002 |
| appended document lifecycle changes | 3 | 2 | 10 | hgr_appendix_lifecycle_001_pilot_001<br>hgr_appendix_lifecycle_001_pilot_003<br>hgr_appendix_lifecycle_001_pilot_002 |
| citation supports fact but not conclusion | 3 | 3 | 9.2 | hgr_citation_overreach_001_pilot_002<br>hgr_citation_overreach_001_pilot_003<br>hgr_citation_overreach_001_pilot_001 |
| multi-hop synthesis | 3 | 0 | 1.2 | hgr_multi_hop_001_pilot_003<br>hgr_multi_hop_001_pilot_002<br>hgr_multi_hop_001_pilot_001 |
| entity disambiguation | 3 | 0 | 1.1667 | hgr_entity_disambiguation_001_pilot_003<br>hgr_entity_disambiguation_001_pilot_002<br>hgr_entity_disambiguation_001_pilot_001 |

## Top Review Items

| Item | Category | Priority | Score | Signals |
| --- | --- | --- | --- | --- |
| hgr_contradiction_001_pilot_003 | cross-document contradiction | urgent | 27.8571 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_contradiction_001_pilot_001 | cross-document contradiction | urgent | 27.75 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_contradiction_001_pilot_002 | cross-document contradiction | urgent | 27.6 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_abstain_001_pilot_003 | evidence insufficiency / abstention | urgent | 27.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_as_of_date_001_pilot_003 | temporal questions: as of date X | urgent | 25.8333 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_stale_current_001_pilot_003 | stale-vs-current document conflicts | urgent | 25.8333 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_as_of_date_001_pilot_002 | temporal questions: as of date X | urgent | 25.75 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_as_of_date_001_pilot_001 | temporal questions: as of date X | urgent | 25.6667 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_stale_current_001_pilot_001 | stale-vs-current document conflicts | urgent | 25.6667 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_abstain_001_pilot_001 | evidence insufficiency / abstention | urgent | 25.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_authority_conflict_001_pilot_001 | source authority conflicts | urgent | 25.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_authority_conflict_001_pilot_003 | source authority conflicts | urgent | 25.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_table_text_001_pilot_003 | table + text reasoning | urgent | 25.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_stale_current_001_pilot_002 | stale-vs-current document conflicts | urgent | 23.75 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_authority_conflict_001_pilot_002 | source authority conflicts | urgent | 23.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_table_text_001_pilot_001 | table + text reasoning | urgent | 23.5 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support<br>abstention_or_conflict_handling_failure |
| hgr_table_text_001_pilot_002 | table + text reasoning | urgent | 21 | all_models_answer_incorrect<br>all_models_low_citation_faithfulness<br>all_models_low_conclusion_support |
| hgr_abstain_001_pilot_002 | evidence insufficiency / abstention | urgent | 15.5 | some_models_answer_incorrect<br>some_models_low_citation_faithfulness<br>some_models_low_conclusion_support<br>abstention_or_conflict_handling_failure<br>cross_model_answer_disagreement |
| hgr_appendix_lifecycle_001_pilot_001 | appended document lifecycle changes | high | 10 | some_models_answer_incorrect<br>some_models_low_citation_faithfulness<br>some_models_low_conclusion_support<br>cross_model_answer_disagreement |
| hgr_appendix_lifecycle_001_pilot_003 | appended document lifecycle changes | high | 10 | some_models_answer_incorrect<br>some_models_low_citation_faithfulness<br>some_models_low_conclusion_support<br>cross_model_answer_disagreement |
| hgr_citation_overreach_001_pilot_002 | citation supports fact but not conclusion | high | 9.2 | all_models_low_conclusion_support |
| hgr_citation_overreach_001_pilot_003 | citation supports fact but not conclusion | high | 9.1429 | all_models_low_conclusion_support |
| hgr_citation_overreach_001_pilot_001 | citation supports fact but not conclusion | high | 9 | all_models_low_conclusion_support |
| hgr_multi_hop_001_pilot_003 | multi-hop synthesis | standard | 1.2 | none |
| hgr_entity_disambiguation_001_pilot_003 | entity disambiguation | standard | 1.1667 | none |
| hgr_entity_disambiguation_001_pilot_002 | entity disambiguation | standard | 1 | none |
| hgr_entity_disambiguation_001_pilot_001 | entity disambiguation | standard | 0.6666 | none |
| hgr_multi_hop_001_pilot_002 | multi-hop synthesis | standard | 0.6666 | none |
| hgr_appendix_lifecycle_001_pilot_002 | appended document lifecycle changes | standard | 0 | none |
| hgr_multi_hop_001_pilot_001 | multi-hop synthesis | standard | 0 | none |
