# Provider Preflight

Generated: 2026-06-12T20:48:05.356Z

- Provider: apify
- Selected waves: 10
- Task rows: 20
- Ready tasks: 20
- Blocked tasks: 0
- Requested limit per task: 100
- Estimated result rows: 2000
- Estimated cost: $5
- Budget: $25
- Within budget: true
- Next wave: scale_wave_0004

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0004
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0004 | category_gap_0049 | category_gap_search | site:tiktok.com/@ "filmmaker" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0004 | category_gap_0038 | category_gap_search | site:tiktok.com/@ "actor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0005 | category_gap_0050 | category_gap_search | site:tiktok.com/@ "shortfilm" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0005 | category_gap_0039 | category_gap_search | site:tiktok.com/@ "actress" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0006 | search_0001 | search_index | site:tiktok.com/@ filmmaker | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0006 | category_gap_0040 | category_gap_search | site:tiktok.com/@ "performer" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0007 | search_0002 | search_index | site:tiktok.com/@ "short film" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0007 | hashtag_0017 | tiktok_hashtag_export | standupcomedy | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0008 | category_gap_0051 | category_gap_search | site:tiktok.com/@ "sketch comedian" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0008 | search_0004 | search_index | site:tiktok.com/@ comedian | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0009 | category_gap_0052 | category_gap_search | site:tiktok.com/@ "sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0009 | category_gap_0054 | category_gap_search | site:tiktok.com/@ "cinematographer" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | category_gap_0053 | category_gap_search | site:tiktok.com/@ "comedy sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | category_gap_0055 | category_gap_search | site:tiktok.com/@ "dp" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0011 | search_0003 | search_index | site:tiktok.com/@ "sketch comedy" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0011 | category_gap_0056 | category_gap_search | site:tiktok.com/@ "dop" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | search_0008 | search_index | site:tiktok.com/@ actor "sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | category_gap_0057 | category_gap_search | site:tiktok.com/@ "vfx animation" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | category_gap_0028 | category_gap_search | site:tiktok.com/@ "editor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | category_gap_0058 | category_gap_search | site:tiktok.com/@ "vfx" | apify/google-search-scraper | true | 100 | $0.25 |

Full preflight: `data/processed/provider_preflight.csv`
