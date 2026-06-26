# Hard Grounded Research Expansion Manifest

This generated manifest converts the scale plan into deterministic generation contracts. Each batch is ready for item generation, reviewer workbook creation, and later adjudication.

## Summary

- Manifest id: hard-grounded-expansion-manifest-v1
- Source scale plan: generated/scale-plan.json
- Status: ready_for_generation
- Batches: 30
- Target new items: 270
- Required review rows: 540

## Batch Contracts

| Batch | Category | Target new items | Required review rows | Source datasets |
| --- | --- | --- | --- | --- |
| hgr_scale_batch_01 | multi-hop synthesis | 9 | 18 | hotpotqa/hotpot_qa |
| hgr_scale_batch_02 | multi-hop synthesis | 9 | 18 | hotpotqa/hotpot_qa |
| hgr_scale_batch_03 | multi-hop synthesis | 9 | 18 | hotpotqa/hotpot_qa |
| hgr_scale_batch_04 | stale-vs-current document conflicts | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_05 | stale-vs-current document conflicts | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_06 | stale-vs-current document conflicts | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_07 | appended document lifecycle changes | 9 | 18 | allenai/qasper |
| hgr_scale_batch_08 | appended document lifecycle changes | 9 | 18 | allenai/qasper |
| hgr_scale_batch_09 | appended document lifecycle changes | 9 | 18 | allenai/qasper |
| hgr_scale_batch_10 | table + text reasoning | 9 | 18 | danwakeem/wikitablequestions-wtq<br>allenai/qasper |
| hgr_scale_batch_11 | table + text reasoning | 9 | 18 | danwakeem/wikitablequestions-wtq<br>allenai/qasper |
| hgr_scale_batch_12 | table + text reasoning | 9 | 18 | danwakeem/wikitablequestions-wtq<br>allenai/qasper |
| hgr_scale_batch_13 | source authority conflicts | 9 | 18 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| hgr_scale_batch_14 | source authority conflicts | 9 | 18 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| hgr_scale_batch_15 | source authority conflicts | 9 | 18 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| hgr_scale_batch_16 | evidence insufficiency / abstention | 9 | 18 | allenai/qasper<br>tdiggelm/climate_fever |
| hgr_scale_batch_17 | evidence insufficiency / abstention | 9 | 18 | allenai/qasper<br>tdiggelm/climate_fever |
| hgr_scale_batch_18 | evidence insufficiency / abstention | 9 | 18 | allenai/qasper<br>tdiggelm/climate_fever |
| hgr_scale_batch_19 | citation supports fact but not conclusion | 9 | 18 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_20 | citation supports fact but not conclusion | 9 | 18 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_21 | citation supports fact but not conclusion | 9 | 18 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_22 | entity disambiguation | 9 | 18 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_23 | entity disambiguation | 9 | 18 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_24 | entity disambiguation | 9 | 18 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq |
| hgr_scale_batch_25 | temporal questions: as of date X | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_26 | temporal questions: as of date X | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_27 | temporal questions: as of date X | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa |
| hgr_scale_batch_28 | cross-document contradiction | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper |
| hgr_scale_batch_29 | cross-document contradiction | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper |
| hgr_scale_batch_30 | cross-document contradiction | 9 | 18 | tdiggelm/climate_fever<br>hotpotqa/hotpot_qa<br>allenai/qasper |

## Required Output Schema

Each generated item must include a stable `item_id`, `category`, `question`, `expected_answer`, `source_examples`, minimal `evidence_units`, `hard_grounding_signals`, and row-level `provenance`.
