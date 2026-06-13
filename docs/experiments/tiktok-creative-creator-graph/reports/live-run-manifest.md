# Live Run Manifest

Generated: 2026-06-13T15:58:18.372Z

- Provider: public_web
- Provider viability: zero_yield_observed
- Provider token available: true
- Provider zero-yield runs: 24
- Runnable waves: 10
- Blocked waves: 0
- Task rows: 20
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0021

## Next Commands

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --provider=public_web --dry-run --max-tasks=2 --priority-max=2 --wave=21
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --provider=public_web --live --confirm-live --max-tasks=2 --priority-max=2 --wave=21
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 21 | scale_wave_0021 | 2 | $0.5 | 200 | cross_platform_search|category_gap_search | actor_performer|film_educator | site:imdb.com "tiktok.com/@" "actor" |
| 22 | scale_wave_0022 | 2 | $0.5 | 200 | category_gap_search | film_educator | site:tiktok.com/@ "film educator" |
| 23 | scale_wave_0023 | 2 | $0.5 | 200 | category_gap_search | creative_technologist | site:tiktok.com/@ "ai video" |
| 24 | scale_wave_0024 | 2 | $0.5 | 200 | category_gap_search | creative_technologist | site:tiktok.com/@ "pika" |
| 25 | scale_wave_0025 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | charactercomedy |
| 26 | scale_wave_0026 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | filmtok |
| 27 | scale_wave_0027 | 2 | $0.5 | 200 | search_index|category_gap_search | behind_the_scenes_creator | site:tiktok.com/@ "film student" |
| 28 | scale_wave_0028 | 2 | $0.5 | 200 | category_gap_search | behind_the_scenes_creator | site:tiktok.com/@ "behind the scenes" |
| 29 | scale_wave_0029 | 2 | $0.5 | 200 | category_gap_search | filmmaker | site:tiktok.com/@ "filmmaker" |
| 30 | scale_wave_0030 | 2 | $0.5 | 200 | tiktok_hashtag_export|cross_platform_search | filmmaker | filmmaker |

Queue: `data/processed/live_run_manifest.csv`
