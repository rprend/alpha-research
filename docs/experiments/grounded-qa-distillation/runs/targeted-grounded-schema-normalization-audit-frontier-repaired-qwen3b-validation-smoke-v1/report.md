# Targeted Grounded Schema Normalization Audit

Generated: 2026-06-29T05:41:20.799Z

Status: `schema_normalization_fails_broad_validation`

| Metric | Value |
| --- | ---: |
| Examples | 70 |
| Original contract correct | 8.6% |
| Normalized contract correct | 30.0% |
| Original evidence-first valid | 17.1% |
| Normalized evidence-first valid | 62.9% |
| Answer type accuracy | 48.6% |
| Citation-set exact | 64.3% |

Decision: Do not judge or promote this broad normalized Qwen surface. Generate a matched train-side Qwen repair/hybrid candidate surface if using Prime, then train a leakage-safe router that can decide when the Qwen candidate helps.
