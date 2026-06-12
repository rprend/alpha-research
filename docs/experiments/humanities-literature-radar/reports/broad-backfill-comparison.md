# Humanities Literature Radar Broad Backfill Comparison

Generated at: 2026-06-12T21:18:18.097Z
Status: broad-backfill-pilot-built
Corpus tier: pilot-corpus

## DOAJ OAI Route

- Route: https://doaj.org/oai.article?verb=ListRecords&metadataPrefix=oai_dc&from=<YYYY-MM-DD>&until=<YYYY-MM-DD>
- Source docs: https://doaj.org/docs/oai-pmh/
- Run date: 2026-06-12
- Window: 2020-01-01 through 2026-06-12
- Pages fetched: 25
- Raw records: 7500
- Manifest: `data/raw/doaj-oai/2026-06-12/manifest.json`

## Processed Corpus After Relevance Gate

- Deduped works: 4434
- Works dated 2024-present: 2512
- Quantitative/computational humanities candidates: 965
- DOAJ OAI processed records: 2485

## Baseline Comparison

- Current works: 4434
- New works versus v1 baseline: 2483
- Genuinely new publications: 1357
- Newly discovered old records: 1126
- Monitor run: `runs/2026-06-12/result.json`

## Quality Gate

- DOAJ OAI records require relevance_score >= 1 before entering processed works.
- This is a broad DOAJ route pilot, not a full DOAJ harvest. Public field claims should keep source coverage caveats until the full OAI harvest and manual representative-work audit are complete.

## Next Actions

- Run the DOAJ OAI harvester with a larger or uncapped page budget for the full 2020-present harvest.
- Add a resume token/checkpoint mode before long harvests.
- Manually audit representative DOAJ OAI works after the full harvest.
- Promote the refreshed dataset bundle and run a remote Alpha Research proof after promotion.
