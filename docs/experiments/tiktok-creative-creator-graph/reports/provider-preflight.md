# Provider Preflight

Generated: 2026-06-12T21:45:47.300Z

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
- Next wave: scale_wave_0011

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0011
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0011 | category_gap_0029 | category_gap_search | site:tiktok.com/@ "editing" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0011 | category_gap_0053 | category_gap_search | site:tiktok.com/@ "comedy sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | category_gap_0028 | category_gap_search | site:tiktok.com/@ "editor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0012 | category_gap_0056 | category_gap_search | site:tiktok.com/@ "dop" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | search_0006 | search_index | site:tiktok.com/@ "video editor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0013 | category_gap_0055 | category_gap_search | site:tiktok.com/@ "dp" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0014 | hashtag_0020 | tiktok_hashtag_export | vfxartist | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0014 | category_gap_0049 | category_gap_search | site:tiktok.com/@ "filmmaker" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0015 | graph_0082 | tiktok_hashtag_export | actor | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0015 | search_0002 | search_index | site:tiktok.com/@ "short film" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0016 | category_gap_0037 | category_gap_search | site:tiktok.com/@ "actor performer" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0016 | category_gap_0050 | category_gap_search | site:tiktok.com/@ "shortfilm" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0017 | category_gap_0038 | category_gap_search | site:tiktok.com/@ "actor" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0017 | category_gap_0051 | category_gap_search | site:tiktok.com/@ "sketch comedian" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0018 | category_gap_0039 | category_gap_search | site:tiktok.com/@ "actress" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0018 | search_0003 | search_index | site:tiktok.com/@ "sketch comedy" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0019 | category_gap_0036 | category_gap_search | site:tiktok.com/@ "comedian" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0019 | category_gap_0052 | category_gap_search | site:tiktok.com/@ "sketch" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0020 | category_gap_0032 | category_gap_search | site:tiktok.com/@ "commercial director" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0020 | category_gap_0057 | category_gap_search | site:tiktok.com/@ "vfx animation" | apify/google-search-scraper | true | 100 | $0.25 |

Full preflight: `data/processed/provider_preflight.csv`
