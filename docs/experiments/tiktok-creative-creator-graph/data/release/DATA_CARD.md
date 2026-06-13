# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T05:51:19.909Z

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
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `1a840f0e649ff750e077aa1d2a7ee37fa878b2cd3d5599685580a72b489d07d9`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `921a432a15c1095187c3cea6ecd5f3f44b7d682d09c0660d62b7b58d4dc0d559`
- `data/release/review_queue.csv`: 10833 rows, sha256 `8ceef927feaa94f992c7009109d5433d68e8e5f3dc9017994ff3c19809cb6247`
- `data/release/all_scored_creators.csv`: 10837 rows, sha256 `b8cda0931bde12e1d8149c9e5529ca7a3f6d3a87d903847d0240c18f6058ce00`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
