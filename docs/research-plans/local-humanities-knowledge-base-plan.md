# Local Humanities Knowledge Base Plan

Status: active plan, saved in repository on 2026-06-13.

## Goal

Build a local research substrate for empirical humanities work: source registries, metadata, full text where legal and available, snapshots, embeddings, provenance, and update routines. Future research questions should start by querying data already present on the laptop, not by scraping the internet from scratch.

The desired workflow is:

1. Ask a research question.
2. Query the local humanities knowledge base.
3. Identify relevant local sources, tables, texts, entities, and caveats.
4. Decide whether existing data is enough for a study.
5. Fetch or scrape only the missing or stale pieces.
6. Produce a study design, audit trail, and publication path.

This plan supersedes ad hoc question-first scraping. Individual studies should become test cases for the knowledge base, not the foundation of the system.

The editorial goal is a durable publication engine for a Substack or site about empirical humanities research. The name does not need to be "Quantitative Humanities"; possible working titles include:

- Culture Ledger
- The Humanities Observatory
- Archive Mechanics
- The Canon Lab
- Cultural Drift
- Field Notes From The Humanities
- The Empirical Humanist

The product of this system should be a steady stream of evidence-backed essays: longitudinal studies of language, canon formation, institutions, museums, journals, departments, syllabi, and public culture, plus AI-assisted proposals for study directions that expand what can be measured or compared.

## Non-Goals

- Do not treat a few example experiments as a complete knowledge base.
- Do not require fresh internet scraping for every research question.
- Do not store copyrighted full text unless the source terms clearly allow it.
- Do not collapse provenance and rights into generic notes. Every record should carry source and rights metadata.
- Do not optimize first for public essays. Optimize first for reusable local research capacity.
- Do not artificially limit the system to small slices. Use samples only as validation passes before broad acquisition jobs.

## Storage Contract

All knowledge-base data lives under:

```text
data/knowledge-base/
```

Planned subdirectories:

```text
data/knowledge-base/
  source-registry.json
  rights-taxonomy.json
  config/
  schemas/
  raw/
  processed/
  text/
  indexes/
  audits/
```

The working rule is simple: if a future question needs humanities evidence, first query `data/knowledge-base/`. Internet access should be used to refresh, repair, or expand the local base, not to rebuild context from zero each time.

## Core Design

The knowledge base should have seven layers.

### 1. Source Registry

A catalog of known humanities and humanities-adjacent sources, including access route, update cadence, license, fields, risks, and expected research value.

Initial source classes:

- scholarly metadata: OpenAlex, Crossref, DOAJ
- public-domain and open texts: Project Gutenberg, Internet Archive metadata, HathiTrust metadata where allowed
- linked open data: Wikidata
- cultural collections: Library of Congress, Met, Cleveland Museum of Art, Smithsonian, other museum APIs
- university and department web: top-school humanities departments, centers, news, events, publication pages, mission/about pages
- journals and reviews: journal RSS feeds, publisher metadata pages, open-access article metadata
- conferences and programs: MLA-adjacent, AHA-adjacent, humanities center programs, digital humanities conferences
- syllabi and teaching corpora: only where access and redistribution terms are clear
- humanities-adjacent economics/history/culture: NBER and related sources where the subject matter is genuinely relevant

Each source registry entry should include:

- `source_id`
- `name`
- `source_class`
- `homepage_url`
- `access_routes`
- `license`
- `redistribution_status`
- `full_text_allowed`
- `metadata_allowed`
- `robots_or_terms_notes`
- `update_cadence`
- `expected_fields`
- `research_use_cases`
- `known_risks`
- `last_checked_at`

### 2. Raw Data Lake

Store immutable local copies of fetched source responses.

Proposed layout:

```text
data/knowledge-base/raw/
  openalex/
  crossref/
  doaj/
  wikidata/
  gutenberg/
  internet-archive/
  hathi-metadata/
  loc/
  museums/
  universities/
  journals/
  conferences/
  syllabi/
  nber-humanities-adjacent/
```

Rules:

- Raw files should be append-only by run date.
- Every ingest run should write a manifest.
- Raw paths should preserve source, run date, route, and query parameters where practical.
- Failed requests should be logged with status code and reason.

