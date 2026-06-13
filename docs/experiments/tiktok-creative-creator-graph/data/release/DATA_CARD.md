# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T07:15:51.302Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39570
- Identities: 38667
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39566

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `71b10ab1e2e2d3294b188f38761a64012eddac6d132cac4eaf09248d95e6577a`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `89b3ab4a6b7731751a634cbe42602ff96448e282bd17cb9dbb09658ef5e4b60a`
- `data/release/review_queue.csv`: 39566 rows, sha256 `379f9c3ba91b5ac517db1bf66be2f3fece8fd0e30b2d5b02821bd6812ff49189`
- `data/release/all_scored_creators.csv`: 39570 rows, sha256 `bb2446d0fc3873b6f302aae8283f4b802ceb03319965e4d791c7fd82887a65b3`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
