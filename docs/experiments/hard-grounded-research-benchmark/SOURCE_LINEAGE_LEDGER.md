# Hard Grounded Research Source Lineage Ledger

This generated ledger makes the Hugging Face grounding claim auditable. It maps pilot items and source-acquisition candidates to registered datasets, source-row keys, license/package policy, pointer-only status, and review state.

## Summary

- Ledger ready: true
- Version: source-lineage-ledger-v1
- Lineage rows: 276
- Pilot items: 30
- Acquisition candidates: 246
- Represented datasets: 6/6
- Distinct source rows: 261
- Redistributable evidence units: 261
- Pointer-only evidence units: 90
- Completion claim allowed: false

## Readiness Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_pilot_items_have_source_rows | true | 30/30 pilot items have source rows |
| all_acquisition_candidates_have_global_source_keys | true | 246 candidates; fetched rows=246 |
| dataset_summary_covers_registered_sources | true | 6/6 registered datasets represented in lineage rows |
| package_policy_visible_for_all_rows | true | 276 lineage rows expose pointer-only and redistributable evidence counts |
| review_state_remains_gated | true | 276/276 lineage rows blocked from gold promotion; source keys=261 |

## Dataset Summary

| Dataset | License | Families | Categories | Items | Distinct source rows | Redistributable / pointer-only units |
| --- | --- | --- | --- | --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | pilot_suite<br>source_acquisition_candidate | citation supports fact but not conclusion<br>cross-document contradiction<br>entity disambiguation<br>multi-hop synthesis<br>stale-vs-current document conflicts<br>temporal questions: as of date X | 72 | 57 | 126/9 |
| tdiggelm/climate_fever | unknown | pilot_suite<br>source_acquisition_candidate | cross-document contradiction<br>evidence insufficiency / abstention<br>source authority conflicts<br>stale-vs-current document conflicts<br>temporal questions: as of date X | 75 | 63 | 36/78 |
| allenai/qasper | cc-by-4.0 | pilot_suite<br>source_acquisition_candidate | appended document lifecycle changes<br>citation supports fact but not conclusion<br>cross-document contradiction<br>evidence insufficiency / abstention<br>multi-hop synthesis<br>table + text reasoning | 89 | 77 | 118/6 |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | pilot_suite<br>source_acquisition_candidate | citation supports fact but not conclusion<br>entity disambiguation<br>table + text reasoning | 25 | 19 | 51/0 |
| Pavithree/eli5 | unknown | pilot_suite<br>source_acquisition_candidate | source authority conflicts | 15 | 15 | 0/18 |
| DongfuJiang/FeTaQA | mit | source_acquisition_candidate | citation supports fact but not conclusion<br>entity disambiguation<br>table + text reasoning | 30 | 30 | 30/0 |

## Sample Lineage Rows

