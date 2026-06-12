# Provider Preflight

Generated: 2026-06-12T21:38:08.922Z

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
- Next wave: scale_wave_0008

Next command:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --max-tasks=8 --priority-max=2 --wave=0008
```

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| scale_wave_0008 | graph_0069 | tiktok_hashtag_export | shortfilm | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0008 | graph_0066 | tiktok_hashtag_export | bts | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0009 | hashtag_0016 | tiktok_hashtag_export | sketchcomedy | clockworks/tiktok-scraper | true | 100 | $0.25 |
| scale_wave_0009 | category_gap_0060 | category_gap_search | site:tiktok.com/@ "animation" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | graph_0070 | cross_platform_search | site:vimeo.com "tiktok.com/@" "filmmaker" | apify/google-search-scraper | true | 100 | $0.25 |
| scale_wave_0010 | category_gap_0054 | category_gap_search | site:tiktok.com/@ "cinematographer" | apify/google-search-scraper | true | 100 | $0.25 |
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

Full preflight: `data/processed/provider_preflight.csv`
