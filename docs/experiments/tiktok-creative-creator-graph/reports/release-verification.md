# Release Verification

Generated: 2026-06-12T20:14:12.513Z

Complete: true

## Counts

- Useful creators: 6
- Benchmark creators: 1
- Rejected creators: 2
- All scored creators: 9

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
- sha256:data/release/useful_creators.jsonl: pass (expected 4ef7921fc32bb5e698bf57adb734e2fe799a1f86ce213f6061b82c0aa37718c3, actual 4ef7921fc32bb5e698bf57adb734e2fe799a1f86ce213f6061b82c0aa37718c3)
- row_count:data/release/useful_creators.jsonl: pass (expected 6, actual 6)
- sha256:data/release/useful_creators.csv: pass (expected 26227079efb9349eafc5caf7048bbbdde45709bbf7aa924fa42adc4bf7911280, actual 26227079efb9349eafc5caf7048bbbdde45709bbf7aa924fa42adc4bf7911280)
- row_count:data/release/useful_creators.csv: pass (expected 6, actual 6)
- sha256:data/release/benchmark_creators.jsonl: pass (expected c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0, actual c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0)
- row_count:data/release/benchmark_creators.jsonl: pass (expected 1, actual 1)
- sha256:data/release/benchmark_creators.csv: pass (expected 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa, actual 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa)
- row_count:data/release/benchmark_creators.csv: pass (expected 1, actual 1)
- sha256:data/release/rejected_creators.jsonl: pass (expected c13d584c4ba6f1ccaecbc08bcee5f34812e6b9c798106284559a454cb9f8288b, actual c13d584c4ba6f1ccaecbc08bcee5f34812e6b9c798106284559a454cb9f8288b)
- row_count:data/release/rejected_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/rejected_creators.csv: pass (expected ba8b93a338277fa924a32e4601f492734cf7ea0221d02f3f543b14c864056c9b, actual ba8b93a338277fa924a32e4601f492734cf7ea0221d02f3f543b14c864056c9b)
- row_count:data/release/rejected_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/review_queue.csv: pass (expected b6aff5ebb5957cebff3525872da4eb7f2631fdb1cbd9344c4fecdb1ef2e08651, actual b6aff5ebb5957cebff3525872da4eb7f2631fdb1cbd9344c4fecdb1ef2e08651)
- row_count:data/release/review_queue.csv: pass (expected 5, actual 5)
- sha256:data/release/all_scored_creators.csv: pass (expected e57ad8e0b6cc474479fa2d8e72e78982695fba7fba5b0e9e95a547bd0a0f0802, actual e57ad8e0b6cc474479fa2d8e72e78982695fba7fba5b0e9e95a547bd0a0f0802)
- row_count:data/release/all_scored_creators.csv: pass (expected 9, actual 9)
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
- manifest_useful_count: pass (manifest 6, file 6)
- manifest_benchmark_count: pass (manifest 1, file 1)
- manifest_rejected_count: pass (manifest 2, file 2)
