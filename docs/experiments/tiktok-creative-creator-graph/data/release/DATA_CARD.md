# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T06:33:24.984Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 34168
- Identities: 33277
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 34164

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `c0fd81096a9718fd438adb5e5c3bb892b510fa957eac693cf99c8038d8ea5975`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `5b934c008c5b25e50113538ebc1412a13a36b5fe100fd7f41b33bd429f490709`
- `data/release/review_queue.csv`: 34164 rows, sha256 `72b28f6bd3d04d9b793edca01eb030b3d9df5a875215a37a3d7b68c9b88624be`
- `data/release/all_scored_creators.csv`: 34168 rows, sha256 `0fdebabe0d5dca1f6696557f8d704ec8cb7bf3c138ed0b542deb980f57685983`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
