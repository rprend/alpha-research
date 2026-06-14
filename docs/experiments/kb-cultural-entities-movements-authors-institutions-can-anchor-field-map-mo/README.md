# Cultural Entities Movements Authors Institutions Can Anchor Field Map Mo

First-pass experiment promoted from the local humanities knowledge base.

## Research Question

Which cultural entities, movements, authors, and institutions can anchor a field map of modern humanities topics?

## Source Brief

- Brief directory: `docs/research-briefs/which-cultural-entities-movements-authors-and-institutions-can-anchor-a-field-ma/`
- Experiment plan: `experiment-plan.json`
- Readiness: `reports/readiness.md`
- SQL: `config/queries.sql`

## Current Status

- Readiness status: first-pass-experiment-ready
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims
- Unit of analysis: linked cultural entity, person, work, movement, institution, or concept
- Suggested method: build an entity table first, then join people, works, movements, institutions, and concepts to scholarly or collection records

## Runbook

From the repository root:

```bash
sqlite3 data/knowledge-base/processed/knowledge-base.sqlite < docs/experiments/kb-cultural-entities-movements-authors-institutions-can-anchor-field-map-mo/config/queries.sql
```

Review these before drafting:

- `reports/claim-checklist.md`
- `reports/article-outline.md`
- `reports/missing-data.md`
- `data/derived/evidence-sample.json`

## Candidate Publication

- Cultural Entities, Movements, Authors, Institutions Can Anchor Field
- What Local Humanities Data Shows About cultural entities, movements, authors, institutions can anchor field
- A Field Map Of cultural entities, movements, authors, institutions can anchor field

## Rights Boundary

This experiment inherits source rights from the local KB. Do not quote or redistribute full source text unless `rights.redistribution_status`, `quote_status`, and source-specific review allow it.