### 3. Normalized Analytical Tables

Convert raw records into queryable local tables.

Preferred local stack:

- Parquet for durable columnar data
- DuckDB for analytical queries
- SQLite FTS for simple local text search
- LanceDB, Chroma, or FAISS for semantic search once the first text corpus is stable

Proposed processed layout:

```text
data/knowledge-base/processed/
  works.parquet
  authors.parquet
  institutions.parquet
  venues.parquet
  departments.parquet
  collections.parquet
  objects.parquet
  pages.parquet
  citations.parquet
  topics.parquet
  source_documents.parquet
  rights.parquet
```

Common fields:

- stable local ID
- source ID
- source native ID
- source URL
- fetch date
- normalized title/name
- raw title/name
- date or date range
- entity links where available
- license
- redistribution status
- text availability
- confidence or normalization notes

### 4. Text Corpus

Store text where legal and useful.

Proposed layout:

```text
data/knowledge-base/text/
  public-domain-books/
  abstracts/
  museum-descriptions/
  department-pages/
  journal-metadata/
  conference-programs/
  archived-pages/
```

Text handling rules:

- Store public-domain and openly licensed full text when permitted.
- Store abstracts and metadata only when full text is not permitted.
- Store extracted page text from university and public institutional pages with fetch date and source URL.
- Avoid storing paywalled or license-restricted full text.
- Keep quoting rights separate from storage rights.

### 5. Search And Retrieval Indexes

Build local retrieval over the corpus.

Minimum viable indexes:

- DuckDB tables for structured querying.
- SQLite FTS index over document text, titles, abstracts, descriptions, and page text.
- Optional vector index after text normalization stabilizes.

Question examples the index should support:

- What do we already have on canon drift?
- Which sources contain museum acquisition dates?
- Which departments mention AI, ethics, race, climate, public humanities, or interdisciplinarity over time?
- Which venues publish work on digital humanities, archives, literary sociology, book history, or cultural analytics?
- Which datasets can support longitudinal claims?

### 6. Provenance, Rights, And Audit Layer

Every derived record and report should be traceable back to raw source material.

Required provenance fields:

- source ID
- source route
- raw file path
- fetch timestamp
- transformation script
- normalized output path
- license
- redistribution status
- quote status
- known source caveats

Audit outputs:

```text
data/knowledge-base/audits/
  source-coverage.md
  rights-summary.md
  ingest-runs.jsonl
  failed-routes.jsonl
  stale-sources.md
  normalization-warnings.jsonl
```

### 7. Question Workbench

Given a research question, the system should produce a local-data brief before any new scraping.

The brief should answer:

- What local sources are relevant?
- Which tables and text indexes should be queried?
- What time periods are covered?
- What entities are available?
- What claims are supportable now?
- What claims are not supportable yet?
- What data is stale, missing, or rights-constrained?
- What would the study design be?
- What would need to be ingested next?

Example command shape:

```bash
pnpm kb:question "How has the language of public humanities changed in top university departments since 2000?"
```

Expected output:

```text
docs/research-briefs/<slug>/brief.md
docs/research-briefs/<slug>/source-map.json
docs/research-briefs/<slug>/queries.sql
docs/research-briefs/<slug>/missing-data.md
```

## Phased Implementation

The implementation uses broad acquisition with controlled validation. Each ingest should start with a smoke run, then move to a wider run once schema, rights, and failure logging are correct. "Bounded sample" means "test run," not "final scope."

### Phase 0: Reframe Existing Work

Purpose: separate the knowledge base from the individual experiments already created.

Actions:

1. Create this plan.
2. Create `data/knowledge-base/` directory structure.
3. Create a source registry schema.
4. Inventory existing experiment data that can seed the knowledge base.
5. Mark existing studies as downstream consumers, not the core system.

Outputs:

- `docs/research-plans/local-humanities-knowledge-base-plan.md`
- `data/knowledge-base/source-registry.json`
- `data/knowledge-base/README.md`
- `data/knowledge-base/audits/existing-experiment-inventory.md`

### Phase 1: Local Storage And Registry