| Item | Family | Category | Datasets | Source keys | Review status |
| --- | --- | --- | --- | --- | --- |
| hgr_multi_hop_001_pilot_001 | pilot_suite | multi-hop synthesis | hotpotqa/hotpot_qa | hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371 | machine_seed_needs_human_adjudication |
| hgr_multi_hop_001_pilot_002 | pilot_suite | multi-hop synthesis | hotpotqa/hotpot_qa | hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6 | machine_seed_needs_human_adjudication |
| hgr_multi_hop_001_pilot_003 | pilot_suite | multi-hop synthesis | hotpotqa/hotpot_qa | hotpotqa/hotpot_qa:5a85ea095542994775f606a8 | machine_seed_needs_human_adjudication |
| hgr_stale_current_001_pilot_001 | pilot_suite | stale-vs-current document conflicts | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:0<br>hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371 | machine_seed_needs_human_adjudication |
| hgr_stale_current_001_pilot_002 | pilot_suite | stale-vs-current document conflicts | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:5<br>hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6 | machine_seed_needs_human_adjudication |
| hgr_stale_current_001_pilot_003 | pilot_suite | stale-vs-current document conflicts | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:6<br>hotpotqa/hotpot_qa:5a85ea095542994775f606a8 | machine_seed_needs_human_adjudication |
| hgr_appendix_lifecycle_001_pilot_001 | pilot_suite | appended document lifecycle changes | allenai/qasper | allenai/qasper:1912.01214 | machine_seed_needs_human_adjudication |
| hgr_appendix_lifecycle_001_pilot_002 | pilot_suite | appended document lifecycle changes | allenai/qasper | allenai/qasper:1810.08699 | machine_seed_needs_human_adjudication |
| hgr_appendix_lifecycle_001_pilot_003 | pilot_suite | appended document lifecycle changes | allenai/qasper | allenai/qasper:1609.00425 | machine_seed_needs_human_adjudication |
| hgr_table_text_001_pilot_001 | pilot_suite | table + text reasoning | danwakeem/wikitablequestions-wtq<br>allenai/qasper | danwakeem/wikitablequestions-wtq:nt-0<br>allenai/qasper:1912.01214 | machine_seed_needs_human_adjudication |
| hgr_table_text_001_pilot_002 | pilot_suite | table + text reasoning | danwakeem/wikitablequestions-wtq<br>allenai/qasper | danwakeem/wikitablequestions-wtq:nt-1<br>allenai/qasper:1810.08699 | machine_seed_needs_human_adjudication |
| hgr_table_text_001_pilot_003 | pilot_suite | table + text reasoning | danwakeem/wikitablequestions-wtq<br>allenai/qasper | danwakeem/wikitablequestions-wtq:nt-4<br>allenai/qasper:1609.00425 | machine_seed_needs_human_adjudication |
| hgr_authority_conflict_001_pilot_001 | pilot_suite | source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | tdiggelm/climate_fever:0<br>Pavithree/eli5:2bln8r | machine_seed_needs_human_adjudication |
| hgr_authority_conflict_001_pilot_002 | pilot_suite | source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | tdiggelm/climate_fever:5<br>Pavithree/eli5:48hjn0 | machine_seed_needs_human_adjudication |
| hgr_authority_conflict_001_pilot_003 | pilot_suite | source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | tdiggelm/climate_fever:6<br>Pavithree/eli5:20wt9u | machine_seed_needs_human_adjudication |
| hgr_abstain_001_pilot_001 | pilot_suite | evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | allenai/qasper:1912.01214<br>tdiggelm/climate_fever:0 | machine_seed_needs_human_adjudication |
| hgr_abstain_001_pilot_002 | pilot_suite | evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | allenai/qasper:1810.08699<br>tdiggelm/climate_fever:5 | machine_seed_needs_human_adjudication |
| hgr_abstain_001_pilot_003 | pilot_suite | evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | allenai/qasper:1609.00425<br>tdiggelm/climate_fever:6 | machine_seed_needs_human_adjudication |
| hgr_citation_overreach_001_pilot_001 | pilot_suite | citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371<br>allenai/qasper:1912.01214<br>danwakeem/wikitablequestions-wtq:nt-0 | machine_seed_needs_human_adjudication |
| hgr_citation_overreach_001_pilot_002 | pilot_suite | citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6<br>allenai/qasper:1810.08699<br>danwakeem/wikitablequestions-wtq:nt-1 | machine_seed_needs_human_adjudication |
| hgr_citation_overreach_001_pilot_003 | pilot_suite | citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a85ea095542994775f606a8<br>allenai/qasper:1609.00425<br>danwakeem/wikitablequestions-wtq:nt-4 | machine_seed_needs_human_adjudication |
| hgr_entity_disambiguation_001_pilot_001 | pilot_suite | entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371<br>danwakeem/wikitablequestions-wtq:nt-0 | machine_seed_needs_human_adjudication |
| hgr_entity_disambiguation_001_pilot_002 | pilot_suite | entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6<br>danwakeem/wikitablequestions-wtq:nt-1 | machine_seed_needs_human_adjudication |
| hgr_entity_disambiguation_001_pilot_003 | pilot_suite | entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | hotpotqa/hotpot_qa:5a85ea095542994775f606a8<br>danwakeem/wikitablequestions-wtq:nt-4 | machine_seed_needs_human_adjudication |
| hgr_as_of_date_001_pilot_001 | pilot_suite | temporal questions: as of date X | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:0<br>hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371 | machine_seed_needs_human_adjudication |
| hgr_as_of_date_001_pilot_002 | pilot_suite | temporal questions: as of date X | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:5<br>hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6 | machine_seed_needs_human_adjudication |
| hgr_as_of_date_001_pilot_003 | pilot_suite | temporal questions: as of date X | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | tdiggelm/climate_fever:6<br>hotpotqa/hotpot_qa:5a85ea095542994775f606a8 | machine_seed_needs_human_adjudication |
| hgr_contradiction_001_pilot_001 | pilot_suite | cross-document contradiction | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper | tdiggelm/climate_fever:0<br>hotpotqa/hotpot_qa:5a8b57f25542995d1e6f1371<br>allenai/qasper:1912.01214 | machine_seed_needs_human_adjudication |
| hgr_contradiction_001_pilot_002 | pilot_suite | cross-document contradiction | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper | tdiggelm/climate_fever:5<br>hotpotqa/hotpot_qa:5a8c7595554299585d9e36b6<br>allenai/qasper:1810.08699 | machine_seed_needs_human_adjudication |
| hgr_contradiction_001_pilot_003 | pilot_suite | cross-document contradiction | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper | tdiggelm/climate_fever:6<br>hotpotqa/hotpot_qa:5a85ea095542994775f606a8<br>allenai/qasper:1609.00425 | machine_seed_needs_human_adjudication |

## Release Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| source_acquisition_candidates_ready | true | 246 candidates; categories=10; required_review_rows=492 | Materialize fetched source rows into review-pending task candidates before exporting source-acquisition review workbooks. |
| source_acquisition_review_workbooks_ready | true | 20 workbooks; 492 review rows; pointer_only_rows=144 | Generate reviewer workbooks for source-acquisition candidates before collecting independent reviews. |
| source_acquisition_review_preflight_report_ready | true | 0/492 review rows complete; preflight_ready=false | Generate source-acquisition review preflight so returned reviewer packets have a strict validation target. |
| unknown_license_resolved | true | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true | Resolve, replace, or pointer-only package unknown-license sources before public redistribution. |
