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

Run the full local workflow:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

Build acquisition batches from discovery queries and the latest expansion queue:

```bash
pnpm run tiktok:creative:acquisition
```

Build the ranked candidate frontier from acquisition tasks, graph expansion targets, category gaps, and source-yield signals:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-candidate-frontier.mjs
```

Run no-token public editorial list acquisition:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-editorial-list-import.mjs --list-sources
node docs/experiments/tiktok-creative-creator-graph/scripts/run-editorial-list-import.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

The editorial list importer fetches configured public list pages from `config/editorial-list-sources.json`, extracts TikTok account handles from source-local TikTok account fields, writes raw rows to `data/raw/acquisition-results/`, and preserves source URL, source query, rank, target label, provider, execution id, and batch id. It is intended for no-secret seed expansion and provenance capture; it does not emulate the TikTok app. Use `--sources=feedspot_movie_tiktok_2026,feedspot_comedy_tiktok_2026` to run a subset or `--source-config=path/to/sources.json` to test a new registry.

Execute or dry-run provider acquisition batches:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=5
```

Live provider execution requires a specific wave, a passing provider preflight, an available `APIFY_TOKEN`, and explicit confirmation:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --wave=0004 --max-tasks=8
```

The runner loads `~/.codex/secrets.env` by default before checking provider credentials. If the token is not already available, store it through the hidden-input helper, not chat:

```bash
~/.codex/scripts/ask-secret.sh APIFY_TOKEN ~/.codex/secrets.env "Enter APIFY_TOKEN"
```

The runner writes raw provider output to `data/raw/acquisition-results/`. The Apify adapter covers TikTok hashtag/profile/neighborhood exports plus search-index, category-gap, and cross-platform search tasks.

Normalize search/provider acquisition exports into pipeline imports:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
```

By default, imports write to `data/raw/imports/acquisition-import-YYYY-MM-DD.jsonl`. If that same-day file already exists with different normalized accounts, the importer writes `acquisition-import-YYYY-MM-DD-<content-hash>.jsonl` instead, so a new provider wave cannot overwrite an earlier wave. Reprocessing identical results keeps the existing output path and updates the ledger in place.

Preview a proposed provider/search export before mutating imports or the import wave ledger:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs --preview --input=docs/experiments/tiktok-creative-creator-graph/data/raw/acquisition-results/provider-export.jsonl
```

The preview writes `reports/acquisition-import-preview.json` and `.md` with input rows, handle extraction rate, duplicate pressure, lineage mapping, a 25-row account sample, and a ready-to-import gate. Defaults require at least 75% normalized rows and at most 35% duplicate normalized rows; tune with `--min-normalized-rate=0.8` or `--max-duplicate-rate=0.25` for stricter import waves.

This also updates the acquisition import wave ledger at `data/processed/acquisition_import_waves.jsonl` and `.csv`, including scale-wave, execution, batch, and provider lineage when the exports came from `run-acquisition-batch.mjs`.

Each provider run also appends a durable execution record to `data/processed/acquisition_run_history.jsonl`; the latest run remains available at `reports/acquisition-run.json`. The importer uses this history to map raw provider files back to the wave and task batch that produced them.

Dry runs write the latest `reports/acquisition-run.*` evidence but do not append durable acquisition history unless `--record-history` is passed. This keeps dry-run validation from consuming planned live waves in `data/processed/wave_ledger.*`.

Apply human review decisions:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs
```

Completed reviewer inputs can be either the decision template (`handle,decision,reviewer,notes`) or the full review packet CSV with `reviewer_decision` and `reviewer_notes` filled in. Blank decision rows are skipped and reported in `data/processed/review_blank_decisions.jsonl`.

Analyze which sources and queries produce useful creators:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/analyze-source-yield.mjs
```

Enrich graph expansion targets from useful creators, bio-link adjacency, hashtags, and high-yield sources:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-adjacency-expansion.mjs
```

Build category coverage and quota gaps:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-category-coverage.mjs
```

Build a reviewer-ready sample from the current queue:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-sample.mjs
```

Build a reviewer packet with evidence fields and an importable decision template:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-packet.mjs
```

Use `--batch-size=250` to generate reviewer batch packet CSVs, per-batch decision templates, and `data/processed/review_packet_batches.csv`. The default batch size is 250 rows.

Build review throughput plan:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-plan.mjs
```