Purpose: define the durable local data model before large acquisition.

Actions:

1. Implement source registry schema and validation.
2. Add initial source entries for OpenAlex, Crossref, DOAJ, Wikidata, Project Gutenberg, Library of Congress, Met, Cleveland Museum, Smithsonian, university department pages, selected journals, selected conferences, and NBER humanities-adjacent material.
3. Add run manifest schema for ingests.
4. Add rights taxonomy.
5. Add basic `pnpm kb:status` command.

Outputs:

- source registry with at least 30 source entries
- rights taxonomy
- ingest manifest schema
- KB status report

### Phase 2: Core Metadata Ingests

Purpose: collect broad metadata that can answer many future questions.

Initial acquisition priorities:

1. OpenAlex works/authors/institutions for humanities-like concepts and venues.
2. Crossref/DOAJ metadata for journals and open-access article records.
3. Wikidata selected exports for people, institutions, works, occupations, movements, places, and cultural entities.
4. Project Gutenberg catalog metadata and public-domain text manifest.
5. Library of Congress collection/item metadata samples.
6. Museum API metadata for Met, Cleveland, Smithsonian, and other open APIs.

Broad-run expectation:

- OpenAlex: pull all records matching selected humanities concepts, venues, institutions, and year ranges feasible under API limits.
- Crossref/DOAJ: pull journal and article metadata for target venues and subject categories, not only named examples.
- Wikidata: export reusable entity tables for people, works, institutions, movements, places, genres, and occupations.
- Project Gutenberg: import catalog metadata broadly and store allowed full text for public-domain works.
- Cultural collections: expand from smoke samples to collection-wide metadata where APIs and terms allow.
- NBER and adjacent sources: include only records with clear culture/history/humanities relevance and keep them labeled as adjacent, not core humanities.

Outputs:

- raw source snapshots
- normalized Parquet tables
- ingest manifests
- source coverage report

### Phase 3: University And Department Web Corpus

Purpose: create a standing corpus for institutional language drift.

Actions:

1. Define school and department target list.
2. Fetch current public pages for departments, centers, news, events, publications, mission/about pages, and faculty pages where appropriate.
3. Add Wayback discovery for selected high-value pages.
4. Store raw HTML and extracted text.
5. Normalize page metadata: school, department, page type, date, source URL, archive URL.

Broad-run expectation:

- Start with top research universities, then expand to liberal arts colleges, public universities, HBCUs, religious colleges, art schools, and international comparators.
- Capture departments in English, history, philosophy, classics, art history, languages, comparative literature, religion, area studies, media studies, musicology, theater, and related interdisciplinary centers.
- Use current-page crawls plus Wayback CDX discovery for historical drift.
- Keep crawl limits and robots/terms compliance per domain, but do not reduce the research ambition to one or two schools.

Outputs:

- `pages.parquet`
- `departments.parquet`
- current text corpus
- historical snapshot manifest
- drift-ready source coverage report

### Phase 4: Text Search And Semantic Retrieval

Purpose: make the local corpus useful for exploratory research questions.

Actions:

1. Build SQLite FTS index over available text.
2. Add DuckDB query examples.
3. Add semantic embeddings for allowed text after rights filtering.
4. Add local retrieval command.
5. Add source filters by rights, source class, date, and corpus.

Outputs:

- local full-text index
- optional vector index
- retrieval report
- example notebooks or scripts

### Phase 5: Question Workbench

Purpose: make new research questions start with local evidence.

Actions:

1. Implement `pnpm kb:question`.
2. Route questions to relevant source classes.
3. Generate local data availability briefs.
4. Generate missing-data plans only after querying local sources.
5. Add claim/caveat checklist.

Outputs:

- research brief generator
- source map generator
- missing data report
- reusable study-design template

The workbench should also generate publication concepts:

- essay title options
- candidate charts/tables
- claim strength rating
- missing evidence list
- suggested follow-up acquisition
- "why this matters" note for non-specialist readers

### Phase 6: Refresh And Maintenance

Purpose: keep the local knowledge base alive.

Actions:

