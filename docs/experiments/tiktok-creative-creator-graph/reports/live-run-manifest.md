# Live Run Manifest

Generated: 2026-06-12T21:38:08.957Z

- Provider: apify
- Runnable waves: 10
- Blocked waves: 0
- Task rows: 20
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0008

## Next Commands

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=2 --priority-max=2 --wave=8
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --max-tasks=2 --priority-max=2 --wave=8
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 8 | scale_wave_0008 | 2 | $0.5 | 200 | tiktok_hashtag_export | filmmaker|behind_the_scenes_creator | shortfilm |
| 9 | scale_wave_0009 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | sketch_comedian|vfx_animation | sketchcomedy |
| 10 | scale_wave_0010 | 2 | $0.5 | 200 | cross_platform_search|category_gap_search | filmmaker|cinematographer | site:vimeo.com "tiktok.com/@" "filmmaker" |
| 11 | scale_wave_0011 | 2 | $0.5 | 200 | category_gap_search | editor|sketch_comedian | site:tiktok.com/@ "editing" |
| 12 | scale_wave_0012 | 2 | $0.5 | 200 | category_gap_search | editor|cinematographer | site:tiktok.com/@ "editor" |
| 13 | scale_wave_0013 | 2 | $0.5 | 200 | search_index|category_gap_search | editor|cinematographer | site:tiktok.com/@ "video editor" |
| 14 | scale_wave_0014 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | vfx_animation|filmmaker | vfxartist |
| 15 | scale_wave_0015 | 2 | $0.5 | 200 | tiktok_hashtag_export|search_index | actor_performer|filmmaker | actor |
| 16 | scale_wave_0016 | 2 | $0.5 | 200 | category_gap_search | actor_performer|filmmaker | site:tiktok.com/@ "actor performer" |
| 17 | scale_wave_0017 | 2 | $0.5 | 200 | category_gap_search | actor_performer|sketch_comedian | site:tiktok.com/@ "actor" |

Queue: `data/processed/live_run_manifest.csv`
