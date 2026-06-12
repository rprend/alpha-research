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

Historical snapshots should be added next through archived pages, catalogs, strategic plans, and hand-audited source timelines.

## Runbook

```bash
node docs/experiments/university-mission-statement-drift/scripts/fetch-current-pages.mjs
node docs/experiments/university-mission-statement-drift/scripts/fetch-wayback-snapshots.mjs --years=2000,2005,2010,2015,2020
node docs/experiments/university-mission-statement-drift/scripts/build-report.mjs
```

Outputs:

- `data/raw/current-pages/YYYY-MM-DD/`
- `data/raw/wayback-snapshots/YYYY-MM-DD/`
- `data/processed/pages.json`
- `data/processed/term-counts.csv`
- `data/processed/page-term-counts.csv`
- `data/processed/term-family-by-year.csv`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
