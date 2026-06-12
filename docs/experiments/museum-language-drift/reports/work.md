# Work Log

Generated at: 2026-06-12T18:24:48.804Z
Current pages: 33
Historical snapshots: 4
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
