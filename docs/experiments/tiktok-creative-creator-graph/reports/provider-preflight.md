# Provider Preflight

Generated: 2026-06-12T21:27:41.603Z

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
- Next wave: scale_wave_0006

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0006
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0006 | search_0006 | search_index | site:tiktok.com/@ "video editor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0006 | search_0002 | search_index | site:tiktok.com/@ "short film" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0007 | hashtag_0016 | tiktok_hashtag_export | sketchcomedy | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0007 | category_gap_0050 | category_gap_search | site:tiktok.com/@ "shortfilm" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0008 | hashtag_0020 | tiktok_hashtag_export | vfxartist | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0008 | category_gap_0051 | category_gap_search | site:tiktok.com/@ "sketch comedian" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0009 | category_gap_0037 | category_gap_search | site:tiktok.com/@ "actor performer" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0009 | search_0003 | search_index | site:tiktok.com/@ "sketch comedy" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | category_gap_0038 | category_gap_search | site:tiktok.com/@ "actor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | category_gap_0052 | category_gap_search | site:tiktok.com/@ "sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0011 | category_gap_0039 | category_gap_search | site:tiktok.com/@ "actress" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0011 | category_gap_0057 | category_gap_search | site:tiktok.com/@ "vfx animation" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | category_gap_0036 | category_gap_search | site:tiktok.com/@ "comedian" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | search_0007 | search_index | site:tiktok.com/@ "vfx artist" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | category_gap_0032 | category_gap_search | site:tiktok.com/@ "commercial director" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | category_gap_0058 | category_gap_search | site:tiktok.com/@ "vfx" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0014 | category_gap_0031 | category_gap_search | site:tiktok.com/@ "directed by" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0014 | category_gap_0059 | category_gap_search | site:tiktok.com/@ "visual effects" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0015 | category_gap_0030 | category_gap_search | site:tiktok.com/@ "director" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0015 | search_0008 | search_index | site:tiktok.com/@ actor "sketch" | apify/google-search-scraper | true | 100 | $0.25 |

Full preflight: `data/processed/provider_preflight.csv`
