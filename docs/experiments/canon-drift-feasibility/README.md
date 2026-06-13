# Canon Drift Feasibility

This experiment tests which public sources can credibly support Archive Signals essays about canon drift.

It is a `moving-canon` track. The first artifact is a feasibility report, not a trend claim. It asks whether assigned, anthologized, cited, translated, or held authors can be measured from public or available data with enough provenance to support a public essay.

## Research Question

Which sources can credibly measure changes in assigned, anthologized, cited, translated, or held authors over time?

## Candidate Signals

- syllabus or reading-list appearances
- course-catalog appearances
- anthology table-of-contents appearances
- citation and related-work appearances
- library/archive holdings or collection metadata
- translation/edition appearances

## Runbook

```bash
node docs/experiments/canon-drift-feasibility/scripts/run-pipeline.mjs
```

Or run step by step:

```bash
node docs/experiments/canon-drift-feasibility/scripts/probe-web-sources.mjs
node docs/experiments/canon-drift-feasibility/scripts/probe-openalex-authors.mjs
node docs/experiments/canon-drift-feasibility/scripts/build-openalex-citation-pilot.mjs --from-year=2010 --to-year=2026 --sample-size=20
node docs/experiments/canon-drift-feasibility/scripts/check-openalex-citation-pilot.mjs
node docs/experiments/canon-drift-feasibility/scripts/build-sample-audit-packet.mjs
node docs/experiments/canon-drift-feasibility/scripts/build-report.mjs
node docs/experiments/canon-drift-feasibility/scripts/build-publication-handoff.mjs
node docs/experiments/canon-drift-feasibility/scripts/check-readiness.mjs
```

The scripts write:

- `data/raw/web-sources/<run-date>/`
- `data/raw/openalex-authors/<run-date>/`
- `data/processed/source-probes.json`
- `data/processed/feasibility-matrix.csv`
- `data/processed/canon-openalex-year-counts.csv`
- `data/processed/canon-openalex-sample-works.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/canon-narrow-pilot.md`
- `reports/canon-narrow-pilot-readiness.md`
- `reports/sample-audit-packet.md`
- `reports/sample-audit-packet.csv`
- `reports/sample-audit-packet.json`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/publication-handoff.md`
- `reports/publication-handoff.json`
- `reports/readiness.md`
- `reports/readiness.json`
- `reports/pipeline-run.json`

## Publication Standard

This study becomes publishable only when it can separate at least three canon signals, such as teaching, anthologization, citation, translation, and holdings. A future public essay should state explicitly that each signal measures a different institutional process.

## Narrow Pilot Review

The OpenAlex citation/scholarly-discussion pilot writes a manual sample review queue to:

```text
reports/sample-audit-packet.md
reports/sample-audit-packet.csv
reports/sample-audit-packet.json
```

The current packet queues 120 OpenAlex sample works across the six-author cohort. It is artifact-ready but not publication-ready: all rows are pending review, all rows are flagged for relevance review, and 27 rows are likely biomedical false positives. Use this packet to label true author-discussion records before using any row as a public example.
