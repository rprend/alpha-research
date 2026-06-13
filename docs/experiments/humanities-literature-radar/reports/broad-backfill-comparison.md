# Humanities Literature Radar Broad Backfill Comparison

Generated at: 2026-06-12T22:05:04.878Z
Status: broad-backfill-built
Corpus tier: broad-backfill-corpus

## DOAJ OAI Route

- Route: https://doaj.org/oai.article?verb=ListRecords&metadataPrefix=oai_dc&from=<YYYY-MM-DD>&until=<YYYY-MM-DD>
- Source docs: https://doaj.org/docs/oai-pmh/
- Run date: 2026-06-12
- Window: 2020-01-01 through 2026-06-12
- Pages fetched: 100
- Raw records: 30000
- Manifest: `data/raw/doaj-oai/2026-06-12/manifest.json`
- Checkpoint: `data/raw/doaj-oai/2026-06-12/checkpoint.json`
- Resume mode: yes

## Processed Corpus After Relevance Gate

- Deduped works: 7362
- Works dated 2024-present: 5025
- Quantitative/computational humanities candidates: 1997
- DOAJ OAI processed records: 5418

## Baseline Comparison

- Baseline: `docs/experiments/humanities-literature-radar/data/interim/baselines/works-before-doaj-oai-100-page-2026-06-12.json`
- Current works: 7362
- New works versus baseline: 2929
- Genuinely new publications: 2514
- Newly discovered old records: 415
- Monitor run: `runs/2026-06-12/result.json`

## Quality Gate

- DOAJ OAI records require relevance_score >= 1 before entering processed works.
- The OAI route uses source-level pagination rather than keyword search, so public field claims must keep source-coverage and relevance-gate caveats attached.
- Representative DOAJ OAI records still need manual audit before stronger field claims.

## Next Actions

- Continue the DOAJ OAI harvest with --resume=true beyond the current page budget if a fuller source harvest is needed.
- Manually audit representative DOAJ OAI records before publishing examples.
- Rebuild, sync, and remotely verify the Alpha Research dataset bundle after promotion.
- Expand Knowledge Commons Works, OSF/SocArXiv, and NBER routes to reduce source-family imbalance.
