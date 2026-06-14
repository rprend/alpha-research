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
pnpm kb:ingest:web
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
- `processed/authors.jsonl`
- `processed/institutions.jsonl`
- `processed/venues.jsonl`
- `processed/collections.jsonl`
- `processed/objects.jsonl`
- `processed/pages.jsonl`
- `processed/departments.jsonl`
- `processed/citations.jsonl`
- `processed/topics.jsonl`
- `processed/rights.jsonl`
- `processed/*.csv`
- `processed/*.parquet`
- `processed/source_documents_fts_input.csv`
- `processed/pages_fts_input.csv`
- `processed/knowledge-base.sqlite`
- `indexes/source-documents-keyword-index.json`

The KB also imports a bounded local Project Gutenberg text sample from the existing Gutenberg experiment cache and stores extracted public department-page text for local analysis.

The web metadata ingest adds bounded local records for DOAJ, Internet Archive, NBER, Public Books, and Digital Humanities Quarterly when their public routes respond. Failed routes are retained in `audits/failed-routes.jsonl`.

The Wayback snapshot ingest adds CDX capture metadata for department-page targets in `config/department-pages.json`. It stores capture metadata and archive URLs only; archived page text is not stored.

This does not claim full local acquisition yet. Sources with `ingest_status` of `planned` or `seeded-from-experiment` still need dedicated ingest jobs before they can support broad claims. The staging JSONL, CSV, Parquet, and SQLite files are the current local analytical layer. SQLite FTS indexes metadata plus stored local text content for records that have legal `text_path` files. Author, citation, venue, institution, collection, and topic tables are derived from current local source records and raw snapshots; source-provided names and references still require normalization before strong identity or citation-network claims.
