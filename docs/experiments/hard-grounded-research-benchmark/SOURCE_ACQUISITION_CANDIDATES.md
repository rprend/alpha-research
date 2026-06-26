# Source Acquisition Candidates

This generated artifact turns fetched Hugging Face source rows into review-pending hard-grounded task candidates. It is not gold data: every candidate still requires task editing, reviewer workbook export, two independent reviews, and adjudication before it can support paper claims.

## Summary

- Source acquisition candidates ready: true
- Candidates: 246
- Categories: 10
- Source datasets: 6
- Known-license candidates: 174
- Pointer-only candidates: 72
- Required review rows: 492
- Completion claim allowed: false

## Category Summary

| Category | Candidates | Datasets | Known-license | Pointer-only |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | 27 | allenai/qasper<br>hotpotqa/hotpot_qa | 27 | 0 |
| stale-vs-current document conflicts | 24 | tdiggelm/climate_fever | 0 | 24 |
| appended document lifecycle changes | 27 | allenai/qasper | 27 | 0 |
| table + text reasoning | 24 | DongfuJiang/FeTaQA<br>danwakeem/wikitablequestions-wtq | 24 | 0 |
| source authority conflicts | 24 | Pavithree/eli5<br>tdiggelm/climate_fever | 0 | 24 |
| evidence insufficiency / abstention | 27 | allenai/qasper | 27 | 0 |
| citation supports fact but not conclusion | 21 | DongfuJiang/FeTaQA<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>hotpotqa/hotpot_qa | 21 | 0 |
| entity disambiguation | 24 | DongfuJiang/FeTaQA<br>hotpotqa/hotpot_qa | 24 | 0 |
| temporal questions: as of date X | 24 | tdiggelm/climate_fever | 0 | 24 |
| cross-document contradiction | 24 | hotpotqa/hotpot_qa | 24 | 0 |

## Required Next Work

1. Convert each question draft into a finalized task with evidence units and expected label.
2. Export the task candidates into reviewer workbooks.
3. Complete two independent reviews and adjudication.
4. Promote only reviewed, agreement-resolved items into gold.
