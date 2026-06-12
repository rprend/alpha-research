# Museum Language Drift

This experiment probes whether public museum language has shifted around civilization, world culture, provenance, restitution, repatriation, decolonization, access, education, and community.

It is a `what-changed` track for Archive Signals / The Cultural Observatory. The first implementation is a source probe, not publication evidence: it collects current public pages, builds term-family tables, and writes a readiness report that blocks public claims until historical and genre coverage are added.

## Research Question

How have museums changed public language around ownership, civilization, world culture, provenance, restitution, repatriation, decolonization, and community?

## Unit Of Analysis

Museum page snapshot, with source genre labels such as:

- about/mission
- collection
- provenance/repatriation
- exhibition
- annual report
- education/public programs

## Runbook

```bash
node docs/experiments/museum-language-drift/scripts/fetch-current-pages.mjs
node docs/experiments/museum-language-drift/scripts/build-report.mjs
node docs/experiments/museum-language-drift/scripts/build-audit-packet.mjs
node docs/experiments/museum-language-drift/scripts/check-readiness.mjs
```

The scripts write:

- `data/raw/current-pages/<run-date>/`
- `data/processed/pages.json`
- `data/processed/page-term-counts.csv`
- `data/processed/term-family-by-page-type.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/audit-packet.md`
- `reports/audit-packet.csv`
- `reports/audit-packet.json`
- `reports/readiness.md`
- `reports/readiness.json`

## Publication Standard

This study becomes publishable only after:

- current pages are collected for at least 12 museums
- at least three source genres are represented
- historical snapshots cover at least two non-current years
- snippets around high-signal terms are manually audited
- source genre differences are separated from temporal change

Until then, use this folder as a source-probe and corpus-design artifact.