1. Add source freshness checks.
2. Add incremental ingest support.
3. Add stale-source reports.
4. Add checksums or content hashes.
5. Add failed route tracking.
6. Add periodic source review.

Outputs:

- `pnpm kb:refresh`
- freshness dashboard/report
- stale source audit
- failed route audit

## First Acquisition Priorities

The first broad acquisition campaign should favor sources that are legal, stable, high-leverage, and reusable.

Priority 1:

- OpenAlex metadata for humanities-like works, authors, institutions, concepts, and venues
- Wikidata selected exports for cultural entities, authors, institutions, movements, places, and works
- Project Gutenberg catalog and public-domain text availability
- Library of Congress collection metadata
- museum APIs with open metadata

Priority 2:

- Crossref and DOAJ journal metadata
- top university humanities department pages
- humanities center event/news pages
- conference programs and CFPs

Priority 3:

- historical web snapshots through Wayback
- syllabi or teaching corpora where terms allow
- NBER and other humanities-adjacent policy/economics/history sources
- publisher pages where metadata is accessible and terms allow

## Publication Program

The knowledge base should support recurring essay families:

- Language drift: how departments, museums, journals, centers, and programs change their self-description over time.
- Canon drift: which works, authors, periods, and concepts become more or less central across syllabi, scholarship, reference works, and public institutions.
- Institution drift: how universities, museums, publishers, and conferences allocate attention across fields and topics.
- Concept diffusion: how terms such as AI, ethics, race, climate, empire, public humanities, interdisciplinarity, archives, data, and care spread across sources.
- Field maps: AI-assisted surveys of a field that propose measurable open questions and identify data gaps.
- Comparative institutions: differences between elite/private/public/liberal-arts/international humanities ecosystems.
- Public culture: relationships among reviews, museum language, public talks, books, and scholarship.

Each essay should leave behind reusable assets in the repository:

```text
docs/research-briefs/<slug>/
docs/experiments/<slug>/
data/knowledge-base/audits/
```

## Success Criteria

The knowledge base is useful when:

- a new research question can be answered first with `kb:question`
- the system can say which local sources are relevant
- the system can say what data is missing before new scraping starts
- rights and provenance are visible for every source
- at least five distinct study directions can be supported from local data
- new experiments consume KB tables instead of building one-off scrapers first

The full local knowledge-base goal is complete only when:

- source coverage includes broad local metadata from the main source classes, not just smoke samples
- the source registry distinguishes planned, active, blocked, and retired routes
- failed routes have replacement plans or explicit blocked-source memos
- a question can produce a local-data brief without internet access
- at least one longitudinal corpus exists for university/department pages
- at least one broad scholarly metadata corpus exists for works/venues/authors/institutions
- at least one cultural-collections corpus exists for objects/descriptions/acquisitions
- public-domain or openly licensed full text is stored where allowed
- provenance and rights audits cover every local record
- refresh commands can rebuild indexes and audits reproducibly

## Immediate Next Step

Implement Phase 0 and Phase 1:

1. Create the `data/knowledge-base/` directory structure.
2. Add the source registry schema.
3. Seed the registry with the first 30 sources.
4. Inventory existing experiment artifacts that can seed the KB.
5. Add a local `kb:status` command that reports source count, rights coverage, local table availability, and stale/missing ingest state.

## Implementation Status

Started on 2026-06-13:

