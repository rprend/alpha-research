# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T07:48:24.885Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39576
- Identities: 38668
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39572

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `a525efd26466177d2a05919c907fd74c6656f3fec4b9215fd21d9595720d799a`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `2d2a1870be7ba7118925548bce655f9bc0b11305b574a03985c50ca901dc052e`
- `data/release/review_queue.csv`: 39572 rows, sha256 `b0103608db124bb71f0463b3ed6b3c5542ebb2b98db1cc41e3fcca8140a74120`
- `data/release/all_scored_creators.csv`: 39576 rows, sha256 `50bf3bbd234753d66b838bb0a42ea4b0c8a036b1a1ffd262bf4a0596726dca84`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
