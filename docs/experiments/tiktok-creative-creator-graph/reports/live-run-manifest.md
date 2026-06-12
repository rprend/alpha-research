# Live Run Manifest

Generated: 2026-06-12T21:13:56.464Z

- Provider: apify
- Runnable waves: 10
- Blocked waves: 0
- Task rows: 20
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0006

## Next Commands

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=2 --priority-max=2 --wave=6
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --max-tasks=2 --priority-max=2 --wave=6
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 6 | scale_wave_0006 | 2 | $0.5 | 200 | search_index | editor|filmmaker | site:tiktok.com/@ "video editor" |
| 7 | scale_wave_0007 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | sketch_comedian|filmmaker | sketchcomedy |
| 8 | scale_wave_0008 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | vfx_animation|sketch_comedian | vfxartist |
| 9 | scale_wave_0009 | 2 | $0.5 | 200 | category_gap_search|search_index | actor_performer|sketch_comedian | site:tiktok.com/@ "actor performer" |
| 10 | scale_wave_0010 | 2 | $0.5 | 200 | category_gap_search | actor_performer|sketch_comedian | site:tiktok.com/@ "actor" |
| 11 | scale_wave_0011 | 2 | $0.5 | 200 | category_gap_search | actor_performer|vfx_animation | site:tiktok.com/@ "actress" |
| 12 | scale_wave_0012 | 2 | $0.5 | 200 | category_gap_search|search_index | standup_comedian|vfx_animation | site:tiktok.com/@ "comedian" |
| 13 | scale_wave_0013 | 2 | $0.5 | 200 | category_gap_search | director|vfx_animation | site:tiktok.com/@ "commercial director" |
| 14 | scale_wave_0014 | 2 | $0.5 | 200 | category_gap_search | director|vfx_animation | site:tiktok.com/@ "directed by" |
| 15 | scale_wave_0015 | 2 | $0.5 | 200 | category_gap_search|search_index | director|sketch_comedian | site:tiktok.com/@ "director" |

Queue: `data/processed/live_run_manifest.csv`
