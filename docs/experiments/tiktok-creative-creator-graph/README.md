# TikTok Creative Creator Graph

This experiment implements the `TikTok Creative Creator Graph Plan` as a runnable local dataset pipeline.

The goal is to build a focused dataset of roughly 50,000 useful TikTok-visible creative accounts: filmmakers, directors, cinematographers, editors, VFX and animation creators, sketch comedians, standup comedians, actors, film educators, behind-the-scenes creators, and creative technologists.

This is not an influencer marketing workflow. Audience metrics are weak features. The main objective is to find creators whose public work is worth learning from and to expand the graph through creative adjacency.

## Unit Of Analysis

TikTok-visible creator account.

Each account is scored by:

- category fit
- originality
- creative signal
- recency
- consistency
- depth
- graph value
- cross-platform evidence
- repost risk
- overall usefulness

## Runbook

Run the smoke pipeline against the included fixture:

```bash
pnpm run tiktok:creative:smoke
```

Build acquisition batches from discovery queries and the latest expansion queue:

```bash
pnpm run tiktok:creative:acquisition
```

Check readiness against the full 50k-account target:

```bash
pnpm run tiktok:creative:readiness
```

Run the pipeline against everything in `data/raw/imports/`:

```bash
pnpm run tiktok:creative
```

Run against a specific import:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-pipeline.mjs --input=docs/experiments/tiktok-creative-creator-graph/data/raw/imports/smoke-seeds.jsonl
```

## Accepted Import Shape

Imports can be JSONL, JSON, or CSV. JSONL is preferred.

Minimum account fields:

```json
{
  "handle": "@example",
  "display_name": "Example Creator",
  "bio": "Short films and editing breakdowns.",
  "profile_url": "https://www.tiktok.com/@example",
  "source_type": "manual_seed",
  "source_query": "filmmaker short film",
  "videos": []
}
```

Recommended video fields:

```json
{
  "url": "https://www.tiktok.com/@example/video/123",
  "caption": "Lighting breakdown #cinematography #filmmaker",
  "posted_at": "2026-05-20",
  "view_count": 18000,
  "like_count": 2100,
  "comment_count": 96,
  "share_count": 240,
  "hashtags": ["cinematography", "filmmaker"],
  "mentions": ["@othercreator"],
  "sound_id": "original-1"
}
```

## Outputs

The pipeline writes:

- `data/processed/creator_accounts.jsonl`
- `data/processed/creator_videos.jsonl`
- `data/processed/creator_edges.jsonl`
- `data/processed/creator_sources.jsonl`
- `data/processed/creator_classifications.jsonl`
- `data/processed/creator_scores.jsonl`
- `data/processed/creator_scores.csv`
- `data/processed/review_queue.jsonl`
- `data/processed/review_queue.csv`
- `data/processed/expansion_queue.jsonl`
- `data/processed/expansion_queue.csv`
- `reports/result.json`
- `reports/work.md`
- `reports/readiness.md`
- `reports/readiness.json`
- `reports/acquisition-batches.md`
- `reports/acquisition-batches.json`
- `reports/pipeline-run.json`

## Production Acquisition Loop

1. Build and review 1,000-3,000 clean seed accounts.
2. Export public profile and recent-video metadata from allowed sources into `data/raw/imports/`.
3. Run the pipeline.
4. Use `expansion_queue` to resolve mentioned creators and expand from high-usefulness accounts.
5. Run `pnpm run tiktok:creative:acquisition` to turn discovery queries and graph targets into source-specific acquisition tasks.
6. Use `review_queue` to correct labels, reject aggregators, and mark benchmarks.
7. Re-import new accounts and rerun until `reports/readiness.json` shows at least 50,000 useful accounts.

## Current Limitations

- The included smoke fixture proves workflow mechanics, not dataset scale.
- The pipeline does not scrape TikTok itself. It ingests public metadata exports from approved tools or manual discovery.
- Classification is rubric-based and should be upgraded with model-assisted labeling after enough human QA examples exist.
- Completion of the full objective requires production imports from TikTok public web/search-index/provider exports.
