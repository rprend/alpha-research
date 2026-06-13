# Live Run Manifest

Generated: 2026-06-13T07:48:27.013Z

- Provider: public_web
- Provider viability: zero_yield_observed
- Provider token available: true
- Provider zero-yield runs: 4
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
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --provider=public_web --dry-run --max-tasks=2 --priority-max=2 --wave=1
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --provider=public_web --live --confirm-live --max-tasks=2 --priority-max=2 --wave=1
node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
```

## Waves

| Seq | Wave | Tasks | Cost | Rows | Surfaces | Labels | First query |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | scale_wave_0001 | 2 | $0.5 | 200 | tiktok_hashtag_export | filmmaker|behind_the_scenes_creator | filmmaker |
| 2 | scale_wave_0002 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | behindthescenes |
| 3 | scale_wave_0003 | 2 | $0.5 | 200 | tiktok_hashtag_export | behind_the_scenes_creator | apartment |
| 4 | scale_wave_0004 | 2 | $0.5 | 200 | tiktok_hashtag_export | behind_the_scenes_creator | chilis |
| 5 | scale_wave_0005 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | chilistripledipper |
| 6 | scale_wave_0006 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | doctor |
| 7 | scale_wave_0007 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | lgbt |
| 8 | scale_wave_0008 | 2 | $0.5 | 200 | tiktok_hashtag_export | behind_the_scenes_creator | lukadoncic |
| 9 | scale_wave_0009 | 2 | $0.5 | 200 | tiktok_hashtag_export | behind_the_scenes_creator | mavericks |
| 10 | scale_wave_0010 | 2 | $0.5 | 200 | tiktok_hashtag_export |  | organization |

Queue: `data/processed/live_run_manifest.csv`
