# Public Domain Texts Can Support Study Canon Drift Genre Recurring Langua

First-pass experiment promoted from the local humanities knowledge base.

## Research Question

Which public-domain texts can support a study of canon drift, genre, and recurring language?

## Source Brief

- Brief directory: `docs/research-briefs/which-public-domain-texts-can-support-a-study-of-canon-drift-genre-and-recurring/`
- Experiment plan: `experiment-plan.json`
- Readiness: `reports/readiness.md`
- SQL: `config/queries.sql`

## Current Status

- Readiness status: first-pass-experiment-ready
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims
- Unit of analysis: public-domain text or bibliographic metadata record
- Suggested method: build a rights-filtered text/metadata evidence table, then separate quote-ready full text from discovery-only records

## Runbook

From the repository root:

```bash
node docs/experiments/kb-public-domain-texts-can-support-study-canon-drift-genre-recurring-langua/scripts/build-analysis.mjs
```

The script reads the local KB `source_documents`, `works`, `rights`, and stored Project Gutenberg text files. It writes analysis tables under `data/processed/` and refreshes `reports/result.json`, `reports/work.md`, and `reports/public-draft.md`.

The original SQL scaffold can still be run for ad hoc inspection:

```bash
sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/kb-public-domain-texts-can-support-study-canon-drift-genre-recurring-langua/config/queries.sql
```

Review these before drafting:

- `reports/claim-checklist.md`
- `reports/article-outline.md`
- `reports/missing-data.md`
- `data/derived/evidence-sample.json`

## Candidate Publication

- Public-domain Texts Can Support Study Canon Drift, Genre,
- What Local Humanities Data Shows About public-domain texts can support study canon drift, genre,
- A Field Map Of public-domain texts can support study canon drift, genre,

## Rights Boundary

This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.
