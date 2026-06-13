# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T07:25:55.091Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39576
- Identities: 38673
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39572

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `5baa9cf0cbbea03d34228a9ab0293af18c0d54946ad5eca57d7f8e890b3a7db1`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `2ade3679e6d6beebc3023467f3319a2bba0e23cf4ae0d277e8739d4336fb53ed`
- `data/release/review_queue.csv`: 39572 rows, sha256 `86ccdfea661bcff958c81e54b19e14635a986006d77ad70b8d4faab62d5675a5`
- `data/release/all_scored_creators.csv`: 39576 rows, sha256 `1b36d60e4309323691cd2cf020d5112b30aa68abb9082cb94d00791e3a3d6167`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
