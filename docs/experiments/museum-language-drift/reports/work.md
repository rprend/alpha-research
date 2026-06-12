# Work Log

Generated at: 2026-06-12T19:36:05.630Z
Current pages: 28
Historical snapshots: 12
Museums: 14
Page types: about, collection, education, exhibition, research

## Commands

```bash
node docs/experiments/museum-language-drift/scripts/fetch-current-pages.mjs
node docs/experiments/museum-language-drift/scripts/fetch-wayback-snapshots.mjs
node docs/experiments/museum-language-drift/scripts/build-report.mjs
node docs/experiments/museum-language-drift/scripts/build-audit-packet.mjs
node docs/experiments/museum-language-drift/scripts/check-readiness.mjs
```

## Outputs

- `data/processed/pages.json`
- `data/processed/page-term-counts.csv`
- `data/processed/term-family-by-page-type.csv`
- `data/processed/term-family-by-year.csv`
- `reports/source-inventory.md`
- `reports/report.html`
- `reports/result.json`
- `reports/public-draft.md`
