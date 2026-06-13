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

Probe file-level access and redistribution risk for the highest-ranked ready-now corpora:

```bash
node docs/experiments/humanities-dataset-registry/scripts/probe-file-level-sources.mjs --strict
node docs/experiments/humanities-dataset-registry/scripts/promote-derived-dataset.mjs
```

The scripts write:

- `data/raw/candidate-pages/<run-date>/`
- `data/raw/file-level-probes/<run-date>/`
- `derived-datasets/wikidata-humanities-authors/manifest.json`
- `derived-datasets/wikidata-humanities-authors/schema.json`
- `derived-datasets/wikidata-humanities-authors/records.json`
- `derived-datasets/wikidata-humanities-authors/records.csv`
- `derived-datasets/wikidata-humanities-authors/sample_rows.json`
- `derived-datasets/wikidata-humanities-authors/rights.md`
- `data/processed/candidates.json`
- `data/processed/dataset-rankings.csv`
- `data/processed/study-specs.json`
- `data/processed/study-specs.csv`
- `data/processed/file-level-probes.json`
- `data/processed/file-level-probes.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/file-level-probes.md`
- `reports/file-level-probes.json`
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

## Current File-Level Probe

The latest file-level probe checked five ready-now routes: Wikidata SPARQL, Library of Congress collections JSON, Met Collection object list plus detail samples, Project Gutenberg RDF catalog samples, and Chronicling America page search JSON.

Current status: `artifact-ready`.

- 4 of 5 probes returned accessible structured records or files.
- Chronicling America returned a 404 on the configured sample route and should stay caveated until a replacement route is verified.
- Wikidata, Library of Congress, Met Collection, and Project Gutenberg are ready to promote into derived dataset design work, subject to item-level rights fields and source-specific normalization notes.

## Derived Dataset Promotion

The first promoted registry artifact is `derived-datasets/wikidata-humanities-authors/`.

- 25 Wikidata humanities-author records from the file-level SPARQL probe.
- Files include a manifest, schema, JSON records, CSV records, sample rows, and rights memo.
- Rights status: CC0 source metadata with redistribution marked `derived-metadata-ok`.
- Caveat: this is a bounded sample artifact, not a full Wikidata dump or publication-ready longitudinal study.
