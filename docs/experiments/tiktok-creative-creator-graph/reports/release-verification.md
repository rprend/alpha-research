# Release Verification

Generated: 2026-06-12T22:10:27.488Z

Complete: true

## Counts

- Useful creators: 7
- Benchmark creators: 1
- Rejected creators: 2
- All scored creators: 529

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
- sha256:data/release/useful_creators.jsonl: pass (expected 14aeee4c2f05fcab50fda2ede3c7aee978c400b1933f97634a583e453e4fe539, actual 14aeee4c2f05fcab50fda2ede3c7aee978c400b1933f97634a583e453e4fe539)
- row_count:data/release/useful_creators.jsonl: pass (expected 7, actual 7)
- sha256:data/release/useful_creators.csv: pass (expected fe254e84814b2de4b109e8ee2782f8a968473c6b24a753962b67abe22a08c848, actual fe254e84814b2de4b109e8ee2782f8a968473c6b24a753962b67abe22a08c848)
- row_count:data/release/useful_creators.csv: pass (expected 7, actual 7)
- sha256:data/release/benchmark_creators.jsonl: pass (expected c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0, actual c07bcbc935eb729cc05652de365022fe203c7f1d0a7af6c5efc2a95ce11788a0)
- row_count:data/release/benchmark_creators.jsonl: pass (expected 1, actual 1)
- sha256:data/release/benchmark_creators.csv: pass (expected 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa, actual 6012d3df1e55af70b070b2cba86d1ac72b1dc2677d4c8f0a871466884499f0aa)
- row_count:data/release/benchmark_creators.csv: pass (expected 1, actual 1)
- sha256:data/release/rejected_creators.jsonl: pass (expected 7c1a06e0f0171073ba37a91e502952fc88da82b8649f72faceb4fe59345f0d38, actual 7c1a06e0f0171073ba37a91e502952fc88da82b8649f72faceb4fe59345f0d38)
- row_count:data/release/rejected_creators.jsonl: pass (expected 2, actual 2)
- sha256:data/release/rejected_creators.csv: pass (expected 7fd6e7a144fce69ce1ad307da51c0e901d853b64d43b021c034367ad23972e17, actual 7fd6e7a144fce69ce1ad307da51c0e901d853b64d43b021c034367ad23972e17)
- row_count:data/release/rejected_creators.csv: pass (expected 2, actual 2)
- sha256:data/release/review_queue.csv: pass (expected 40f6fa179dd89026533cc85743877aca1c53a35b0b504ee41710b520d59eea23, actual 40f6fa179dd89026533cc85743877aca1c53a35b0b504ee41710b520d59eea23)
- row_count:data/release/review_queue.csv: pass (expected 525, actual 525)
- sha256:data/release/all_scored_creators.csv: pass (expected 8e091a6fdeb826f65fe436c266d0854f7837182a479734e444b2ccb6eaae1cfe, actual 8e091a6fdeb826f65fe436c266d0854f7837182a479734e444b2ccb6eaae1cfe)
- row_count:data/release/all_scored_creators.csv: pass (expected 529, actual 529)
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
