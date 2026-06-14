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
pnpm kb:ingest:cultural
pnpm kb:ingest:doaj
pnpm kb:ingest:wikidata
pnpm kb:ingest:departments
pnpm kb:import:gutenberg
pnpm kb:ingest:web
pnpm kb:tables
pnpm kb:index
pnpm kb:index:semantic
pnpm kb:audit
pnpm kb:refresh
pnpm kb:search "public humanities"
pnpm kb:search:semantic "public humanities"
pnpm kb:question "How has public humanities language changed in top university departments since 2000?"
```

`kb:status` is the first gate for future research questions. It reports source count, rights coverage, table availability, stale registry checks, and missing ingest state.

`kb:question` is the first gate for study design. It infers source-class priorities from the question, ranks local sources with that routing decision, and writes a reproducible brief, evidence file, source map, SQL sketch, study design, date coverage summary, publication concept, study template, and missing-data memo under `docs/research-briefs/`. The date coverage artifact separates content years from fetch years so longitudinal claims are not inferred from crawl timestamps.

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
- `indexes/semantic-hash-index.json`

The KB also imports 200 public-domain Project Gutenberg texts from the existing Gutenberg experiment cache and stores extracted public department-page text for local analysis.

The department-page ingest now reads the broader target list in `config/department-pages.json`, discovers shallow same-origin about/news/events/faculty/program links from successful homepages, appends and dedupes successful public page fetches into the durable `pages` and `departments` tables, and logs blocked routes for replacement planning. The current expanded crawl covers 107 local department/web page records and 48 department summaries after adding 50 discovered/configured page records in the latest run.

The blocked-source audit writes both `audits/blocked-sources.{json,md}` and `audits/failed-route-replacements.{json,md}`. The replacement audit covers blocked sources and active-source route failures, so stale feeds, 403 department pages, Wayback instability, rate limits, and partial API timeouts each have an explicit next action before another ingest attempt.

The web metadata ingest adds bounded local records for DOAJ, Internet Archive, NBER, Public Books, and Digital Humanities Quarterly when their public routes respond. Failed routes are retained in `audits/failed-routes.jsonl`.

The dedicated DOAJ ingest adds broader article and journal metadata for humanities queries across the DOAJ articles and journals APIs. It stores raw API responses, normalized source-document/work/venue rows, rights rows, and `audits/doaj-humanities-last-run.json`.

The dedicated Wikidata ingest adds linked-open-data cultural entities across authors, artists, philosophers, works, movements, genres, institutions, journals, and humanities concepts. It stores raw SPARQL JSON responses, normalized source-document rows, rights rows, and `audits/wikidata-cultural-entities-last-run.json`.

The dedicated cultural-collections ingest adds richer object metadata from Met, Cleveland Museum of Art, Library of Congress, and Smithsonian routes. It stores raw API responses, normalized source-document/object/collection rows, rights rows, and `audits/cultural-collections-last-run.json`.

The Wayback snapshot ingest adds CDX capture metadata for department-page targets in `config/department-pages.json`. It stores capture metadata and archive URLs only; archived page text is not stored.

This does not claim full local acquisition yet. Sources with `ingest_status` of `planned` or `seeded-from-experiment` still need dedicated ingest jobs before they can support broad claims. The staging JSONL, CSV, Parquet, and SQLite files are the current local analytical layer. SQLite FTS indexes metadata plus stored local text content for records that have legal `text_path` files. The semantic hash index provides deterministic offline vector-style retrieval over metadata plus rights-filtered stored text; it is not a neural embedding model. Author, citation, venue, institution, collection, and topic tables are derived from current local source records and raw snapshots; source-provided names and references still require normalization before strong identity or citation-network claims.
