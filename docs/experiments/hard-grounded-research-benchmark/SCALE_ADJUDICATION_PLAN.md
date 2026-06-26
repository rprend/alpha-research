# Hard Grounded Research Scale Adjudication Plan

This generated plan turns the category-scale blocker into batch-level adjudication work. It does not synthesize labels, complete expansion review, promote scaled gold, or clear category-level claims.

## Summary

- Plan ready: true
- Version: scale-adjudication-plan-v1
- Expansion batches: 30
- Categories: 10
- Planned new items: 270
- Planned review rows: 540
- Complete review rows: 0
- Missing review rows: 540
- Merge-ready items: 0
- First-wave expansion packets: 20
- First-wave expansion missing packets: 20
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| scale_batches_loaded | true | 30/30 scale batches planned |
| category_targets_loaded | true | 10/10 categories; target=30 |
| review_workload_matches_scale_plan | true | 270/270 candidates; 540/540 review rows |
| first_wave_collection_linked | true | 20 first-wave expansion packets; 20 missing |
| source_acquisition_gap_visible | true | 246 source-acquisition candidates tracked separately |
| scale_promotion_still_blocked | true | 0/300 reviewed target items |

## Blocking Gates

| Gate | Passed | Detail | Required action |
| --- | --- | --- | --- |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |

## Category Scale Plan

| Category | Batches | Candidate items | Review rows | First-wave batches | Merge-ready | Remaining to target | Source datasets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 3 | 27 | 54 | 1 | 0 | 30 | hotpotqa/hotpot_qa |
| stale-vs-current document conflicts | 3 | 27 | 54 | 1 | 0 | 30 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| appended document lifecycle changes | 3 | 27 | 54 | 1 | 0 | 30 | allenai/qasper |
| table + text reasoning | 3 | 27 | 54 | 1 | 0 | 30 | danwakeem/wikitablequestions-wtq<br>allenai/qasper |
| source authority conflicts | 3 | 27 | 54 | 1 | 0 | 30 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| evidence insufficiency / abstention | 3 | 27 | 54 | 1 | 0 | 30 | allenai/qasper<br>tdiggelm/climate_fever |
| citation supports fact but not conclusion | 3 | 27 | 54 | 1 | 0 | 30 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq |
| entity disambiguation | 3 | 27 | 54 | 1 | 0 | 30 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq |
| temporal questions: as of date X | 3 | 27 | 54 | 1 | 0 | 30 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| cross-document contradiction | 3 | 27 | 54 | 1 | 0 | 30 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper |

## Adjudication Steps

| # | Step |
| --- | --- |
| 1 | Collect first-wave expansion return packets and import only after dry-run validation is clean. |
| 2 | Export or collect later-wave expansion batches until every category has 30 reviewed target items. |
| 3 | Run expansion preflight and merge after each wave; adjudicate disagreements with category_fit and generation_defect fields. |
| 4 | Regenerate scale plan, power plan, review progress, paper tables, and release gate after each applied review wave. |
| 5 | Keep category-level paper claims blocked until category_scale_ready and novelty_audit_final both pass. |

## Batch Plan

| Batch | Category | Items | Review rows | First wave | Missing reviews | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_scale_batch_01 | multi-hop synthesis | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_02 | multi-hop synthesis | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_03 | multi-hop synthesis | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_04 | stale-vs-current document conflicts | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_05 | stale-vs-current document conflicts | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_06 | stale-vs-current document conflicts | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_07 | appended document lifecycle changes | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_08 | appended document lifecycle changes | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_09 | appended document lifecycle changes | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_10 | table + text reasoning | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_11 | table + text reasoning | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_12 | table + text reasoning | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_13 | source authority conflicts | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_14 | source authority conflicts | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_15 | source authority conflicts | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_16 | evidence insufficiency / abstention | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_17 | evidence insufficiency / abstention | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_18 | evidence insufficiency / abstention | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_19 | citation supports fact but not conclusion | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_20 | citation supports fact but not conclusion | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_21 | citation supports fact but not conclusion | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_22 | entity disambiguation | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_23 | entity disambiguation | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_24 | entity disambiguation | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_25 | temporal questions: as of date X | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_26 | temporal questions: as of date X | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_27 | temporal questions: as of date X | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_28 | cross-document contradiction | 9 | 18 | yes | 18 | awaiting_first_wave_returns |
| hgr_scale_batch_29 | cross-document contradiction | 9 | 18 | no | 18 | awaiting_later_wave_export |
| hgr_scale_batch_30 | cross-document contradiction | 9 | 18 | no | 18 | awaiting_later_wave_export |
