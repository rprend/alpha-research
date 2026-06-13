# Provider Preflight

Generated: 2026-06-13T11:01:43.154Z

- Provider: public_web
- Provider viability: zero_yield_observed
- Provider token available: true
- Provider live runs: 24
- Provider zero-yield runs: 24
- Latest provider output rows: 0
- Selected waves: 10
- Task rows: 20
- Ready tasks: 20
- Blocked tasks: 0
- Requested limit per task: 100
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0021

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0021
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Viability | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0021 | search_0005 | search_index | site:tiktok.com/@ cinematographer | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0021 | search_0007 | search_index | site:tiktok.com/@ "vfx artist" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0022 | search_0006 | search_index | site:tiktok.com/@ "video editor" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0022 | hashtag_0022 | tiktok_hashtag_export | behindthescenes | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0023 | hashtag_0014 | tiktok_hashtag_export | cinematography | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0023 | category_gap_0052 | category_gap_search | site:tiktok.com/@ "tutorial" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0024 | category_gap_0060 | category_gap_search | site:tiktok.com/@ "on set" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0024 | category_gap_0061 | category_gap_search | site:tiktok.com/@ "actor performer" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0025 | category_gap_0062 | category_gap_search | site:tiktok.com/@ "actor" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0025 | category_gap_0063 | category_gap_search | site:tiktok.com/@ "actress" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0026 | category_gap_0064 | category_gap_search | site:tiktok.com/@ "performer" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0026 | cross_platform_0027 | cross_platform_search | site:imdb.com "tiktok.com/@" "actor" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0027 | category_gap_0051 | category_gap_search | site:tiktok.com/@ "film education" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0027 | category_gap_0049 | category_gap_search | site:tiktok.com/@ "film educator" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0028 | category_gap_0050 | category_gap_search | site:tiktok.com/@ "film school" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0028 | category_gap_0054 | category_gap_search | site:tiktok.com/@ "ai video" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0029 | category_gap_0053 | category_gap_search | site:tiktok.com/@ "creative technologist" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0029 | category_gap_0056 | category_gap_search | site:tiktok.com/@ "pika" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0030 | category_gap_0055 | category_gap_search | site:tiktok.com/@ "runway" | bing_rss | true | zero_yield_observed | 100 | $0.25 |
| scale_wave_0030 | hashtag_0018 | tiktok_hashtag_export | charactercomedy | bing_rss | true | zero_yield_observed | 100 | $0.25 |

Full preflight: `data/processed/provider_preflight.csv`
