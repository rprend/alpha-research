# Museum Collections Describe Acquisition Classification Public Domain Ima

First-pass experiment promoted from the local humanities knowledge base.

## Research Question

How do museum collections describe acquisition, classification, and public-domain image availability?

## Source Brief

- Brief directory: `docs/research-briefs/how-do-museum-collections-describe-acquisition-classification-and-public-domain-/`
- Experiment plan: `experiment-plan.json`
- Readiness: `reports/readiness.md`
- SQL: `config/queries.sql`

## Current Status

- Readiness status: first-pass-experiment-ready
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims
- Unit of analysis: collection object or public metadata record
- Suggested method: compare object metadata fields across institution, department, classification, date, rights, and image availability

## Runbook

From the repository root:

```bash
node docs/experiments/kb-museum-collections-describe-acquisition-classification-public-domain-ima/scripts/build-analysis.mjs
```

This writes:

- `data/processed/coverage-by-source.csv`
- `data/processed/field-coverage.csv`
- `data/processed/classification-by-source.csv`
- `data/processed/department-by-source.csv`
- `data/processed/date-precision-by-source.csv`
- `data/processed/acquisition-by-source.csv`
- `data/processed/image-rights-by-source.csv`
- `data/processed/public-domain-by-source.csv`
- `data/processed/representative-records.csv`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`

The original SQL sketch remains available:

```bash
sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/kb-museum-collections-describe-acquisition-classification-public-domain-ima/config/queries.sql
```

Review these before drafting:

- `reports/claim-checklist.md`
- `reports/article-outline.md`
- `reports/missing-data.md`
- `data/derived/evidence-sample.json`

## Candidate Publication

- Museum Collections Describe Acquisition, Classification, Public-domain Image Availability
- What Local Humanities Data Shows About museum collections describe acquisition, classification, public-domain image availability
- A Field Map Of museum collections describe acquisition, classification, public-domain image availability

## Rights Boundary

This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.
