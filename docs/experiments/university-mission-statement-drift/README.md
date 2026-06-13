# University Mission Statement Drift

First article track for the Cultural Observatory program.

## Study Question

How do universities describe their purpose today, and how can that language be tracked longitudinally over time?

The long-term essay asks whether university self-description has shifted from older civic, truth-seeking, religious, or liberal-education language toward innovation, impact, global leadership, entrepreneurship, excellence, inclusion, and career language.

## V1 Scope

This v1 implementation collects current public mission/about pages for a small institution seed list and produces:

- a source manifest
- extracted plain text
- term counts for editorially relevant language families
- snippets around high-signal terms
- a first public-draft scaffold
- a Wayback historical layer with merge-safe snapshot fetching
- an audit packet for quote/snippet review

The current historical layer is source-work, not publication copy. It has enough snapshot count for the first longitudinal gate, but one short archived page still needs replacement or manual exclusion before publication-level trend claims.

## Runbook

```bash
node docs/experiments/university-mission-statement-drift/scripts/fetch-current-pages.mjs
node docs/experiments/university-mission-statement-drift/scripts/discover-wayback-targets.mjs --years=2000,2005,2010,2015,2020
node docs/experiments/university-mission-statement-drift/scripts/fetch-wayback-snapshots.mjs --years=2000,2005,2010,2015,2020
node docs/experiments/university-mission-statement-drift/scripts/fetch-wayback-snapshots.mjs --targets=wayback-historical-targets.json --years=2003,2004,2005,2007,2008
node docs/experiments/university-mission-statement-drift/scripts/fetch-exact-wayback-snapshots.mjs
node docs/experiments/university-mission-statement-drift/scripts/build-report.mjs
node docs/experiments/university-mission-statement-drift/scripts/build-audit-packet.mjs
node docs/experiments/university-mission-statement-drift/scripts/build-publication-handoff.mjs
node docs/experiments/university-mission-statement-drift/scripts/check-readiness.mjs
node docs/experiments/university-mission-statement-drift/scripts/probe-second-layer-sources.mjs --strict
node docs/experiments/university-mission-statement-drift/scripts/fetch-second-layer-wayback-snapshots.mjs --targets=second-layer-wayback-targets.json --years=2015,2020 --max-snapshots=12 --resume=true
node docs/experiments/university-mission-statement-drift/scripts/build-second-layer-corpus.mjs
```

`fetch-wayback-snapshots.mjs` preserves existing snapshots by default and updates the manifest from all local snapshot metadata. Use `--clean=true` only when intentionally replacing the run directory.

Outputs:

- `data/raw/current-pages/YYYY-MM-DD/`
- `data/raw/wayback-discovery/YYYY-MM-DD/`
- `data/raw/wayback-snapshots/YYYY-MM-DD/`
- `config/wayback-historical-targets.json`
- `config/wayback-exact-snapshots.json`
- `data/processed/pages.json`
- `data/processed/term-counts.csv`
- `data/processed/page-term-counts.csv`
- `data/processed/term-family-by-year.csv`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/audit-packet.md`
- `reports/audit-packet.csv`
- `reports/audit-packet.json`
- `reports/publication-handoff.md`
- `reports/publication-handoff.json`
- `reports/readiness.md`
- `reports/readiness.json`
- `data/raw/second-layer-sources/YYYY-MM-DD/`
- `data/raw/second-layer-wayback/YYYY-MM-DD/`
- `data/processed/second-layer-pages.json`
- `data/processed/second-layer-page-term-counts.csv`
- `data/processed/second-layer-term-family-by-genre.csv`
- `data/processed/second-layer-term-family-by-source-layer-year.csv`
- `reports/second-layer-source-inventory.md`
- `reports/second-layer-corpus-readiness.md`

## Second-Layer Historical Probe

The current second-layer corpus contains 25 pages:

- 21 current institutional pages across catalog, strategic-plan, president-message, and commencement-speech genres
- 4 Wayback historical snapshots across catalog and president-message genres
- source-layer status: `historical-source-probed`
- corpus tier: `longitudinal-source-probe`

Historical second-layer snapshots are intentionally source-layered. Public claims should not compare catalogs, strategic plans, president messages, and commencement speeches as one stable genre. The next coverage step is to expand curated historical routes for strategic-plan and commencement-speech pages, then manually quote-review the historical records before joining second-layer outputs into the main readiness gate.
