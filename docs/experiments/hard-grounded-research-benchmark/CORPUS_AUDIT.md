# Hard Grounded Research Corpus Audit

This generated audit makes the corpus-level grounding claim inspectable. It summarizes source datasets, category coverage, source-row diversity, evidence-unit packaging, and pointer-only scope for the pilot and scaled public suites. It does not mark gold review complete.

## Summary

- Corpus audit ready: true
- Categories: 10
- Source Hugging Face datasets: 6
- Dataset coverage per category: 1-5
- Pilot items: 30
- Scaled public items: 270
- Scaled public source rows: 15
- Scaled public evidence units: 891
- Scaled public pointer-only items: 81
- Package policy matches summaries: true

## Suite Scale

| Suite | Items | Categories | Challenge types | Source datasets | Source rows | Evidence units | Pointer-only evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pilot_suite | 30 | 10 | 8 | 5 | 15 | 105 | 0 |

| Suite | Items | Categories | Challenge types | Source datasets | Source rows | Evidence units | Pointer-only evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| scaled_public_suite | 270 | 10 | 2 | 5 | 15 | 891 | 108 |

## Category Coverage

| Category | Datasets | Seed tasks | Dataset ids |
| --- | --- | --- | --- |
| multi-hop synthesis | 3 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 |
| stale-vs-current document conflicts | 1 | 1 | tdiggelm/climate_fever |
| appended document lifecycle changes | 1 | 1 | allenai/qasper |
| table + text reasoning | 2 | 1 | danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA |
| source authority conflicts | 2 | 1 | tdiggelm/climate_fever<br>Pavithree/eli5 |
| evidence insufficiency / abstention | 2 | 1 | allenai/qasper<br>tdiggelm/climate_fever |
| citation supports fact but not conclusion | 5 | 1 | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA<br>Pavithree/eli5 |
| entity disambiguation | 3 | 1 | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA |
| temporal questions: as of date X | 1 | 1 | tdiggelm/climate_fever |
| cross-document contradiction | 2 | 1 | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever |

## Source Datasets

| Dataset | License | Benchmark roles |
| --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | multi-hop synthesis<br>citation supports fact but not conclusion<br>entity disambiguation<br>cross-document contradiction |
| allenai/qasper | cc-by-4.0 | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>appended document lifecycle changes |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| DongfuJiang/FeTaQA | mit | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| tdiggelm/climate_fever | unknown | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| Pavithree/eli5 | unknown | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion |

## Scaled Package Modes

| Package mode | Items |
| --- | --- |
| license_remediated_replacement | 54 |
| pointer_only_unknown_license_evidence | 81 |
| redistributable_known_license_evidence | 135 |

## Scaled Challenge Types

| Challenge type | Items |
| --- | --- |
| adversarial_wrapper | 189 |
| native_row | 81 |

## Scaled Source Dataset Rows

| Dataset | Evidence-bearing items |
| --- | --- |
| allenai/qasper | 135 |
| danwakeem/wikitablequestions-wtq | 81 |
| hotpotqa/hotpot_qa | 162 |
| Pavithree/eli5 | 27 |
| tdiggelm/climate_fever | 81 |

## Package Policy

- Include text only for evidence units whose upstream dataset license is known; include dataset id, title, locator, and text hash for unknown-license evidence.
- Pilot pointer-only items: 15
- Pilot pointer-only evidence units: 18
- Scaled pointer-only evidence units: 108
