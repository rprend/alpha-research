# Hard Grounded Research Source Diversity Plan

This generated plan turns the current corpus-audit limitation into a concrete expansion target. It is not a gold-data claim: it specifies how many additional distinct source rows are needed before the benchmark can support large-corpus category-level claims.

## Summary

- Source diversity plan ready: true
- Categories: 10
- Scaled public items: 270
- Current distinct source rows: 15
- Target distinct source rows/category: 30
- Target distinct source rows total: 300
- Source-row deficit total: 246
- Category source targets met: 0/10
- Dataset targets met: 7/10
- Known-license source datasets: 4
- Unknown-license source datasets: 2
- Completion claim allowed: false

## Acquisition Policy

| Policy | Rule | Current evidence |
| --- | --- | --- |
| prefer_known_license_sources | Prefer additional rows from known-license Hugging Face datasets before using unknown-license sources. | 4/6 current source datasets have known licenses. |
| preserve_pointer_only_fallback | If an unknown-license source is necessary for a construct, package only pointers, locators, hashes, and transforms until clearance is explicit. | 81 pointer-only candidates remain in the public package clearance view. |
| avoid_seed_row_cloning | Final category claims require distinct source rows, not multiple transformed copies of the same seed row. | 270 scaled items currently derive from 15 source rows. |

## Category Source Plan

| Category | Scaled items | Current rows | Target rows | Row deficit | Current datasets | Candidate datasets | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 27 | 3 | 30 | 27 | hotpotqa/hotpot_qa | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | sample_27_additional_distinct_rows_before_final_category_claim |
| stale-vs-current document conflicts | 27 | 6 | 30 | 24 | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | tdiggelm/climate_fever | sample_24_additional_distinct_rows_before_final_category_claim |
| appended document lifecycle changes | 27 | 3 | 30 | 27 | allenai/qasper | allenai/qasper | sample_27_additional_distinct_rows_before_final_category_claim |
| table + text reasoning | 27 | 6 | 30 | 24 | allenai/qasper<br>danwakeem/wikitablequestions-wtq | danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | sample_24_additional_distinct_rows_before_final_category_claim |
| source authority conflicts | 27 | 6 | 30 | 24 | Pavithree/eli5<br>tdiggelm/climate_fever | tdiggelm/climate_fever<br>Pavithree/eli5 | sample_24_additional_distinct_rows_before_final_category_claim |
| evidence insufficiency / abstention | 27 | 3 | 30 | 27 | allenai/qasper | allenai/qasper<br>tdiggelm/climate_fever | sample_27_additional_distinct_rows_before_final_category_claim |
| citation supports fact but not conclusion | 27 | 9 | 30 | 21 | allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>hotpotqa/hotpot_qa | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA<br>Pavithree/eli5 | sample_21_additional_distinct_rows_before_final_category_claim |
| entity disambiguation | 27 | 6 | 30 | 24 | danwakeem/wikitablequestions-wtq<br>hotpotqa/hotpot_qa | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | sample_24_additional_distinct_rows_before_final_category_claim |
| temporal questions: as of date X | 27 | 6 | 30 | 24 | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | tdiggelm/climate_fever | sample_24_additional_distinct_rows_before_final_category_claim |
| cross-document contradiction | 27 | 6 | 30 | 24 | allenai/qasper<br>hotpotqa/hotpot_qa | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | sample_24_additional_distinct_rows_before_final_category_claim |
