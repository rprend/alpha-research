# Monitor Work Log

Generated at: 2026-06-12T19:48:49.609Z
Run date: 2026-06-12
Baseline: bootstrap-empty-baseline

## Commands

```bash
node docs/experiments/humanities-literature-radar/scripts/build-monitor-run.mjs --run-date=2026-06-12
```

## Inputs

- `data/processed/works.json`
- `reports/result.json`
- `reports/pipeline-run.json`
- `data/raw/arxiv/2026-06-12/manifest.json`: 200 records, 0 errors
- `data/raw/crossref/2026-06-12/manifest.json`: 500 records, 0 errors
- `data/raw/department-pages/2026-06-12/manifest.json`: 5 records, 0 errors
- `data/raw/doaj/2026-06-12/manifest.json`: 500 records, 0 errors
- `data/raw/hcommons/2026-06-12/manifest.json`: 500 records, 0 errors
- `data/raw/nber/2026-06-12/manifest.json`: 0 records, 0 errors
- `data/raw/openalex/2026-06-12/manifest.json`: 500 records, 0 errors
- `data/raw/osf-preprints/2026-06-12/manifest.json`: 11 records, 0 errors

## Outputs

- `runs/2026-06-12/new-works.json`
- `runs/2026-06-12/new-works.csv`
- `runs/2026-06-12/changed-sources.csv`
- `runs/2026-06-12/result.json`
- `runs/2026-06-12/report.html`
- `runs/2026-06-12/work.md`

## Pipeline Context

Latest pipeline profile: v1; run date: 2026-06-12

## Monitor Interpretation

- `genuinely-new-publication` means the record is absent from the prior baseline and its publication year is inside the configured current window.
- `newly-discovered-old-record` means the record is absent from the prior baseline but predates the current publication window.
- Source count deltas are coverage signals until source manifests are inspected.
