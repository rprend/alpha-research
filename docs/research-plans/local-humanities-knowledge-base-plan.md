# Local Humanities Knowledge Base Plan

Status: active plan, saved in repository on 2026-06-13 and reframed on 2026-06-14.

## Planning Correction

The first objective is not to answer one or two humanities questions. The first objective is to build a local, reusable humanities knowledge base on this laptop so future questions can start from stored data, indexes, provenance, and rights metadata.

That means the system should prioritize broad source acquisition, durable schemas, local search, refresh routines, and evidence audits before optimizing for any single Substack essay or experiment. Individual studies are downstream consumers and validation tests for the knowledge base.

When a research question arrives, the default workflow should be:

1. Query local KB tables, text, and indexes.
2. Produce a local-data brief with coverage, evidence, caveats, and missing fields.
3. Decide whether a publishable claim is supportable.
4. Fetch only the missing or stale source material needed to improve the study.
5. Save the resulting study artifacts back into the repository so the KB becomes stronger.

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
- Phase 2 now has a dedicated cultural-collections ingest: `pnpm kb:ingest:cultural` pulls richer object/collection metadata from Met, Cleveland Museum of Art, Library of Congress, and Smithsonian APIs.
- Phase 2 now has a dedicated DOAJ humanities ingest: `pnpm kb:ingest:doaj` pulls article and journal metadata across humanities queries from DOAJ, stores raw responses, and appends normalized work, venue, source-document, and rights rows.
- Phase 2 now has a dedicated Wikidata cultural-entity ingest: `pnpm kb:ingest:wikidata` pulls typed linked-open-data entities for people, works, movements, genres, institutions, journals, and humanities concepts.
- Phase 2 now has a dedicated HathiTrust bibliographic ingest: `node scripts/kb-ingest-hathitrust.mjs` uses Internet Archive humanities candidates with ISBN/LCCN/OCLC identifiers to query the HathiTrust Bibliographic API brief endpoint, stores metadata-only Hathi records, and avoids the blocked catalog keyword-search route.
- Phase 2/3 now has a gap-source ingest: `pnpm kb:ingest:gaps` targets registered sources without local records, including Smithsonian, Columbia department pages, DH conference pages, AHA annual-meeting metadata through public WordPress JSON endpoints, journal metadata through Crossref, and blocked-route probes for sources that need replacement routes.
- Phase 6 now has blocked-source and failed-route replacement audits: `pnpm kb:audit:blocked` writes source-specific memos for blocked sources and `failed-route-replacements.{json,md}` with next actions for active-source route failures such as 403 department pages, stale feeds, Wayback CDX instability, partial API timeouts, rate limits, and permissioned APIs.
- Phase 2 also imports a 200-text Project Gutenberg public-domain corpus from the existing local Gutenberg experiment cache into `data/knowledge-base/text/public-domain-books/`.
- Phase 2 now has a bounded web metadata ingest: `pnpm kb:ingest:web` imports responding public routes for DOAJ, Internet Archive, NBER, Public Books, Los Angeles Review of Books, and Digital Humanities Quarterly. LARB's stale `/feed/` route has a working replacement: the ingest imports public homepage Next.js metadata without storing article text.
- Phase 3 has an expanded department-page corpus: `pnpm kb:ingest:departments` fetches public humanities department pages from the target list in `data/knowledge-base/config/department-pages.json`, discovers balanced same-origin about/news/events/faculty/program links from successful homepages, stores raw HTML and extracted local-analysis text, appends/dedupes durable `pages`/`departments` staging rows, and logs 403 routes in `failed-routes.jsonl` for replacement planning.
- Phase 3 now has a department-sitemap metadata route: `node scripts/kb-ingest-department-sitemaps.mjs` fetches public `sitemap.xml` routes for configured department targets, stores raw sitemap XML, and appends metadata-only URL records without storing page text. The first run succeeded for 22 of 40 sitemap targets and added 325 department URL metadata records; blocked or absent sitemaps remain in `failed-routes.jsonl`.
- Phase 3 now has a balanced department route expansion: `pnpm kb:ingest:departments -- --discover-per-target=5 --discover-per-page-type=1 --sitemap-upgrade-limit=25` samples across about/news/events/faculty/program links instead of taking only the first ranked links, rejects non-HTML document/media routes, and can upgrade bounded sitemap URL metadata into stored local-analysis page text when the public URL returns HTML.
- Phase 3 now has a Wayback CDX snapshot ingest: `pnpm kb:ingest:wayback` reads department-page targets, stores raw CDX responses, and writes historical capture metadata without storing archived page text.
- Phase 4 has a bounded local analytical/search layer: `pnpm kb:tables` writes CSV tables, Parquet tables, and `data/knowledge-base/processed/knowledge-base.sqlite`; `pnpm kb:index` builds `data/knowledge-base/indexes/source-documents-keyword-index.json` using metadata plus previews of stored text; `pnpm kb:search "<terms>"` queries the local keyword index.
- Phase 4 now derives author, citation, venue, institution, collection, and topic tables from current normalized local records and raw snapshots; source-provided names and references still need normalization before strong identity or citation-network claims.
- Phase 4 now has a deterministic candidate identity layer: `pnpm kb:tables` writes `canonical_people` clusters from normalized source-author names and `work_references` clusters from citation/reference DOI, OpenAlex ID, or source-label keys, with limitations documented in `data/knowledge-base/audits/identity-resolution.{json,md}`.
- Phase 4 now has SQLite FTS retrieval over metadata and stored local text content: `pnpm kb:search:sqlite "<terms>"` queries `source_documents_fts` and `pages_fts` in `data/knowledge-base/processed/knowledge-base.sqlite` with ranked snippets.
- Phase 4 now has deterministic offline vector-style retrieval: `pnpm kb:index:semantic` builds a small manifest at `data/knowledge-base/indexes/semantic-hash-index.json` plus deterministic shard files under `data/knowledge-base/indexes/semantic-hash-index/`, and `pnpm kb:search:semantic "<terms>"` searches rights-filtered metadata and stored text.
- Phase 5 has a reusable local-data workbench: `pnpm kb:question "<question>"` writes a local-data brief, source map, evidence file, query sketch, missing-data memo, `date-coverage.json`, `publication-concept.json`, and `study-template.md` under `docs/research-briefs/`. It infers source-class priorities from the question, records the routing decision in `source-map.json`, boosts institutional, scholarly, cultural-collection, linked-open-data, or text-corpus evidence, and separates content-year coverage from fetch-year coverage before suggesting longitudinal claims.
- Phase 5 now has a brief-to-experiment promotion path: `node scripts/kb-promote-brief-experiment.mjs` converts local-data briefs into first-pass `docs/experiments/kb-*` experiment scaffolds with copied SQL/source maps, readiness gates, article outlines, claim checklists, evidence samples, and missing-data memos. The first promotion run created five experiment candidates for department visibility/public humanities, scholarly digital/public humanities literature, museum metadata, cultural entity field maps, and public-domain canon/text studies.
- The first promoted experiment now has a runnable analysis/report pipeline: `docs/experiments/kb-humanities-departments-visible-faculty-events-news-public-humanities-lan/scripts/build-analysis.mjs` reads the local KB pages/rights tables plus stored local-analysis text, writes coverage and term-family CSVs, and produces `reports/result.json`, `reports/work.md`, and `reports/public-draft.md`.
- Phase 6 has bounded maintenance automation: `pnpm kb:refresh` validates, inventories, refreshes bounded source-specific metadata routes, refreshes department sitemap summaries, runs a bounded Wayback CDX smoke with explicit timeout/limit settings, rebuilds analytical tables and both indexes, refreshes coverage/rights/stale-source/blocked-source audits, updates KB status, and writes a local question-smoke brief to prove the rebuilt KB can answer a question.
- Phase 6 now distinguishes active route failures from resolved historical failures: `pnpm kb:audit:blocked` reads successful ingest runs as well as failed routes, records AHA/LARB/Wayback/DOAJ/Princeton/Columbia/expanded-university/UChicago/Harvard/Smithsonian/HathiTrust and other resolved historical failures, recognizes documented retired-route replacements such as LARB homepage metadata replacing the stale `/feed/` route, treats Smithsonian `DEMO_KEY` 429s as cooldown failures when a prior successful route exists, treats successful university department replacement routes as source-level recovery while retaining failed target URLs for cleanup, and leaves 1 active source-level replacement plan.
- Phase 3/6 now has source-specific department route replacement accounting: `pnpm kb:ingest:departments` emits per-source success records when alternate public department routes work. Princeton now has public event-page replacements for English, Philosophy, and Art and Archaeology. The expanded university source now has public replacement text for Berkeley History, Berkeley Rhetoric, Penn English, and additional discovered Duke English pages. UChicago now has public Humanities Division news/events replacement pages for absent sitemap routes. Harvard now has central program-page replacements for English, History, Philosophy, and Classics. SSRN remains active permission-review work.

