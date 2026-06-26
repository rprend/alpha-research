# Source Acquisition Fetched Rows

This generated artifact executes the source acquisition packet queue against the Hugging Face dataset viewer. It records source-row metadata and stable row IDs for future task materialization; it does not create gold labels or paper-ready reviewed items.

## Summary

- Source acquisition fetch ready: true
- Source acquisition fetch report ready: true
- Requested rows: 246
- Fetched rows: 246
- Distinct source rows: 246
- Known-license rows with previews: 174
- Pointer-only rows: 72
- Findings: 0
- Completion claim allowed: false

## Dataset Counts

| Dataset | Fetched rows |
| --- | --- |
| DongfuJiang/FeTaQA | 30 |
| Pavithree/eli5 | 12 |
| allenai/qasper | 74 |
| danwakeem/wikitablequestions-wtq | 16 |
| hotpotqa/hotpot_qa | 54 |
| tdiggelm/climate_fever | 60 |

## Batch Results

| Batch | Category | Dataset | Fetched/requested | Pages fetched | Findings |
| --- | --- | --- | --- | --- | --- |
| source_acq_001 | multi-hop synthesis | allenai/qasper | 14/14 | 1 | none |
| source_acq_002 | multi-hop synthesis | hotpotqa/hotpot_qa | 13/13 | 1 | none |
| source_acq_003 | stale-vs-current document conflicts | tdiggelm/climate_fever | 24/24 | 1 | none |
| source_acq_004 | appended document lifecycle changes | allenai/qasper | 27/27 | 1 | none |
| source_acq_005 | table + text reasoning | danwakeem/wikitablequestions-wtq | 12/12 | 1 | none |
| source_acq_006 | table + text reasoning | DongfuJiang/FeTaQA | 12/12 | 1 | none |
| source_acq_007 | source authority conflicts | Pavithree/eli5 | 12/12 | 1 | none |
| source_acq_008 | source authority conflicts | tdiggelm/climate_fever | 12/12 | 1 | none |
| source_acq_009 | evidence insufficiency / abstention | allenai/qasper | 27/27 | 1 | none |
| source_acq_010 | citation supports fact but not conclusion | allenai/qasper | 6/6 | 1 | none |
| source_acq_011 | citation supports fact but not conclusion | danwakeem/wikitablequestions-wtq | 4/4 | 1 | none |
| source_acq_012 | citation supports fact but not conclusion | DongfuJiang/FeTaQA | 6/6 | 1 | none |
| source_acq_013 | citation supports fact but not conclusion | hotpotqa/hotpot_qa | 5/5 | 1 | none |
| source_acq_014 | entity disambiguation | DongfuJiang/FeTaQA | 12/12 | 1 | none |
| source_acq_015 | entity disambiguation | hotpotqa/hotpot_qa | 12/12 | 1 | none |
| source_acq_016 | temporal questions: as of date X | tdiggelm/climate_fever | 24/24 | 1 | none |
| source_acq_017 | cross-document contradiction | hotpotqa/hotpot_qa | 24/24 | 1 | none |

## Packaging Rule

Rows from `redistributable_known_license_evidence` packets include a short row preview. Rows from `pointer_only_until_license_clearance` packets store only row IDs, field keys, offsets, and metadata so this generated artifact does not redistribute unknown-license source text.

## Next Required Work

1. Deduplicate fetched rows against existing benchmark source rows.
2. Materialize hard-grounded task candidates from fetched rows.
3. Export candidate rows into reviewer workbooks.
4. Complete two independent reviews and adjudication before gold promotion.
