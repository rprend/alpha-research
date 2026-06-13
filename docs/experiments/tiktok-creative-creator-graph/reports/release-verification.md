# Release Verification

Generated: 2026-06-13T14:58:37.383Z

Complete: true

## Counts

- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- All scored creators: 39580

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
- sha256:data/release/useful_creators.jsonl: pass (expected 1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5, actual 1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5)
- row_count:data/release/useful_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/useful_creators.csv: pass (expected 30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2, actual 30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2)
- row_count:data/release/useful_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/benchmark_creators.jsonl: pass (expected 2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee, actual 2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee)
- row_count:data/release/benchmark_creators.jsonl: pass (expected 1, actual 1)
- sha256:data/release/benchmark_creators.csv: pass (expected 48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd, actual 48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd)
- row_count:data/release/benchmark_creators.csv: pass (expected 1, actual 1)
- sha256:data/release/rejected_creators.jsonl: pass (expected 02a471199fcad5e4dbd162a43bff8843fc464d88f56af47bc6127b66ce9969b5, actual 02a471199fcad5e4dbd162a43bff8843fc464d88f56af47bc6127b66ce9969b5)
- row_count:data/release/rejected_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/rejected_creators.csv: pass (expected ae53a771656bf3c4276566057f2db46d172d691eab57bd392a05ad98213730e6, actual ae53a771656bf3c4276566057f2db46d172d691eab57bd392a05ad98213730e6)
- row_count:data/release/rejected_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/review_queue.csv: pass (expected 9539d2fa2d94950b3a861c6dd41f3b334b695f95cfefe6c39a9d8eaa1eacea23, actual 9539d2fa2d94950b3a861c6dd41f3b334b695f95cfefe6c39a9d8eaa1eacea23)
- row_count:data/release/review_queue.csv: pass (expected 39576, actual 39576)
- sha256:data/release/all_scored_creators.csv: pass (expected dcb95ca08dc576bd77d1349eaf8fbb24e68d02f79d6e0e132ac7b955e2dfc8dd, actual dcb95ca08dc576bd77d1349eaf8fbb24e68d02f79d6e0e132ac7b955e2dfc8dd)
- row_count:data/release/all_scored_creators.csv: pass (expected 39580, actual 39580)
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
- manifest_useful_count: pass (manifest 2, file 2)
- manifest_benchmark_count: pass (manifest 1, file 1)
- manifest_rejected_count: pass (manifest 2, file 2)