Current local footprint as of the latest local status:

- 34 registered sources.
- 32 registered sources with local documents.
- Registry statuses: 29 active, 2 blocked, 3 seeded-from-experiment.
- 6562 source documents.
- 2975 works.
- 1779 source-provided authors.
- 1713 deterministic candidate canonical people, including 61 multi-record clusters and 4 multi-source clusters.
- 2274 venues.
- 17 institutions.
- 40 derived collections.
- 34859 source-provided citation/reference edges.
- 25204 deterministic candidate work-reference clusters, including 19011 high-confidence DOI/OpenAlex-keyed references and 3765 repeated references.
- 1062 source-provided topics.
- 1012 cultural objects.
- 533 department/web page rows, including 264 local-analysis department/web rows, 234 rows with stored text files, and 269 remaining metadata-only sitemap URL rows.
- 56 department summaries.
- 6562 rights rows.
- 18 Los Angeles Review of Books metadata records from the public homepage replacement route, with article text still excluded.
- 20 American Historical Association annual-meeting metadata records from public WordPress JSON replacement routes, with program/page text still excluded.
- 2539 records from the dedicated DOAJ humanities ingest, including 1450 article records and 1089 journal records from 32 raw article/journal API route responses.
- 757 Wikidata cultural entity records across authors, artists, philosophers, works, movements, genres, institutions, journals, and humanities concepts.
- 505 additional cultural-collection object records from the dedicated Met/Cleveland/Library of Congress/Smithsonian ingest; Met object-detail routes partially succeeded and blocked object IDs are retained in the ingest audit.
- 5 HathiTrust Bibliographic API metadata records linked from Internet Archive humanities candidates; HathiTrust full text is still excluded.
- 200 public-domain Project Gutenberg text files imported from the local Gutenberg experiment cache.
- 3 strict homepage Wayback CDX department-page snapshot metadata records from the latest bounded refresh smoke, with broader Wayback acquisition kept as a source-specific job because some CDX routes time out or fail.
- 422 local text files.
- 14/14 staging JSONL tables.
- 14/14 processed Parquet tables.
- SQLite FTS indexes metadata for the broader corpus plus stored local text content for public-domain books and local-analysis department/web pages.
- Semantic hash index covers 6531 rights-filtered documents across deterministic shard files, including public-domain full-text records, local-analysis page-text records, and metadata-only sitemap URL records.
- SQLite analytical database at `data/knowledge-base/processed/knowledge-base.sqlite`.
- Keyword index at `data/knowledge-base/indexes/source-documents-keyword-index.json`.
- Five first-pass promoted experiment scaffolds under `docs/experiments/kb-*`, indexed by `data/knowledge-base/audits/promoted-experiments.md`.
- One promoted experiment with runnable analysis outputs for department visibility/public humanities language, refreshed against 533 page rows and 234 stored-text rows.

