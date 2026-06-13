# Local Humanities Knowledge Base

This directory is the local research substrate for empirical humanities work. It is designed to be queried before new scraping starts.

## Layout

- `source-registry.json`: standing registry of known source routes, rights, and research uses.
- `schemas/`: validation schemas for registry entries and ingest manifests.
- `rights-taxonomy.json`: normalized rights and redistribution vocabulary.
- `raw/`: immutable source responses by source and run date.
- `processed/`: normalized analytical tables, preferably Parquet.
- `text/`: legally stored text corpora and extracted public page text.
- `indexes/`: local keyword and semantic retrieval indexes.
- `audits/`: status reports, source coverage, stale-source reports, failed-route logs, and experiment inventory.

## Commands

```bash
pnpm kb:validate
pnpm kb:status
pnpm kb:inventory
pnpm kb:ingest:core
pnpm kb:ingest:departments
pnpm kb:import:gutenberg
pnpm kb:tables
pnpm kb:index
pnpm kb:audit
pnpm kb:refresh
pnpm kb:search "public humanities"
pnpm kb:question "How has public humanities language changed in top university departments since 2000?"
```

`kb:status` is the first gate for future research questions. It reports source count, rights coverage, table availability, stale registry checks, and missing ingest state.

## Current State

The initial implementation defines the local KB structure and source registry, inventories existing experiment artifacts, and runs a bounded core metadata ingest for six public sources:

- OpenAlex humanities search
- Crossref humanities search
- Wikidata cultural entities
- Library of Congress books search
- Met Collection API object search
- Cleveland Museum Open Access API

Current normalized staging outputs:

- `processed/source_documents.jsonl`
- `processed/works.jsonl`
- `processed/objects.jsonl`
- `processed/pages.jsonl`
- `processed/departments.jsonl`
- `processed/rights.jsonl`
- `processed/*.csv`
- `processed/knowledge-base.sqlite`
- `indexes/source-documents-keyword-index.json`

The KB also imports a bounded local Project Gutenberg text sample from the existing Gutenberg experiment cache and stores extracted public department-page text for local analysis.

This does not claim full local acquisition yet. Sources with `ingest_status` of `planned` or `seeded-from-experiment` still need dedicated ingest jobs before they can support broad claims. The staging JSONL/CSV/SQLite files are the current local analytical layer. Parquet/DuckDB output still requires adding a Parquet writer or DuckDB dependency.
