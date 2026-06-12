# Live Run Manifest

Generated: 2026-06-12T21:45:47.343Z

- Provider: apify
- Runnable waves: 10
- Blocked waves: 0
- Task rows: 20
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0011

## Next Commands

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=2 --priority-max=2 --wave=11
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --max-tasks=2 --priority-max=2 --wave=11
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 11 | scale_wave_0011 | 2 | $0.5 | 200 | category_gap_search | editor|sketch_comedian | site:tiktok.com/@ "editing" |
| 12 | scale_wave_0012 | 2 | $0.5 | 200 | category_gap_search | editor|cinematographer | site:tiktok.com/@ "editor" |
| 13 | scale_wave_0013 | 2 | $0.5 | 200 | search_index|category_gap_search | editor|cinematographer | site:tiktok.com/@ "video editor" |
| 14 | scale_wave_0014 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | vfx_animation|filmmaker | vfxartist |
| 15 | scale_wave_0015 | 2 | $0.5 | 200 | tiktok_hashtag_export|search_index | actor_performer|filmmaker | actor |
| 16 | scale_wave_0016 | 2 | $0.5 | 200 | category_gap_search | actor_performer|filmmaker | site:tiktok.com/@ "actor performer" |
| 17 | scale_wave_0017 | 2 | $0.5 | 200 | category_gap_search | actor_performer|sketch_comedian | site:tiktok.com/@ "actor" |
| 18 | scale_wave_0018 | 2 | $0.5 | 200 | category_gap_search|search_index | actor_performer|sketch_comedian | site:tiktok.com/@ "actress" |
| 19 | scale_wave_0019 | 2 | $0.5 | 200 | category_gap_search | standup_comedian|sketch_comedian | site:tiktok.com/@ "comedian" |
| 20 | scale_wave_0020 | 2 | $0.5 | 200 | category_gap_search | director|vfx_animation | site:tiktok.com/@ "commercial director" |

Queue: `data/processed/live_run_manifest.csv`
