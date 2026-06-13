# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T06:07:54.307Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 10837
- Identities: 10684
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 10833

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `808848ec52768df5c1ee51b47ba3ce01668f56edc46203eaf669ca3794cecd0e`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `bef5461041357ac07d327153e6e6b3dbe07900f6a9068a0c890507d429321700`
- `data/release/review_queue.csv`: 10833 rows, sha256 `97b0286aa8172d805ae8e29b3e8ef4153951e773e57905c64cd360fe1a3f7068`
- `data/release/all_scored_creators.csv`: 10837 rows, sha256 `afaac6582c4842fbcd7b3003fa471f099b9a70a64c6406b7b390b2fd5971f4d1`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