- Phase 0 is implemented: the plan exists, `data/knowledge-base/` exists, and existing experiments are inventoried in `data/knowledge-base/audits/existing-experiment-inventory.md`.
- Phase 1 is implemented: the source registry has 31 sources, registry/schema validation exists, rights taxonomy exists, ingest manifest schema exists, and `pnpm kb:status` reports local KB state.
- Phase 2 has a bounded starter ingest: `pnpm kb:ingest:core` fetches OpenAlex, Crossref, Wikidata, Library of Congress, Met, and Cleveland Museum samples into raw run folders and normalized JSONL staging tables.
- Phase 2 now has a broad append/dedupe metadata ingest: `pnpm kb:ingest:broad` pulls larger source-specific batches for OpenAlex, Crossref, Internet Archive, Library of Congress, Cleveland Museum, Met, and NBER into the local KB without resetting existing staging tables.
- Phase 2/3 now has a gap-source ingest: `pnpm kb:ingest:gaps` targets registered sources without local records, including Smithsonian, Columbia department pages, DH conference pages, journal metadata through Crossref, and blocked-route probes for sources that need replacement routes.
- Phase 6 now has a blocked-source audit: `pnpm kb:audit:blocked` writes source-specific memos for routes that require permission, replacement, or terms review.
- Phase 2 also imports a bounded Project Gutenberg public-domain text sample from the existing local Gutenberg experiment cache into `data/knowledge-base/text/public-domain-books/`.
- Phase 2 now has a bounded web metadata ingest: `pnpm kb:ingest:web` imports responding public routes for DOAJ, Internet Archive, NBER, Public Books, and Digital Humanities Quarterly. Wayback and LARB failures are logged for route replacement.
- Phase 3 has a bounded department-page corpus: `pnpm kb:ingest:departments` fetches selected public humanities department pages, stores raw HTML and extracted local-analysis text, and writes `pages`/`departments` staging rows. Harvard and Princeton routes returned 403 and are logged in `failed-routes.jsonl`.
- Phase 4 has a bounded local analytical/search layer: `pnpm kb:tables` writes CSV tables, Parquet tables, and `data/knowledge-base/processed/knowledge-base.sqlite`; `pnpm kb:index` builds `data/knowledge-base/indexes/source-documents-keyword-index.json` using metadata plus previews of stored text; `pnpm kb:search "<terms>"` queries the local keyword index.
- Phase 4 now derives author, citation, venue, institution, collection, and topic tables from current normalized local records and raw snapshots; source-provided names and references still need normalization before strong identity or citation-network claims.
- Phase 4 now has SQLite FTS retrieval: `pnpm kb:search:sqlite "<terms>"` queries `source_documents_fts` and `pages_fts` in `data/knowledge-base/processed/knowledge-base.sqlite` with ranked snippets.
- Phase 5 has a bounded starter workbench: `pnpm kb:question "<question>"` writes a local-data brief, source map, query sketch, and missing-data memo under `docs/research-briefs/`.
- Phase 6 has starter maintenance automation: `pnpm kb:refresh` validates, inventories, rebuilds analytical tables, refreshes coverage/rights/stale-source audits, rebuilds the index, and updates KB status.

Current local footprint as of the latest committed status:

- 33 registered sources.
- 28 registered sources with local documents.
- 1845 source documents.
- 1283 works.
- 1779 source-provided authors.
- 333 venues.
- 14 institutions.
- 25 derived collections.
- 34859 source-provided citation/reference edges.
- 541 source-provided topics.
- 507 cultural objects.
- 34 department/web pages.
- 1845 rights rows.
- 24 local text files.
- 12/12 staging JSONL tables.
- 12/12 processed Parquet tables.
- SQLite analytical database at `data/knowledge-base/processed/knowledge-base.sqlite`.
- Keyword index at `data/knowledge-base/indexes/source-documents-keyword-index.json`.

This is a foundation and harness, not the complete knowledge base.

Remaining before the full knowledge-base goal is complete:

- Normalize source-provided author identities and citation/reference edges into cleaner person/work graphs.
- Add broad, source-specific ingest jobs rather than bounded samples.
- Replace failed public routes for Wayback CDX, LARB, Harvard, and Princeton or keep them as blocked-source memos.
- Expand university/department web corpus acquisition beyond the first successful routes.
- Expand full text storage only for public-domain or clearly licensed sources.
- Add richer SQLite FTS or semantic retrieval over stored text contents, not just document metadata.
- Add refresh/staleness automation for every active source route, including route replacement for 403/failed department pages.

Next build steps:

1. Import existing experiment outputs as seed records, while marking them as experiment-derived and not confusing them with broad source coverage.
2. Fix Wayback CDX route shape and add replacement plans for blocked LARB/403 department routes.
3. Convert the current source registry into broad acquisition batches by source class.
4. Run broad metadata acquisition for OpenAlex, DOAJ/Crossref, Project Gutenberg, Wikidata, and cultural-collection APIs.
5. Build the first no-internet question brief from local data only.
