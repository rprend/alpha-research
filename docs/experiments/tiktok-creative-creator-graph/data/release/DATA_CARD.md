# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T06:19:01.206Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 15487
- Identities: 15283
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 15483

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `fd36dea7f8ef5362521e20aa63925d52eb8503fa5139a11645c0b564d4fee8ea`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `939b1739e2caa469f47f1f5e48d784c04246523fcad7074f80b119676fdf7c2c`
- `data/release/review_queue.csv`: 15483 rows, sha256 `897f8374e7339795e7f5debda7a992e59e921c43084c8a3b7b1d19bae5c4d691`
- `data/release/all_scored_creators.csv`: 15487 rows, sha256 `377736d7e8fd2a003887ce7a0dc5636c68885069f2196abc89344314e60638ec`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
