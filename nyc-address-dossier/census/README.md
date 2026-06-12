# Phase 2 census harness — gold-set protocol

Mock-mode harness for 1880–1950 census roster extraction. **No model runs until the gold
gate passes** (house rule: mock first; any paid run needs explicit per-run approval).

## Workflow

1. **Pick pilot pages.** Pilot CD is MN CD10 (Harlem). The corridor's 1950 EDs are already
   identified from NARA's API (2026-06-12) and saved to
   `~/.nyc-address-dossier/data/derived/pilot-eds.json`:
   **31-1612, 31-1613** (W 125th at 5th/Lenox, AD 11) and **31-1970, 31-1975**
   (W 125th at Morningside, AD 13); all 2,445 Manhattan ED descriptions are in
   `nara-mn-eds.json` for extending coverage. Pull those EDs' public-domain page images
   from https://1950census.archives.gov/search/?ed=31-1612 into `fixtures/` (one JSON
   descriptor per page, `image` pointing at the downloaded scan).
2. **Hand-label gold.** Two annotators independently transcribe each page into
   `gold/<page_id>.json` (same schema as fixtures). Adjudicate disagreements; record
   Cohen's κ per field in `gold/KAPPA.md`. Target: ≥ 20 pages, ~500–1,000 person-rows.
3. **Run an extractor.** `--mock` exercises the pipeline with canned output. The real
   extractor is a local VLM (Ollama/MLX) implementing the same contract:
   `{ page_id, rows: [{line, name, relation, age, occupation, address}] }` → `extracted/`.
4. **Score.** `npm run census -- --eval` reports name-level recall/precision per page.
   **Gate: ≥ 95% name recall on gold before extracting beyond the pilot.**

## Schema

See `fixtures/1950-mn-ed31-100-p1.json` — a synthetic fixture (invented names) shaped like
a real 1950 population schedule page descriptor.

## Why names-first

Name recall is the binding metric: a missed person is an unfixable dossier gap, while a
garbled occupation is a correctable annoyance. Address association comes second (column
position + the ED's street list), measured the same way.
