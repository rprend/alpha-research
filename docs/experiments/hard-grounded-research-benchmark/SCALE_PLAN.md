# Hard Grounded Research Scale Plan

This generated plan tracks the gap between the current pilot suite and a paper-grade benchmark scale. It intentionally uses reviewed item targets rather than raw generated examples.

## Summary

- Target reviewed items per category: 30
- Categories: 10
- Total target reviewed items: 300
- Current pilot items: 30
- Current valid reviewed items: 0
- Additional pilot items needed: 270
- Additional reviewed items needed: 300
- Expansion batch size: 9
- Expansion batches: 30
- Planned new items: 270
- Planned review rows: 540
- Scale ready: false

## Category Targets

| Category | Target reviewed | Pilot items | Valid reviewed | Pilot gap | Reviewed gap | Ready |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 30 | 3 | 0 | 27 | 30 | no |
| stale-vs-current document conflicts | 30 | 3 | 0 | 27 | 30 | no |
| appended document lifecycle changes | 30 | 3 | 0 | 27 | 30 | no |
| table + text reasoning | 30 | 3 | 0 | 27 | 30 | no |
| source authority conflicts | 30 | 3 | 0 | 27 | 30 | no |
| evidence insufficiency / abstention | 30 | 3 | 0 | 27 | 30 | no |
| citation supports fact but not conclusion | 30 | 3 | 0 | 27 | 30 | no |
| entity disambiguation | 30 | 3 | 0 | 27 | 30 | no |
| temporal questions: as of date X | 30 | 3 | 0 | 27 | 30 | no |
| cross-document contradiction | 30 | 3 | 0 | 27 | 30 | no |

## Expansion Blueprint

| Category | Source datasets | Generation strategy |
| --- | --- | --- |
| multi-hop synthesis | hotpotqa/hotpot_qa | Sample additional bridge/comparison rows; preserve all required supporting facts; add distractor passages that support only one hop. |
| stale-vs-current document conflicts | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | Pair older claim/evidence rows with newer controlling evidence; assign synthetic document dates and require stale-evidence rejection. |
| appended document lifecycle changes | allenai/qasper | Select long-document QA rows and generate appendix/erratum wrappers that supersede one body claim while retaining original evidence. |
| table + text reasoning | danwakeem/wikitablequestions-wtq<br>allenai/qasper | Pair table denotation questions with supporting or disambiguating text snippets; require both table cell grounding and textual context. |
| source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | Compose lower-authority explanatory/claim evidence with higher-authority source evidence; encode which source controls the answer. |
| evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | Remove required evidence from otherwise relevant contexts and retain near-miss passages that should not justify an answer. |
| citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq | Keep citations that support true subfacts while withholding the link needed for the requested conclusion. |
| entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | Sample same-name or near-name entities across evidence sets; require citations that identify the intended referent. |
| temporal questions: as of date X | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa | Wrap evidence with as-of dates and conflicting later/earlier snapshots; require answers scoped to the requested date. |
| cross-document contradiction | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper | Compose mutually inconsistent evidence sets and require explicit conflict reporting unless an authority/date rule controls. |

## Expansion Batches

| Batch | Category | Target new items | Review rows required | Status |
| --- | --- | --- | --- | --- |
| hgr_scale_batch_01 | multi-hop synthesis | 9 | 18 | planned_not_generated |
| hgr_scale_batch_02 | multi-hop synthesis | 9 | 18 | planned_not_generated |
| hgr_scale_batch_03 | multi-hop synthesis | 9 | 18 | planned_not_generated |
| hgr_scale_batch_04 | stale-vs-current document conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_05 | stale-vs-current document conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_06 | stale-vs-current document conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_07 | appended document lifecycle changes | 9 | 18 | planned_not_generated |
| hgr_scale_batch_08 | appended document lifecycle changes | 9 | 18 | planned_not_generated |
| hgr_scale_batch_09 | appended document lifecycle changes | 9 | 18 | planned_not_generated |
| hgr_scale_batch_10 | table + text reasoning | 9 | 18 | planned_not_generated |
| hgr_scale_batch_11 | table + text reasoning | 9 | 18 | planned_not_generated |
| hgr_scale_batch_12 | table + text reasoning | 9 | 18 | planned_not_generated |
| hgr_scale_batch_13 | source authority conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_14 | source authority conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_15 | source authority conflicts | 9 | 18 | planned_not_generated |
| hgr_scale_batch_16 | evidence insufficiency / abstention | 9 | 18 | planned_not_generated |
| hgr_scale_batch_17 | evidence insufficiency / abstention | 9 | 18 | planned_not_generated |
| hgr_scale_batch_18 | evidence insufficiency / abstention | 9 | 18 | planned_not_generated |
| hgr_scale_batch_19 | citation supports fact but not conclusion | 9 | 18 | planned_not_generated |
| hgr_scale_batch_20 | citation supports fact but not conclusion | 9 | 18 | planned_not_generated |
| hgr_scale_batch_21 | citation supports fact but not conclusion | 9 | 18 | planned_not_generated |
| hgr_scale_batch_22 | entity disambiguation | 9 | 18 | planned_not_generated |
| hgr_scale_batch_23 | entity disambiguation | 9 | 18 | planned_not_generated |
| hgr_scale_batch_24 | entity disambiguation | 9 | 18 | planned_not_generated |
| hgr_scale_batch_25 | temporal questions: as of date X | 9 | 18 | planned_not_generated |
| hgr_scale_batch_26 | temporal questions: as of date X | 9 | 18 | planned_not_generated |
| hgr_scale_batch_27 | temporal questions: as of date X | 9 | 18 | planned_not_generated |
| hgr_scale_batch_28 | cross-document contradiction | 9 | 18 | planned_not_generated |
| hgr_scale_batch_29 | cross-document contradiction | 9 | 18 | planned_not_generated |
| hgr_scale_batch_30 | cross-document contradiction | 9 | 18 | planned_not_generated |
