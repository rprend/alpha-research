# Humanities Dataset Registry

This experiment implements the `What Counts As A Humanities Dataset?` research-agenda track for Archive Signals / The Cultural Observatory.

The goal is to identify reusable corpora that can become public quantitative-humanities essays. The first artifact is a source-probed registry, not a comprehensive survey of every dataset in the humanities.

## Research Question

What reusable corpora could support new quantitative humanities essays, and which are ready for immediate analysis?

## Unit Of Analysis

Candidate dataset or corpus.

Each candidate is scored by:

- source access
- license clarity
- structured-data availability
- time depth
- entity richness
- likely normalization burden
- public essay potential
- quality risks

## Runbook

```bash
node docs/experiments/humanities-dataset-registry/scripts/run-pipeline.mjs
```

Or run step by step:

```bash
node docs/experiments/humanities-dataset-registry/scripts/probe-candidates.mjs
node docs/experiments/humanities-dataset-registry/scripts/build-report.mjs
node docs/experiments/humanities-dataset-registry/scripts/build-study-specs.mjs
node docs/experiments/humanities-dataset-registry/scripts/build-publication-handoff.mjs
node docs/experiments/humanities-dataset-registry/scripts/check-readiness.mjs
```

The scripts write:

- `data/raw/candidate-pages/<run-date>/`
- `data/processed/candidates.json`
- `data/processed/dataset-rankings.csv`
- `data/processed/study-specs.json`
- `data/processed/study-specs.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/study-specs.md`
- `reports/publication-handoff.md`
- `reports/publication-handoff.json`
- `reports/readiness.md`
- `reports/readiness.json`
- `reports/pipeline-run.json`

## Publication Standard

A public essay from this track should distinguish:

- datasets ready for immediate analysis
- datasets that are valuable but need negotiation, export, or crawling
- datasets that are conceptually interesting but too rights-constrained or underdocumented for public claims

The output should be a practical field guide, not a listicle.
