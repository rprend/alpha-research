# Hard Grounded Research Derived Label Suite

This generated suite promotes benchmark labels from Hugging Face dataset-native answers, native evidence ids, and deterministic challenge metadata. Human annotation is not the primary label source; it remains an optional audit layer for spot-checking and qualitative error analysis.

## Summary

| Field | Value |
| --- | --- |
| Suite ready | true |
| Items | 30 |
| Paper-eligible items | 30 |
| Categories | 10 |
| HF datasets | 5 |
| HF source rows | 15 |
| HF-native gold items | 9 |
| Deterministic transform gold items | 21 |
| Findings | 0 |
| Completion claim allowed | false |

## Claim Boundary

- Primary truth source: Hugging Face dataset-native supervision plus deterministic transformations
- Human annotation role: optional audit and error analysis only; not the primary label source
- Completion claim allowed: false

## Category Coverage

| Category | Items | Paper-eligible | HF-native gold | Deterministic transform gold | Findings |
| --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 3 | 3 | 3 | 0 | 0 |
| stale-vs-current document conflicts | 3 | 3 | 0 | 3 | 0 |
| appended document lifecycle changes | 3 | 3 | 0 | 3 | 0 |
| table + text reasoning | 3 | 3 | 3 | 0 | 0 |
| source authority conflicts | 3 | 3 | 0 | 3 | 0 |
| evidence insufficiency / abstention | 3 | 3 | 0 | 3 | 0 |
| citation supports fact but not conclusion | 3 | 3 | 0 | 3 | 0 |
| entity disambiguation | 3 | 3 | 3 | 0 | 0 |
| temporal questions: as of date X | 3 | 3 | 0 | 3 | 0 |
| cross-document contradiction | 3 | 3 | 0 | 3 | 0 |

## Items

| Item | Category | Challenge | Tier | Final label | Required citations | Paper eligible |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_multi_hop_001_pilot_001 | multi-hop synthesis | native_row | hf_native_gold | SUPPORTED | 2 | true |
| hgr_multi_hop_001_pilot_002 | multi-hop synthesis | native_row | hf_native_gold | SUPPORTED | 3 | true |
| hgr_multi_hop_001_pilot_003 | multi-hop synthesis | native_row | hf_native_gold | SUPPORTED | 5 | true |
| hgr_stale_current_001_pilot_001 | stale-vs-current document conflicts | stale_current_conflict | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_stale_current_001_pilot_002 | stale-vs-current document conflicts | stale_current_conflict | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_stale_current_001_pilot_003 | stale-vs-current document conflicts | stale_current_conflict | deterministic_transform_gold | REFUTES | 1 | true |
| hgr_appendix_lifecycle_001_pilot_001 | appended document lifecycle changes | document_lifecycle_appendix | deterministic_transform_gold | SUPPORTED | 2 | true |
| hgr_appendix_lifecycle_001_pilot_002 | appended document lifecycle changes | document_lifecycle_appendix | deterministic_transform_gold | SUPPORTED | 2 | true |
| hgr_appendix_lifecycle_001_pilot_003 | appended document lifecycle changes | document_lifecycle_appendix | deterministic_transform_gold | SUPPORTED | 2 | true |
| hgr_table_text_001_pilot_001 | table + text reasoning | native_row | hf_native_gold | SUPPORTED | 1 | true |
| hgr_table_text_001_pilot_002 | table + text reasoning | native_row | hf_native_gold | SUPPORTED | 1 | true |
| hgr_table_text_001_pilot_003 | table + text reasoning | native_row | hf_native_gold | SUPPORTED | 1 | true |
| hgr_authority_conflict_001_pilot_001 | source authority conflicts | authority_conflict | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_authority_conflict_001_pilot_002 | source authority conflicts | authority_conflict | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_authority_conflict_001_pilot_003 | source authority conflicts | authority_conflict | deterministic_transform_gold | REFUTES | 1 | true |
| hgr_abstain_001_pilot_001 | evidence insufficiency / abstention | insufficiency_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_abstain_001_pilot_002 | evidence insufficiency / abstention | insufficiency_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_abstain_001_pilot_003 | evidence insufficiency / abstention | insufficiency_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_citation_overreach_001_pilot_001 | citation supports fact but not conclusion | citation_overreach_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_citation_overreach_001_pilot_002 | citation supports fact but not conclusion | citation_overreach_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_citation_overreach_001_pilot_003 | citation supports fact but not conclusion | citation_overreach_probe | deterministic_transform_gold | INSUFFICIENT | 0 | true |
| hgr_entity_disambiguation_001_pilot_001 | entity disambiguation | native_row | hf_native_gold | SUPPORTED | 2 | true |
| hgr_entity_disambiguation_001_pilot_002 | entity disambiguation | native_row | hf_native_gold | SUPPORTED | 3 | true |
| hgr_entity_disambiguation_001_pilot_003 | entity disambiguation | native_row | hf_native_gold | SUPPORTED | 5 | true |
| hgr_as_of_date_001_pilot_001 | temporal questions: as of date X | as_of_date_constraint | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_as_of_date_001_pilot_002 | temporal questions: as of date X | as_of_date_constraint | deterministic_transform_gold | SUPPORTS | 1 | true |
| hgr_as_of_date_001_pilot_003 | temporal questions: as of date X | as_of_date_constraint | deterministic_transform_gold | REFUTES | 1 | true |
| hgr_contradiction_001_pilot_001 | cross-document contradiction | cross_document_contradiction | deterministic_transform_gold | CONFLICT | 2 | true |
| hgr_contradiction_001_pilot_002 | cross-document contradiction | cross_document_contradiction | deterministic_transform_gold | CONFLICT | 2 | true |
| hgr_contradiction_001_pilot_003 | cross-document contradiction | cross_document_contradiction | deterministic_transform_gold | CONFLICT | 2 | true |

## Findings

No derivation findings.
