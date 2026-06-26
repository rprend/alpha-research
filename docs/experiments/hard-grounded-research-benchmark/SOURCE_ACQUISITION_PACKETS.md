# Hard Grounded Research Source Acquisition Packets

This generated packet set turns the source acquisition manifest into executable JSONL queues. Each row is a target slot for a new distinct Hugging Face source row. These packets do not contain new upstream text and do not create reviewed gold labels.

## Summary

- Source acquisition packets ready: true
- Packet count: 15
- Target new distinct source rows: 246
- Source datasets covered: 5
- Categories covered: 10
- Completion claim allowed: false

## Packets

| Batch | Category | Dataset | Rows | Packet path | Excluded existing rows | Package policy |
| --- | --- | --- | --- | --- | --- | --- |
| source_acq_001 | multi-hop synthesis | allenai/qasper | 14 | generated/source-acquisition-packets/source_acq_001.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_002 | multi-hop synthesis | hotpotqa/hotpot_qa | 13 | generated/source-acquisition-packets/source_acq_002.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_003 | stale-vs-current document conflicts | tdiggelm/climate_fever | 24 | generated/source-acquisition-packets/source_acq_003.jsonl | 3 | pointer_only_until_license_clearance |
| source_acq_004 | appended document lifecycle changes | allenai/qasper | 27 | generated/source-acquisition-packets/source_acq_004.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_005 | table + text reasoning | danwakeem/wikitablequestions-wtq | 24 | generated/source-acquisition-packets/source_acq_005.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_006 | source authority conflicts | Pavithree/eli5 | 12 | generated/source-acquisition-packets/source_acq_006.jsonl | 3 | pointer_only_until_license_clearance |
| source_acq_007 | source authority conflicts | tdiggelm/climate_fever | 12 | generated/source-acquisition-packets/source_acq_007.jsonl | 3 | pointer_only_until_license_clearance |
| source_acq_008 | evidence insufficiency / abstention | allenai/qasper | 27 | generated/source-acquisition-packets/source_acq_008.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_009 | citation supports fact but not conclusion | allenai/qasper | 7 | generated/source-acquisition-packets/source_acq_009.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_010 | citation supports fact but not conclusion | danwakeem/wikitablequestions-wtq | 7 | generated/source-acquisition-packets/source_acq_010.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_011 | citation supports fact but not conclusion | hotpotqa/hotpot_qa | 7 | generated/source-acquisition-packets/source_acq_011.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_012 | entity disambiguation | danwakeem/wikitablequestions-wtq | 12 | generated/source-acquisition-packets/source_acq_012.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_013 | entity disambiguation | hotpotqa/hotpot_qa | 12 | generated/source-acquisition-packets/source_acq_013.jsonl | 3 | redistributable_known_license_evidence |
| source_acq_014 | temporal questions: as of date X | tdiggelm/climate_fever | 24 | generated/source-acquisition-packets/source_acq_014.jsonl | 3 | pointer_only_until_license_clearance |
| source_acq_015 | cross-document contradiction | hotpotqa/hotpot_qa | 24 | generated/source-acquisition-packets/source_acq_015.jsonl | 3 | redistributable_known_license_evidence |
