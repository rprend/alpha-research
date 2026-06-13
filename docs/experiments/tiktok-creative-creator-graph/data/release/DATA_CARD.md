# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T06:55:03.558Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 39570
- Identities: 38674
- Useful creators: 2
- Benchmark creators: 1
- Rejected creators: 2
- Review queue: 39566

## Files

- `data/release/useful_creators.jsonl`: 2 rows, sha256 `1f3947edfe336364fc2e0da111fcdcac1cb9e049d0a9e477204c2d70759aaaa5`
- `data/release/useful_creators.csv`: 2 rows, sha256 `30a417aaf23eb1eb675ab99db406f39278392b8682a11dda84892363025fc7d2`
- `data/release/benchmark_creators.jsonl`: 1 rows, sha256 `2114aaef99a290160eaafb7ea7872118790ccf426e165af53e17265e339975ee`
- `data/release/benchmark_creators.csv`: 1 rows, sha256 `48de7c6529d99ea818c46fa89363a688065b365664e21c2cd3b3dc9a77b401fd`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `051d7a2afb2c6a4e87928d2b9788e63e4320b629fa87fc6d4d4279ab20d2d218`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `69529d5ac9a6d47cc2edd1fce5037ed365b40713ccfdfb23b2b8696938b17ee5`
- `data/release/review_queue.csv`: 39566 rows, sha256 `2f60adf5ff6059628525c281168914bad16920bc4dd0d45dff6b0fb4a545144f`
- `data/release/all_scored_creators.csv`: 39570 rows, sha256 `79ada9293eec34e9a5adf96e83ab95d905022c5267be3bff3108676c92fa8680`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
