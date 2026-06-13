# Live Run Manifest

Generated: 2026-06-13T00:49:47.247Z

- Provider: apify
- Runnable waves: 10
- Blocked waves: 0
- Task rows: 20
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0001

## Next Commands

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=2 --priority-max=2 --wave=1
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --live --confirm-live --max-tasks=2 --priority-max=2 --wave=1
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | scale_wave_0001 | 2 | $0.5 | 200 | search_index|category_gap_search | filmmaker|actor_performer | filmmaker short film editing breakdown |
| 2 | scale_wave_0002 | 2 | $0.5 | 200 | search_index|category_gap_search | cinematographer|standup_comedian | cinematographer lighting breakdown |
| 3 | scale_wave_0003 | 2 | $0.5 | 200 | search_index|category_gap_search | sketch_comedian|standup_comedian | sketch comedian character comedy |
| 4 | scale_wave_0004 | 2 | $0.5 | 200 | search_index|category_gap_search | vfx_animation|standup_comedian | vfx artist animation blender |
| 5 | scale_wave_0005 | 2 | $0.5 | 200 | tiktok_hashtag_export|search_index | vfx_animation|standup_comedian | animation |
| 6 | scale_wave_0006 | 2 | $0.5 | 200 | tiktok_hashtag_export | standup_comedian | cinematography |
| 7 | scale_wave_0007 | 2 | $0.5 | 200 | tiktok_hashtag_export|search_index | filmmaker | filmmaker |
| 8 | scale_wave_0008 | 2 | $0.5 | 200 | tiktok_hashtag_export | filmmaker|behind_the_scenes_creator | shortfilm |
| 9 | scale_wave_0009 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | sketch_comedian|vfx_animation | sketchcomedy |
| 10 | scale_wave_0010 | 2 | $0.5 | 200 | tiktok_hashtag_export|category_gap_search | vfx_animation|cinematographer | blender |

Queue: `data/processed/live_run_manifest.csv`
