# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T04:25:34.180Z

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
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `d8a02a9272c38ded396da6508f1a42543b92bd2ab354b9420b4141cbc051c7e1`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `910f354f8768150f8873bb1aedc822a2dc3de657fe2698de5f691aaeec5327a3`
- `data/release/review_queue.csv`: 10833 rows, sha256 `a334a42fe64256d2bf82eb66f5960fc1d4f66d13c50263ff7eddc9171b56277f`
- `data/release/all_scored_creators.csv`: 10837 rows, sha256 `8b54b09f2f9efa327feb08f862bcec7c1822d88db52a2df701aa5b4ce5c82dc2`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
