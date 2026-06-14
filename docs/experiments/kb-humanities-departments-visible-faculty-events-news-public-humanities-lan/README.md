# Humanities Departments Visible Faculty Events News Public Humanities Lan

First-pass experiment promoted from the local humanities knowledge base.

## Research Question

Which humanities departments have visible faculty, events, news, and public humanities language in the local corpus?

## Source Brief

- Brief directory: `docs/research-briefs/which-humanities-departments-have-visible-faculty-events-news-and-public-humanit/`
- Experiment plan: `experiment-plan.json`
- Readiness: `reports/readiness.md`
- SQL: `config/queries.sql`

## Current Status

- Readiness status: first-pass-experiment-ready
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims
- Unit of analysis: source page or institutional document
- Suggested method: compare term frequencies and framing across institution, department, source type, and capture/fetch year

## Runbook

From the repository root:

```bash
sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/kb-humanities-departments-visible-faculty-events-news-public-humanities-lan/config/queries.sql
node docs/experiments/kb-humanities-departments-visible-faculty-events-news-public-humanities-lan/scripts/build-analysis.mjs
```

Review these before drafting:

- `reports/claim-checklist.md`
- `reports/article-outline.md`
- `reports/missing-data.md`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/result.json`
- `data/derived/evidence-sample.json`

The analysis script writes:

- `data/processed/coverage-by-source-page-type.csv`
- `data/processed/term-family-by-source.csv`
- `data/processed/term-family-by-school.csv`
- `data/processed/term-family-by-page-type.csv`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`

## Candidate Publication

- Humanities Departments Visible Faculty, Events, News, Public Humanities
- What Local Humanities Data Shows About humanities departments visible faculty, events, news, public humanities
- A Field Map Of humanities departments visible faculty, events, news, public humanities

## Rights Boundary

This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.
