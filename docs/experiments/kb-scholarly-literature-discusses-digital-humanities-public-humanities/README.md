# Scholarly Literature Discusses Digital Humanities Public Humanities

First-pass experiment promoted from the local humanities knowledge base.

## Research Question

What scholarly literature discusses digital humanities and public humanities?

## Source Brief

- Brief directory: `docs/research-briefs/what-scholarly-literature-discusses-digital-humanities-and-public-humanities/`
- Experiment plan: `experiment-plan.json`
- Readiness: `reports/readiness.md`
- SQL: `config/queries.sql`

## Current Status

- Readiness status: first-pass-experiment-ready
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims
- Unit of analysis: work/article metadata record
- Suggested method: start with source-stratified local evidence review, then convert matched records into a longitudinal publication/venue table

## Runbook

From the repository root:

```bash
sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/kb-scholarly-literature-discusses-digital-humanities-public-humanities/config/queries.sql
```

Review these before drafting:

- `reports/claim-checklist.md`
- `reports/article-outline.md`
- `reports/missing-data.md`
- `data/derived/evidence-sample.json`

## Candidate Publication

- Scholarly Literature Discusses Digital Humanities Public Humanities
- What Local Humanities Data Shows About scholarly literature discusses digital humanities public humanities
- A Field Map Of scholarly literature discusses digital humanities public humanities

## Rights Boundary

This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.
