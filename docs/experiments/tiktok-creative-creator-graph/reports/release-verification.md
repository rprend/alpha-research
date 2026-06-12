# Release Verification

Generated: 2026-06-12T22:01:01.829Z

Complete: true

## Counts

- Useful creators: 7
- Benchmark creators: 1
- Rejected creators: 2
- All scored creators: 30

## Checks

- manifest_exists: pass (/Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/tiktok-creative-creator-graph/data/release/manifest.json)
- file_exists:useful_creators.jsonl: pass (data/release/useful_creators.jsonl)
- file_exists:useful_creators.csv: pass (data/release/useful_creators.csv)
- file_exists:benchmark_creators.jsonl: pass (data/release/benchmark_creators.jsonl)
- file_exists:benchmark_creators.csv: pass (data/release/benchmark_creators.csv)
- file_exists:rejected_creators.jsonl: pass (data/release/rejected_creators.jsonl)
- file_exists:rejected_creators.csv: pass (data/release/rejected_creators.csv)
- file_exists:review_queue.csv: pass (data/release/review_queue.csv)
- file_exists:all_scored_creators.csv: pass (data/release/all_scored_creators.csv)
- file_exists:DATA_CARD.md: pass (data/release/DATA_CARD.md)
- sha256:data/release/useful_creators.jsonl: pass (expected 264508176e9be1c30f1af80db9edca295740bcc876be63fff4f016fef0bd706f, actual 264508176e9be1c30f1af80db9edca295740bcc876be63fff4f016fef0bd706f)
- row_count:data/release/useful_creators.jsonl: pass (expected 7, actual 7)
- sha256:data/release/useful_creators.csv: pass (expected 0961bffd27f9b98ca4834b9cffd4e30989af4571f93de0a20abb9f5a9ab802e6, actual 0961bffd27f9b98ca4834b9cffd4e30989af4571f93de0a20abb9f5a9ab802e6)
- row_count:data/release/useful_creators.csv: pass (expected 7, actual 7)
- sha256:data/release/benchmark_creators.jsonl: pass (expected c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0, actual c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0)
- row_count:data/release/benchmark_creators.jsonl: pass (expected 1, actual 1)
- sha256:data/release/benchmark_creators.csv: pass (expected 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa, actual 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa)
- row_count:data/release/benchmark_creators.csv: pass (expected 1, actual 1)
- sha256:data/release/rejected_creators.jsonl: pass (expected 3479b49453fd3124a93afd81ead40b66289e2281a2314f31e0026760d26f0f2e, actual 3479b49453fd3124a93afd81ead40b66289e2281a2314f31e0026760d26f0f2e)
- row_count:data/release/rejected_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/rejected_creators.csv: pass (expected b707f10c3ce0c6928f226957d8b37ebef37ded87c2e832ff9ffa96462380e151, actual b707f10c3ce0c6928f226957d8b37ebef37ded87c2e832ff9ffa96462380e151)
- row_count:data/release/rejected_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/review_queue.csv: pass (expected 18eaec3904f1a36ff1cf83b4fb70ff285556a16d1ccc0b9bca50e4be1767de68, actual 18eaec3904f1a36ff1cf83b4fb70ff285556a16d1ccc0b9bca50e4be1767de68)
- row_count:data/release/review_queue.csv: pass (expected 26, actual 26)
- sha256:data/release/all_scored_creators.csv: pass (expected d352018ada14a9413447d2fb2d567bd8d495e9236f3c8239fe6a49e519066170, actual d352018ada14a9413447d2fb2d567bd8d495e9236f3c8239fe6a49e519066170)
- row_count:data/release/all_scored_creators.csv: pass (expected 30, actual 30)
- required_column:identity_id: pass (all_scored_creators.csv includes identity_id)
- required_column:creator_id: pass (all_scored_creators.csv includes creator_id)
- required_column:handle: pass (all_scored_creators.csv includes handle)
- required_column:profile_url: pass (all_scored_creators.csv includes profile_url)
- required_column:primary_label: pass (all_scored_creators.csv includes primary_label)
- required_column:reviewed_status: pass (all_scored_creators.csv includes reviewed_status)
- required_column:overall_usefulness: pass (all_scored_creators.csv includes overall_usefulness)
- required_column:source_type: pass (all_scored_creators.csv includes source_type)
- required_column:duplicate_risk: pass (all_scored_creators.csv includes duplicate_risk)
- useful_statuses_valid: pass (0 invalid useful rows)
- rejected_statuses_valid: pass (0 invalid rejected rows)
- benchmark_statuses_valid: pass (0 invalid benchmark rows)
- canonical_identity_unique: pass (0 duplicate canonical identities)
- identity_present: pass (0 rows missing identity_id)
- score_present: pass (0 rows missing overall_usefulness)
- manifest_useful_count: pass (manifest 7, file 7)
- manifest_benchmark_count: pass (manifest 1, file 1)
- manifest_rejected_count: pass (manifest 2, file 2)
