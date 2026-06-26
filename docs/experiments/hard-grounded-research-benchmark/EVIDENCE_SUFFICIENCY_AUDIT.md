# Hard Grounded Research Evidence Sufficiency Audit

This generated audit makes the benchmark's evidence contract explicit before human adjudication. It checks whether each pilot item has required evidence units, whether each hard category includes a trap or control signal, and whether insufficiency, citation-overreach, temporal, and contradiction probes are represented without allowing completion claims.

## Summary

- Audit ready: true
- Version: evidence-sufficiency-audit-v1
- Pilot items: 30
- Categories: 10
- Items with required evidence contracts: 30
- Items with distractor or control signals: 30
- Insufficiency items: 3
- Citation-overreach items: 3
- Temporal items: 6
- Contradiction items: 3
- Diagnostic-only items: 30
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_pilot_items_have_required_evidence_contract | true | 30/30 pilot items have required evidence IDs |
| hard_categories_have_distractor_or_control_signal | true | 10/10 categories expose a trap, distractor, conflict, or control signal |
| insufficiency_and_overreach_probes_present | true | 3 insufficiency probes; 3 citation-overreach probes |
| temporal_and_contradiction_contracts_present | true | 6 temporal probes; 3 contradiction probes |
| claims_remain_gated | true | completion_claim_allowed=false; diagnostic_only_items=30 |

## Category Evidence Contracts

| Category | Items | Evidence contracts | Trap/control items | Insufficiency/overreach | Temporal/contradiction | Claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 3 | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | 3 | 3/3 | 3 | 0/0 | 3/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | 3 | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | 3 | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | 3 | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | 3 | 3/3 | 3 | 3/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | 3 | 3/3 | 3 | 0/3 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | 3 | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | 3 | 3/3 | 3 | 0/0 | 3/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | 3 | 3/3 | 3 | 0/0 | 0/3 | diagnostic_only_until_review_scale_and_novelty_clear |

## Item Evidence Contracts

| Item | Category | Challenge | Required evidence | Excluded/control evidence | Answer policy | Contract status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_multi_hop_001_pilot_001 | multi-hop synthesis | native_row | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_multi_hop_001_pilot_002 | multi-hop synthesis | native_row | 3 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_multi_hop_001_pilot_003 | multi-hop synthesis | native_row | 5 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_stale_current_001_pilot_001 | stale-vs-current document conflicts | stale_current_conflict | 3 | 1 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_stale_current_001_pilot_002 | stale-vs-current document conflicts | stale_current_conflict | 4 | 1 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_stale_current_001_pilot_003 | stale-vs-current document conflicts | stale_current_conflict | 6 | 1 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_appendix_lifecycle_001_pilot_001 | appended document lifecycle changes | document_lifecycle_appendix | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_appendix_lifecycle_001_pilot_002 | appended document lifecycle changes | document_lifecycle_appendix | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_appendix_lifecycle_001_pilot_003 | appended document lifecycle changes | document_lifecycle_appendix | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_table_text_001_pilot_001 | table + text reasoning | native_row | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_table_text_001_pilot_002 | table + text reasoning | native_row | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_table_text_001_pilot_003 | table + text reasoning | native_row | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_authority_conflict_001_pilot_001 | source authority conflicts | authority_conflict | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_authority_conflict_001_pilot_002 | source authority conflicts | authority_conflict | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_authority_conflict_001_pilot_003 | source authority conflicts | authority_conflict | 2 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_abstain_001_pilot_001 | evidence insufficiency / abstention | insufficiency_probe | 2 | 0 | abstain_unless_direct_conclusion_support_is_present | machine_contract_present_needs_human_review |
| hgr_abstain_001_pilot_002 | evidence insufficiency / abstention | insufficiency_probe | 2 | 0 | abstain_unless_direct_conclusion_support_is_present | machine_contract_present_needs_human_review |
| hgr_abstain_001_pilot_003 | evidence insufficiency / abstention | insufficiency_probe | 2 | 0 | abstain_unless_direct_conclusion_support_is_present | machine_contract_present_needs_human_review |
| hgr_citation_overreach_001_pilot_001 | citation supports fact but not conclusion | citation_overreach_probe | 4 | 0 | separate_supported_fact_from_unsupported_conclusion | machine_contract_present_needs_human_review |
| hgr_citation_overreach_001_pilot_002 | citation supports fact but not conclusion | citation_overreach_probe | 5 | 0 | separate_supported_fact_from_unsupported_conclusion | machine_contract_present_needs_human_review |
| hgr_citation_overreach_001_pilot_003 | citation supports fact but not conclusion | citation_overreach_probe | 7 | 0 | separate_supported_fact_from_unsupported_conclusion | machine_contract_present_needs_human_review |
| hgr_entity_disambiguation_001_pilot_001 | entity disambiguation | native_row | 3 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_entity_disambiguation_001_pilot_002 | entity disambiguation | native_row | 4 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_entity_disambiguation_001_pilot_003 | entity disambiguation | native_row | 6 | 0 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_as_of_date_001_pilot_001 | temporal questions: as of date X | as_of_date_constraint | 3 | 2 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_as_of_date_001_pilot_002 | temporal questions: as of date X | as_of_date_constraint | 4 | 3 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_as_of_date_001_pilot_003 | temporal questions: as of date X | as_of_date_constraint | 6 | 5 | answer_only_with_complete_supporting_evidence | machine_contract_present_needs_human_review |
| hgr_contradiction_001_pilot_001 | cross-document contradiction | cross_document_contradiction | 4 | 0 | report_conflict_when_evidence_cannot_be_reconciled | machine_contract_present_needs_human_review |
| hgr_contradiction_001_pilot_002 | cross-document contradiction | cross_document_contradiction | 5 | 0 | report_conflict_when_evidence_cannot_be_reconciled | machine_contract_present_needs_human_review |
| hgr_contradiction_001_pilot_003 | cross-document contradiction | cross_document_contradiction | 7 | 0 | report_conflict_when_evidence_cannot_be_reconciled | machine_contract_present_needs_human_review |