Resolve identities and duplicate risks:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/resolve-identities.mjs
```

Build release exports:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-release-package.mjs
```

Verify release exports:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/verify-release-package.mjs
```

Build scale plan:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-plan.mjs
```

Build executable scale waves:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-waves.mjs
```

Build wave execution ledger:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-wave-ledger.mjs
```

The ledger reconciles provider runs and imported outputs by scale wave id, execution id, and acquisition batch id. After imports, use `data/processed/wave_ledger.csv` to see each wave's status, imported output accounts, import yield ratio, and whether the wave is strong, usable, under-yield, empty, or still planned.

Build provider execution preflight:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-provider-preflight.mjs --max-waves=10 --budget-usd=25
```

Build the live execution manifest from the passing preflight:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-live-run-manifest.mjs
```

Exercise the manifest as a controlled dry-run sequence:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-live-manifest.mjs --max-waves=1 --max-cost-usd=1 --skip-import --skip-rebuild
```

Execute a bounded live sequence only after confirming spend, provider terms, and `APIFY_TOKEN` availability:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-live-manifest.mjs --live --confirm-live --max-waves=5 --max-cost-usd=5
```

Use `--env-file=/path/to/secrets.env` to override the default hidden secrets file.

Build refresh plan:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-refresh-plan.mjs
```

Build publication handoff for control-plane registration:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/build-publication-handoff.mjs
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

## Acquisition Result Import Shape

Raw acquisition exports should land in `data/raw/acquisition-results/`. The importer accepts common search-result and provider-video rows.

Search result rows:

```json
{
  "query": "site:tiktok.com/@ \"short film\"",
  "url": "https://www.tiktok.com/@example",
  "title": "Example Creator on TikTok",
  "snippet": "Short films and production diaries #shortfilm #director"
}
```

Provider video rows:

```json
{
  "authorMeta": {
    "name": "example",
    "nickName": "Example Creator",
    "signature": "Writer/director. Short films.",
    "fans": 7200,
    "heart": 180000
  },
  "webVideoUrl": "https://www.tiktok.com/@example/video/123",
  "text": "Blocking a scene #shortfilm #filmmaker",
  "createTimeISO": "2026-05-30T12:00:00.000Z",
  "playCount": 32000,
  "diggCount": 4100,
  "commentCount": 115,
  "shareCount": 370,
  "hashtags": [{"name": "shortfilm"}],
  "mentions": ["@othercreator"]
}
```

Review decision rows:

```json
{
  "handle": "@example",
  "decision": "excellent_benchmark",
  "reviewer": "reviewer-name",
  "notes": "Strong original short-form film account."
}
```

Supported decisions are `excellent_benchmark`, `keep`, `maybe`, `wrong_category`, `repost_or_aggregator`, and `brand_or_studio`.

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
- `data/processed/category_coverage.jsonl`
- `data/processed/category_coverage.csv`
- `data/processed/acquisition_import_waves.jsonl`
- `data/processed/acquisition_import_waves.csv`
- `data/processed/candidate_frontier.jsonl`
- `data/processed/candidate_frontier.csv`
- `data/processed/acquisition_run_history.jsonl`
- `data/processed/review_sample.jsonl`
- `data/processed/review_sample.csv`
- `data/processed/review_packet_latest.jsonl`
- `data/processed/review_packet_latest.csv`
- `data/processed/review_plan_categories.jsonl`
- `data/processed/review_plan_categories.csv`
- `data/processed/scale_waves.jsonl`
- `data/processed/scale_waves.csv`
- `data/processed/wave_ledger.jsonl`
- `data/processed/wave_ledger.csv`
- `data/processed/provider_preflight.jsonl`
- `data/processed/provider_preflight.csv`
- `data/processed/live_run_manifest.jsonl`
- `data/processed/live_run_manifest.csv`
- `reports/result.json`
- `reports/work.md`
- `reports/readiness.md`
- `reports/readiness.json`
- `reports/acquisition-batches.md`
- `reports/acquisition-batches.json`
- `reports/candidate-frontier.md`
- `reports/candidate-frontier.json`
- `reports/acquisition-run.md`
- `reports/acquisition-run.json`
- `reports/acquisition-import.md`
- `reports/acquisition-import.json`
- `reports/review-decisions.md`
- `reports/review-decisions.json`
- `reports/source-yield.md`
- `reports/source-yield.json`
- `reports/category-coverage.md`
- `reports/category-coverage.json`
- `reports/review-sample.md`
- `reports/review-sample.json`
- `reports/review-packet.md`
- `reports/review-packet.json`
- `reports/review-plan.md`
- `reports/review-plan.json`
- `reports/identity-resolution.md`
- `reports/identity-resolution.json`
- `reports/full-workflow.md`
- `reports/full-workflow.json`
- `reports/release-package.md`
- `reports/release-package.json`
- `reports/release-verification.md`
- `reports/release-verification.json`
- `reports/scale-plan.md`
- `reports/scale-plan.json`
- `reports/scale-waves.md`
- `reports/scale-waves.json`
- `reports/wave-ledger.md`
- `reports/wave-ledger.json`
- `reports/provider-preflight.md`
- `reports/provider-preflight.json`
- `reports/live-run-manifest.md`
- `reports/live-run-manifest.json`
- `reports/scale-campaign-run.md`
- `reports/scale-campaign-run.json`
- `reports/refresh-plan.md`
- `reports/refresh-plan.json`
- `reports/publication-handoff.md`
- `reports/publication-handoff.json`
- `reports/pipeline-run.json`

## Production Acquisition Loop

1. Build and review 1,000-3,000 clean seed accounts.
2. Export public profile and recent-video metadata from allowed sources into `data/raw/imports/`.
3. Run the pipeline.
4. Use `expansion_queue` to resolve mentioned creators and expand from high-usefulness accounts.
5. Run `pnpm run tiktok:creative:acquisition` to turn discovery queries and graph targets into source-specific acquisition tasks.
6. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-candidate-frontier.mjs` to rank and dedupe the next handles, hashtags, and search queries to execute.
7. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=5` to inspect provider execution payloads, or run without `--dry-run` when provider credentials are already available.
8. Put completed search/API/provider exports in `data/raw/acquisition-results/`.
9. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs`.
10. Rerun `pnpm run tiktok:creative`.
11. Put review labels in `data/raw/review-decisions/` and run `node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`.
12. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/analyze-source-yield.mjs` so future acquisition batches prioritize sources and queries that produce useful creators.
13. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-category-coverage.mjs` so the 50k target stays balanced across creator categories.
14. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-sample.mjs` to create the next human QA sample.
15. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-packet.mjs` to create reviewer evidence rows and a decision template.
16. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-plan.mjs` to plan review throughput against the 500-decision target.
17. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/resolve-identities.mjs` so duplicate risks and cross-platform evidence stay auditable.
18. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-release-package.mjs` to generate stable handoff exports.
19. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/verify-release-package.mjs` to validate hashes, row counts, required fields, identity uniqueness, and release/file consistency.
20. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-plan.mjs` to size the next collection and review wave.
21. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-waves.mjs` to create the 250-candidate acquisition wave queue.
22. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-wave-ledger.mjs` to track planned, attempted, imported, and failed waves.
23. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-provider-preflight.mjs --max-waves=10 --budget-usd=25` before live provider execution.
24. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-live-run-manifest.mjs` to create the exact dry-run, live-run, import, and rebuild command queue.
25. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/run-scale-campaign.mjs --max-iterations=10 --waves-per-iteration=1 --max-cost-usd=25` to validate the bounded campaign sequence, or add `--live --confirm-live` after checking budget and provider credentials.
26. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-refresh-plan.mjs` to schedule weekly/monthly/quarterly account refreshes.
27. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/build-publication-handoff.mjs` to generate the control-plane handoff package.
28. Use reviewed accepted/rejected/benchmark outputs to tune sources and scoring.
29. Repeat until `reports/readiness.json` shows at least 50,000 useful accounts.

## Current Limitations

- The included smoke fixture proves workflow mechanics, not dataset scale.
- The pipeline does not scrape TikTok itself. It ingests public metadata exports from approved tools or manual discovery.
- Classification is rubric-based and should be upgraded with model-assisted labeling after enough human QA examples exist.
- Completion of the full objective requires production imports from TikTok public web/search-index/provider exports.
