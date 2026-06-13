# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T04:21:03.181Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 10837
- Identities: 10686
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 10833

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `5fe06c6419bf6e37179ae7cb349a726ab557c20fad6236795f0d1913c166c867`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `47abc5e27e31ae2ec14bf822cb6acdcf0c2818924caba897c99d7e008b72b054`
- `data/release/review_queue.csv`: 10833 rows, sha256 `bfb88379800392a7cae4ef62b4b025641479535e3ebe5a0c650c3e683e8e0c83`
- `data/release/all_scored_creators.csv`: 10837 rows, sha256 `20356f23c24e290216be87aef13c987c00eed718602132d51ec59e55cb40dfea`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
