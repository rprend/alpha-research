# Cultural Observatory / Humanities Literature Radar

This experiment implements the first data backbone for a public research program about cultural, intellectual, literary, institutional, and scholarly change over time.

The near-term output is a broad literature-radar corpus and field-map artifact. The larger product goal is a publication pipeline for essays such as:

- what changed in a corpus over time
- the map of a scholarly field
- the moving canon
- AI-assisted research agendas from a source-grounded scout

## Current V1 Scope

- Backfill window: 2020-01-01 through the run date.
- Trend emphasis: 2024-present.
- Initial sources: OpenAlex, Crossref, arXiv, NBER metadata pages, and a public department-page crawl manifest.
- Output folder: `docs/experiments/humanities-literature-radar/reports/`
- Raw source folder: `docs/experiments/humanities-literature-radar/data/raw/`
- Processed folder: `docs/experiments/humanities-literature-radar/data/processed/`

The first implementation is intentionally runnable without secrets or paid APIs. Larger source expansions should preserve the same manifests and processed schema.

## Runbook

Fetch a bounded API smoke corpus:

```bash
node docs/experiments/humanities-literature-radar/scripts/fetch-openalex.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-crossref.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-arxiv.mjs --limit=80
node docs/experiments/humanities-literature-radar/scripts/fetch-nber.mjs --limit=80
```

Normalize and report:

```bash
node docs/experiments/humanities-literature-radar/scripts/normalize-works.mjs
node docs/experiments/humanities-literature-radar/scripts/build-report.mjs
```

The scripts write:

- `data/interim/normalized-works.jsonl`
- `data/processed/works.json`
- `data/processed/works.csv`
- `data/processed/topics.json`
- `data/processed/representative-works.csv`
- `data/processed/quantitative-humanities-opportunities.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`

## Article Standard

Every public essay produced from this experiment should include:

- one sentence thesis
- corpus note
- method note
- 2 to 5 central findings
- 1 to 3 charts or tables
- representative records or excerpts
- limitations
- what to study next

Claims in public drafts must point back to `result.json`, charts, tables, or source records.
