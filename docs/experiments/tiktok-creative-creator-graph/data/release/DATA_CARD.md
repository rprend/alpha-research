# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T11:01:40.541Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39579
- Identities: 38651
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39575

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `d2dad3783247faebba301887dfde8874334de4773634a6a2aada58dafb5cc3ec`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `3b6357eef04df382031dee9d4cb95d773d3964391f5c823b48416573be47deed`
- `data/release/review_queue.csv`: 39575 rows, sha256 `7d15b13bfc016c23b52961a170cd14bd7736bc4da2b54da5656c768153c85db5`
- `data/release/all_scored_creators.csv`: 39579 rows, sha256 `82efb703122fdbeca79457729868de99bac300805869c0dc13c5f7c72f50602d`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