This is a foundation and harness, not the complete knowledge base.

Remaining before the full knowledge-base goal is complete:

- Improve candidate person/work identity resolution with authority matching, ORCID/OpenAlex/Wikidata joins, and conflict detection before making strong person-level or citation-network claims.
- Add more broad, source-specific ingest jobs rather than bounded samples, especially humanities centers, deeper conference-program metadata, and further Project Gutenberg/catalog-cultural collection expansion.
- Continue executing the active replacement plan in `data/knowledge-base/audits/failed-route-replacements.md` for SSRN; target-level 403s for Harvard FAS department hosts, Columbia English/Philosophy, Michigan, Penn History, and some Princeton pages remain in `failed-routes.jsonl` even though their source-level replacement status has improved, and Smithsonian should be retried only after cooldown or with a non-demo API key. Do not bypass access controls. Prefer alternate public pages, source-specific sitemap indexes, school directories, RSS/news routes, official APIs, smaller CDX queries, or Wayback metadata when current homepages or default sitemaps block polite fetches.
- Expand university/department web corpus acquisition beyond the current balanced shallow discovery pass; faculty/events/program text coverage is materially improved, Princeton has working event-page replacements, Harvard has central program-page replacements, UChicago has working Humanities Division news/events replacement pages, and the expanded-university source has Berkeley/Penn/Duke replacements, but remaining sitemap-only rows and source-specific directory/RSS routes still need replacement work.
- Expand full text storage only for public-domain or clearly licensed sources.
- Add neural embedding retrieval later if a local model or approved embedding service is configured; the current semantic hash index is deterministic and offline.
- Expand the remaining promoted first-pass experiments into runnable analysis scripts and publication handoff packets after source-specific normalization, rights review, and claim adjudication.
- Expand refresh/staleness automation from bounded source smokes to source-specific active-route schedules, including route replacement for 403/404 department pages.

Next build steps:

1. Add source-specific replacement routes for blocked Harvard/Columbia department pages and remaining sitemap-only department URLs while retaining rights and route manifests.
2. Add explicit replacement memos for remaining blocked 403 department and bibliographic metadata routes, using alternate public routes or Wayback metadata where available.
3. Expand broad metadata acquisition for OpenAlex/Crossref, Project Gutenberg, and cultural-collection APIs; DOAJ and Wikidata now have dedicated routes but should be expanded beyond the current page limits when needed.
4. Execute the source replacement plans for blocked/stale/403 routes and promote successful replacements into source-specific ingest configs.
5. Convert the promoted first-pass experiments into runnable analysis/report pipelines only after confirming source-class coverage, dates, and quote/rights limits.
