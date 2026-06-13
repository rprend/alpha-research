# TikTok Creative Creator Graph Data Card

Generated: 2026-06-13T15:58:14.173Z

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: 78420
- Identities: 75451
- Useful creators: 502
- Benchmark creators: 501
- Rejected creators: 2
- Review queue: 77916

## Files

- `data/release/useful_creators.jsonl`: 502 rows, sha256 `0e9a5295db1e94b01a6d6dc5f703725d929a76d28ba89ad2ada7deeaf437c2ef`
- `data/release/useful_creators.csv`: 502 rows, sha256 `0a81ea6f94b647061392727b18ecba67736e6582385ddc89def935bcd0e31670`
- `data/release/benchmark_creators.jsonl`: 501 rows, sha256 `f37cf7af4bdbf0bc29c3ebe673445d28e7d613b795667fccff649138b77dca9b`
- `data/release/benchmark_creators.csv`: 501 rows, sha256 `6e8c94389d9673940ec286bcdd416cb0acce5d56aaf068d53367a2d4ba73324a`
- `data/release/rejected_creators.jsonl`: 2 rows, sha256 `d896c41e0115f6e8eae8f85bc169e4fa57a74b2576be2a8132774c6366ca1bcf`
- `data/release/rejected_creators.csv`: 2 rows, sha256 `0c83ce20a4962775bb82cf8448e802ca5057f11491772f94b984f5c1f2981148`
- `data/release/review_queue.csv`: 77916 rows, sha256 `59c66f42db34659b354a1a57afe6bdebd8db7af537b22149866b1ecd83d992ad`
- `data/release/all_scored_creators.csv`: 78420 rows, sha256 `7a895b2c84f8fbd03e605180c3e1a66b838e7873b2db01d0476a058a47e95e8c`

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.

## Source Policy

Collection, release-field, safety, and retention rules are defined in `SOURCE_POLICY.md`. Release exports must not include raw video files, raw comments, private data, source HTML, direct contact details, or provider credentials.
