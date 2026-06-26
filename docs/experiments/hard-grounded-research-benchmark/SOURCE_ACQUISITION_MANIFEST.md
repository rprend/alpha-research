# Hard Grounded Research Source Acquisition Manifest

This generated manifest converts the source-diversity deficit into concrete Hugging Face acquisition batches. It does not import new rows by itself and does not create gold labels; it specifies what the next corpus expansion must sample before large-corpus category claims are defensible.

## Summary

- Source acquisition manifest ready: true
- Acquisition batches: 17
- Categories covered: 10
- Source datasets covered: 6
- Target new distinct source rows: 246
- Known-license target rows: 174
- Pointer-only target rows: 72
- Current source-row deficit total: 246
- Current pointer-only candidates: 81
- Completion claim allowed: false

## Acquisition Policy

| Policy | Rule |
| --- | --- |
| row_selection_rule | Select new distinct upstream rows not already represented in the pilot or scaled public package. |
| review_rule | Every acquired row must produce reviewer workbooks and pass double review before gold promotion. |
| packaging_rule | Known-license rows may include text with attribution; unknown-license rows must remain pointer-only until clearance. |
| dedupe_rule | Do not count multiple adversarial transforms from one source row toward the source-row target. |

## Acquisition Batches

| Batch | Category | Dataset | License | Package policy | Target rows | Review status |
| --- | --- | --- | --- | --- | --- | --- |
| source_acq_001 | multi-hop synthesis | allenai/qasper | cc-by-4.0 | redistributable_known_license_evidence | 14 | source_acquisition_needed_before_paper_claim |
| source_acq_002 | multi-hop synthesis | hotpotqa/hotpot_qa | cc-by-sa-4.0 | redistributable_known_license_evidence | 13 | source_acquisition_needed_before_paper_claim |
| source_acq_003 | stale-vs-current document conflicts | tdiggelm/climate_fever | unknown | pointer_only_until_license_clearance | 24 | source_acquisition_needed_before_paper_claim |
| source_acq_004 | appended document lifecycle changes | allenai/qasper | cc-by-4.0 | redistributable_known_license_evidence | 27 | source_acquisition_needed_before_paper_claim |
| source_acq_005 | table + text reasoning | danwakeem/wikitablequestions-wtq | cc-by-4.0 | redistributable_known_license_evidence | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_006 | table + text reasoning | DongfuJiang/FeTaQA | mit | redistributable_known_license_evidence | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_007 | source authority conflicts | Pavithree/eli5 | unknown | pointer_only_until_license_clearance | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_008 | source authority conflicts | tdiggelm/climate_fever | unknown | pointer_only_until_license_clearance | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_009 | evidence insufficiency / abstention | allenai/qasper | cc-by-4.0 | redistributable_known_license_evidence | 27 | source_acquisition_needed_before_paper_claim |
| source_acq_010 | citation supports fact but not conclusion | allenai/qasper | cc-by-4.0 | redistributable_known_license_evidence | 6 | source_acquisition_needed_before_paper_claim |
| source_acq_011 | citation supports fact but not conclusion | danwakeem/wikitablequestions-wtq | cc-by-4.0 | redistributable_known_license_evidence | 4 | source_acquisition_needed_before_paper_claim |
| source_acq_012 | citation supports fact but not conclusion | DongfuJiang/FeTaQA | mit | redistributable_known_license_evidence | 6 | source_acquisition_needed_before_paper_claim |
| source_acq_013 | citation supports fact but not conclusion | hotpotqa/hotpot_qa | cc-by-sa-4.0 | redistributable_known_license_evidence | 5 | source_acquisition_needed_before_paper_claim |
| source_acq_014 | entity disambiguation | DongfuJiang/FeTaQA | mit | redistributable_known_license_evidence | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_015 | entity disambiguation | hotpotqa/hotpot_qa | cc-by-sa-4.0 | redistributable_known_license_evidence | 12 | source_acquisition_needed_before_paper_claim |
| source_acq_016 | temporal questions: as of date X | tdiggelm/climate_fever | unknown | pointer_only_until_license_clearance | 24 | source_acquisition_needed_before_paper_claim |
| source_acq_017 | cross-document contradiction | hotpotqa/hotpot_qa | cc-by-sa-4.0 | redistributable_known_license_evidence | 24 | source_acquisition_needed_before_paper_claim |
