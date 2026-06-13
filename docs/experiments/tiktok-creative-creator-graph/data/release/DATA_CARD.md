# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T14:58:36.643Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39580
- Identities: 38639
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39576

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `02a471199fcad5e4dbd162a43bff8843fc464d88f56af47bc6127b66ce9969b5`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `ae53a771656bf3c4276566057f2db46d172d691eab57bd392a05ad98213730e6`
- `data/release/review_queue.csv`: 39576 rows, sha256 `9539d2fa2d94950b3a861c6dd41f3b334b695f95cfefe6c39a9d8eaa1eacea23`
- `data/release/all_scored_creators.csv`: 39580 rows, sha256 `dcb95ca08dc576bd77d1349eaf8fbb24e68d02f79d6e0e132ac7b955e2dfc8dd`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
