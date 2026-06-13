# Live Run Manifest

Generated: 2026-06-13T14:58:39.409Z

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
| 21 | scale_wave_0021 | 2 | $0.5 | 200 | search_index | cinematographer|vfx_animation | site:tiktok.com/@ cinematographer |
| 22 | scale_wave_0022 | 2 | $0.5 | 200 | search_index|tiktok_hashtag_export | editor | site:tiktok.com/@ "video editor" |
| 23 | scale_wave_0023 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | film_educator | cinematography |
| 24 | scale_wave_0024 | 2 | $0.5 | 200 | category_gap_search | behind_the_scenes_creator|actor_performer | site:tiktok.com/@ "on set" |
| 25 | scale_wave_0025 | 2 | $0.5 | 200 | category_gap_search | actor_performer | site:tiktok.com/@ "actor" |
| 26 | scale_wave_0026 | 2 | $0.5 | 200 | category_gap_search|cross_platform_search | actor_performer | site:tiktok.com/@ "performer" |
| 27 | scale_wave_0027 | 2 | $0.5 | 200 | category_gap_search | film_educator | site:tiktok.com/@ "film education" |
| 28 | scale_wave_0028 | 2 | $0.5 | 200 | category_gap_search | film_educator|creative_technologist | site:tiktok.com/@ "film school" |
| 29 | scale_wave_0029 | 2 | $0.5 | 200 | category_gap_search | creative_technologist | site:tiktok.com/@ "creative technologist" |
| 30 | scale_wave_0030 | 2 | $0.5 | 200 | category_gap_search|tiktok_hashtag_export | creative_technologist | site:tiktok.com/@ "runway" |

Queue: `data/processed/live_run_manifest.csv`
