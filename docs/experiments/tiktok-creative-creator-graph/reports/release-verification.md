# Release Verification

Generated: 2026-06-13T15:58:15.966Z

Complete: true

## Counts

- Useful creators: 502
- Benchmark creators: 501
- Rejected creators: 2
- All scored creators: 78420

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
- sha256:data/release/useful_creators.jsonl: pass (expected 0e9a5295db1e94b01a6d6dc5f703725d929a76d28ba89ad2ada7deeaf437c2ef, actual 0e9a5295db1e94b01a6d6dc5f703725d929a76d28ba89ad2ada7deeaf437c2ef)
- row_count:data/release/useful_creators.jsonl: pass (expected 502, actual 502)
- sha256:data/release/useful_creators.csv: pass (expected 0a81ea6f94b647061392727b18ecba67736e6582385ddc89def935bcd0e31670, actual 0a81ea6f94b647061392727b18ecba67736e6582385ddc89def935bcd0e31670)
- row_count:data/release/useful_creators.csv: pass (expected 502, actual 502)
- sha256:data/release/benchmark_creators.jsonl: pass (expected f37cf7af4bdbf0bc29c3ebe673445d28e7d613b795667fccff649138b77dca9b, actual f37cf7af4bdbf0bc29c3ebe673445d28e7d613b795667fccff649138b77dca9b)
- row_count:data/release/benchmark_creators.jsonl: pass (expected 501, actual 501)
- sha256:data/release/benchmark_creators.csv: pass (expected 6e8c94389d9673940ec286bcdd416cb0acce5d56aaf068d53367a2d4ba73324a, actual 6e8c94389d9673940ec286bcdd416cb0acce5d56aaf068d53367a2d4ba73324a)
- row_count:data/release/benchmark_creators.csv: pass (expected 501, actual 501)
- sha256:data/release/rejected_creators.jsonl: pass (expected d896c41e0115f6e8eae8f85bc169e4fa57a74b2576be2a8132774c6366ca1bcf, actual d896c41e0115f6e8eae8f85bc169e4fa57a74b2576be2a8132774c6366ca1bcf)
- row_count:data/release/rejected_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/rejected_creators.csv: pass (expected 0c83ce20a4962775bb82cf8448e802ca5057f11491772f94b984f5c1f2981148, actual 0c83ce20a4962775bb82cf8448e802ca5057f11491772f94b984f5c1f2981148)
- row_count:data/release/rejected_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/review_queue.csv: pass (expected 59c66f42db34659b354a1a57afe6bdebd8db7af537b22149866b1ecd83d992ad, actual 59c66f42db34659b354a1a57afe6bdebd8db7af537b22149866b1ecd83d992ad)
- row_count:data/release/review_queue.csv: pass (expected 77916, actual 77916)
- sha256:data/release/all_scored_creators.csv: pass (expected 7a895b2c84f8fbd03e605180c3e1a66b838e7873b2db01d0476a058a47e95e8c, actual 7a895b2c84f8fbd03e605180c3e1a66b838e7873b2db01d0476a058a47e95e8c)
- row_count:data/release/all_scored_creators.csv: pass (expected 78420, actual 78420)
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
- manifest_useful_count: pass (manifest 502, file 502)
- manifest_benchmark_count: pass (manifest 501, file 501)
- manifest_rejected_count: pass (manifest 2, file 2)
