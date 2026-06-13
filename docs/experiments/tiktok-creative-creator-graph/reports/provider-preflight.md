# Provider Preflight

Generated: 2026-06-13T06:33:27.370Z

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
| scale_wave_0001 | graph_0067 | tiktok_hashtag_export | filmmaker | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0001 | category_gap_0034 | category_gap_search | site:tiktok.com/@ "sketch comedian" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0002 | graph_0071 | tiktok_hashtag_export | actor | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0002 | search_0003 | search_index | site:tiktok.com/@ "sketch comedy" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0003 | graph_0080 | tiktok_hashtag_export | cinematography | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0003 | category_gap_0035 | category_gap_search | site:tiktok.com/@ "sketch" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0004 | graph_0068 | tiktok_hashtag_export | shortfilm | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0004 | search_0006 | search_index | site:tiktok.com/@ "video editor" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0005 | graph_0072 | tiktok_hashtag_export | sketchcomedy | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0005 | search_0008 | search_index | site:tiktok.com/@ actor "sketch" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0006 | graph_0081 | tiktok_hashtag_export | lighting | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0006 | search_0005 | search_index | site:tiktok.com/@ cinematographer | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0007 | graph_0069 | cross_platform_search | site:vimeo.com "tiktok.com/@" "filmmaker" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0007 | search_0001 | search_index | site:tiktok.com/@ filmmaker | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0008 | graph_0083 | cross_platform_search | site:youtube.com "tiktok.com/@" "sketch comedian" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0008 | category_gap_0030 | category_gap_search | site:tiktok.com/@ "film education" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0009 | graph_0075 | tiktok_hashtag_export | animation | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0009 | category_gap_0028 | category_gap_search | site:tiktok.com/@ "film educator" | apify/google-search-scraper | false | missing_token | 0 | $0 |
| scale_wave_0010 | graph_0076 | tiktok_hashtag_export | blender | clockworks/tiktok-scraper | false | missing_token | 0 | $0 |
| scale_wave_0010 | category_gap_0029 | category_gap_search | site:tiktok.com/@ "film school" | apify/google-search-scraper | false | missing_token | 0 | $0 |

Full preflight: `data/processed/provider_preflight.csv`
