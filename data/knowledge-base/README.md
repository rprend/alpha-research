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
node scripts/kb-ingest-department-sitemaps.mjs
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
node scripts/kb-promote-brief-experiment.mjs
```

`kb:status` is the first gate for future research questions. It reports source count, rights coverage, table availability, stale registry checks, and missing ingest state.

`kb:question` is the first gate for study design. It infers source-class priorities from the question, ranks local sources with that routing decision, and writes a reproducible brief, evidence file, source map, SQL sketch, study design, date coverage summary, publication concept, study template, and missing-data memo under `docs/research-briefs/`. The date coverage artifact separates content years from fetch years so longitudinal claims are not inferred from crawl timestamps.

`kb:refresh` is the maintenance gate. It validates the registry, refreshes bounded source-specific metadata routes, refreshes department sitemap summaries, runs a bounded Wayback CDX smoke with explicit timeout/limit settings, rebuilds analytical tables and both indexes, refreshes audits/status, and generates a local question-smoke brief. Broad acquisition remains source-specific; refresh is intentionally bounded so routine maintenance can finish predictably while still proving the local KB can answer a question.

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
- `processed/canonical_people.jsonl`
- `processed/institutions.jsonl`
- `processed/venues.jsonl`
- `processed/collections.jsonl`
- `processed/objects.jsonl`
- `processed/pages.jsonl`
- `processed/departments.jsonl`
- `processed/citations.jsonl`
- `processed/work_references.jsonl`
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

The department-sitemap ingest fetches public `sitemap.xml` routes for configured department targets, stores raw sitemap XML for successful routes, and adds sitemap URL metadata rows without storing page text. The latest run succeeded for 22 of 40 sitemap targets and added 325 metadata-only department URL rows, expanding the department/page corpus to 432 page records and 52 department summaries. Failed sitemap routes are logged in `audits/failed-routes.jsonl` for source-specific replacement planning.

The blocked-source audit writes both `audits/blocked-sources.{json,md}` and `audits/failed-route-replacements.{json,md}`. The replacement audit covers blocked sources and active-source route failures, so stale feeds, 403 department pages, Wayback instability, rate limits, and partial API timeouts each have an explicit next action before another ingest attempt.

The web metadata ingest adds bounded local records for DOAJ, Internet Archive, NBER, Public Books, and Digital Humanities Quarterly when their public routes respond. Failed routes are retained in `audits/failed-routes.jsonl`.

The dedicated DOAJ ingest adds broader article and journal metadata for humanities queries across the DOAJ articles and journals APIs. It stores raw API responses, normalized source-document/work/venue rows, rights rows, and `audits/doaj-humanities-last-run.json`.

The dedicated Wikidata ingest adds linked-open-data cultural entities across authors, artists, philosophers, works, movements, genres, institutions, journals, and humanities concepts. It stores raw SPARQL JSON responses, normalized source-document rows, rights rows, and `audits/wikidata-cultural-entities-last-run.json`.

The dedicated cultural-collections ingest adds richer object metadata from Met, Cleveland Museum of Art, Library of Congress, and Smithsonian routes. It stores raw API responses, normalized source-document/object/collection rows, rights rows, and `audits/cultural-collections-last-run.json`.

The Wayback snapshot ingest adds CDX capture metadata for department-page targets in `config/department-pages.json`. It stores capture metadata and archive URLs only; archived page text is not stored.

The analytical table build now adds a deterministic candidate identity layer: `processed/canonical_people.*` clusters source author records by normalized name, and `processed/work_references.*` clusters citation/reference edges by DOI, OpenAlex ID, or normalized source label. The audit at `audits/identity-resolution.{json,md}` reports record counts, repeated references, and limitations. These tables are suitable for exploratory field maps and QA, but they are not manual authority control.

The refresh workflow now writes a question-smoke brief at `docs/research-briefs/what-local-evidence-exists-for-public-humanities-language-in-departments/`, proving that a fresh local maintenance run can generate a brief, source map, evidence file, identity summary, query sketch, missing-data memo, and study template from the rebuilt local database.

The brief-promotion workflow converts local-data briefs into first-pass experiment folders under `docs/experiments/kb-*`. It copies the source map and SQL, writes a readiness gate, article outline, claim checklist, missing-data memo, evidence sample, and experiment plan. The first promotion run created five experiment scaffolds and an index at `audits/promoted-experiments.{json,md}`. These are downstream publication candidates; they do not supersede rights review or source-specific normalization.

The first promoted experiment with a runnable analysis is `docs/experiments/kb-humanities-departments-visible-faculty-events-news-public-humanities-lan/`. Its `scripts/build-analysis.mjs` reads local KB page and rights tables plus stored local-analysis text, then writes coverage CSVs, term-family CSVs, `reports/result.json`, `reports/work.md`, and `reports/public-draft.md`.

This does not claim full local acquisition yet. Sources with `ingest_status` of `planned` or `seeded-from-experiment` still need dedicated ingest jobs before they can support broad claims. The staging JSONL, CSV, Parquet, and SQLite files are the current local analytical layer. SQLite FTS indexes metadata plus stored local text content for records that have legal `text_path` files. The semantic hash index provides deterministic offline vector-style retrieval over metadata plus rights-filtered stored text; it is not a neural embedding model. Author, citation, venue, institution, collection, topic, canonical-person, and work-reference tables are derived from current local source records and raw snapshots; candidate identity clusters still need authority matching before strong person-level or citation-network claims.
