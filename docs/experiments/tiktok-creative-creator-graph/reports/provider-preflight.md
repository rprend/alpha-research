# Provider Preflight

Generated: 2026-06-13T03:34:02.646Z

- Provider: apify
- Provider viability: missing_token
- Provider token available: false
- Provider live runs: 0
- Provider zero-yield runs: 0
- Latest provider output rows: n/a
- Selected waves: 10
- Task rows: 20
- Ready tasks: 0
- Blocked tasks: 20
- Requested limit per task: 100
- Estimated result rows: 0
- Estimated cost: $0
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0001

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0001
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Viability | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0001 | graph_0069 | search_index | filmmaker short film editing breakdown | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0001 | category_gap_0030 | category_gap_search | site:tiktok.com/@ "director" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0002 | graph_0083 | search_index | cinematographer lighting breakdown | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0002 | category_gap_0040 | category_gap_search | site:tiktok.com/@ "performer" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0003 | graph_0088 | search_index | sketch comedian character comedy | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0003 | category_gap_0035 | category_gap_search | site:tiktok.com/@ "stand-up" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0004 | graph_0081 | search_index | vfx artist animation blender | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0004 | category_gap_0033 | category_gap_search | site:tiktok.com/@ "standup comedian" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0005 | graph_0068 | tiktok_hashtag_export | filmmaker | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0005 | category_gap_0034 | category_gap_search | site:tiktok.com/@ "standup" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0006 | graph_0073 | tiktok_hashtag_export | actor | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0006 | search_0004 | search_index | site:tiktok.com/@ comedian | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0007 | graph_0077 | tiktok_hashtag_export | animation | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0007 | hashtag_0017 | tiktok_hashtag_export | standupcomedy | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0008 | graph_0084 | tiktok_hashtag_export | cinematography | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0008 | graph_0092 | search_index | mentioned by @ani.motionlab | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0009 | graph_0070 | tiktok_hashtag_export | shortfilm | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0009 | graph_0067 | tiktok_hashtag_export | bts | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0010 | graph_0074 | tiktok_hashtag_export | sketchcomedy | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0010 | category_gap_0060 | category_gap_search | site:tiktok.com/@ "animation" | apify/google-search-scraper | false | missing_token | 0 | $0 |

Full preflight: `data/processed/provider_preflight.csv`
