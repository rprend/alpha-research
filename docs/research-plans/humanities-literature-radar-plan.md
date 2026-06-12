# Humanities Literature Radar Plan

## Purpose

Build a repeatable Alpha Research corpus and literature-review workflow for understanding what humanities and humanities-adjacent scholars are publishing now, with special attention to quantitative humanities opportunities.

The first version should answer:

- What topics, methods, corpora, venues, and institutions are prominent in recent humanities publishing?
- Where are computational, quantitative, or data-intensive methods appearing?
- Which debates and research areas look active enough to support Alpha Research demos?
- Which source surfaces are reliable enough for recurring monitoring?

The product output is an inspectable research artifact, not only a scraped dataset: `report.html`, `result.json`, `work.md`, source inventories, normalized tables, topic maps, and candidate experiment briefs.

## Repository And Storage Layout

All local project files for the pilot live under:

```text
docs/experiments/humanities-literature-radar/
```

Use this structure:

```text
docs/experiments/humanities-literature-radar/
  README.md
  config/
    sources.yml
    queries.yml
    taxonomy.yml
  data/
    raw/
      openalex/
      crossref/
      doaj/
      humanities-commons/
      socarxiv/
      arxiv/
      nber/
      department-pages/
    interim/
      normalized-works.jsonl
      normalized-authors.jsonl
      normalized-sources.jsonl
      dedupe-candidates.jsonl
      extraction-inputs.jsonl
    processed/
      works.parquet
      authors.parquet
      sources.parquet
      institutions.parquet
      topics.parquet
      citations.parquet
      representative-works.csv
      quantitative-humanities-opportunities.csv
  reports/
    report.html
    work.md
    result.json
    source-inventory.md
    source-inventory.csv
    topic-map.html
    topic-map.json
    experiment-briefs.md
  scripts/
    fetch-openalex.mjs
    fetch-crossref.mjs
    fetch-doaj.mjs
    fetch-humanities-commons.mjs
    fetch-socarxiv.mjs
    fetch-arxiv.mjs
    fetch-nber.mjs
    fetch-department-pages.mjs
    normalize-works.mjs
    dedupe-works.mjs
    classify-works.mjs
    build-report.mjs
```

Raw downloads are kept in `data/raw/<source>/` exactly as received, with timestamped filenames. Normalized and derived data are kept separately so the workflow can be rerun without destroying provenance.

If this becomes a registered Alpha Research dataset, the deployed dataset should mirror the processed bundle under the dataset mount:

```text
/data/datasets/humanities-literature-radar/
  raw/
  processed/
  reports/
  dataset_briefing.md
```

Remote run scratch files should stay under the runner workspace and final outputs should be copied into the run artifact bundle rather than written directly over source data.

## Phase 0: Scope And Taxonomy

Goal: define the initial corpus boundaries before downloading data.

Steps:

1. Create `docs/experiments/humanities-literature-radar/README.md` with the study question, date range, included source types, and exclusion rules.
2. Create `config/taxonomy.yml` with stable labels for disciplines, methods, periods, geographies, source types, and quantitative-humanities signals.
3. Create `config/queries.yml` with source-specific search terms and filters.
4. Create `config/sources.yml` with one record per source containing:
   - source name
   - access method: API, export, feed, static page, or manual seed list
   - base URL
   - terms/robots notes
   - fields expected
   - rate-limit assumptions
   - whether abstracts/full text are available
   - whether source can be used in recurring monitoring

Initial date range:

```text
2024-01-01 through current run date
```

Initial discipline scope:

- literature
- history
- philosophy
- classics
- religious studies
- art history
- cultural studies
- digital humanities
- linguistics where humanities-facing
- adjacent sociology, anthropology, economics, and political science only when the topic is clearly humanities-relevant

Deliverables:

- `config/sources.yml`
- `config/queries.yml`
- `config/taxonomy.yml`
- `reports/source-inventory.md`

Acceptance check:

- A reviewer can tell what will and will not be collected before any crawler runs.

## Phase 1: Source Inventory And Access Tests

Goal: prove that each source can be accessed safely and determine what fields are realistically available.

Primary sources:

1. OpenAlex
   - Access through the OpenAlex API.
   - Download metadata for recent works using concept/topic/source/institution filters.
   - Store raw API responses in `data/raw/openalex/YYYY-MM-DD/*.json`.

2. Crossref
   - Access through the Crossref REST API.
   - Download DOI metadata for recent journal articles and books/chapters where relevant.
   - Store raw API responses in `data/raw/crossref/YYYY-MM-DD/*.json`.

3. DOAJ
   - Access through DOAJ article/journal metadata surfaces.
   - Download open-access humanities journal and article metadata.
   - Store raw API responses or exported metadata in `data/raw/doaj/YYYY-MM-DD/`.

4. Humanities Commons / CORE
   - Prefer repository search/export/API surfaces where available.
   - Collect metadata for preprints, working papers, conference material, datasets, and repository objects.
   - Store raw responses in `data/raw/humanities-commons/YYYY-MM-DD/`.

5. SocArXiv
   - Collect recent humanities-adjacent social science preprints.
   - Store raw metadata in `data/raw/socarxiv/YYYY-MM-DD/`.

6. arXiv
   - Use only for computational humanities, NLP-for-humanities, cultural analytics, stylometry, archival AI, authorship attribution, and related methods papers.
   - Store raw Atom/API records in `data/raw/arxiv/YYYY-MM-DD/`.

7. NBER
   - Use selectively for economic history, cultural economics, institutions, religion/economics, education history, migration, slavery, colonialism, and long-run historical data.
   - Store metadata records in `data/raw/nber/YYYY-MM-DD/`.

8. Top department pages
   - Do not begin with broad scraping.
   - Build a small allowlist of department publication/news pages only after the indexed-source corpus identifies topics, authors, and institutions worth enriching.
   - Store fetched HTML snapshots in `data/raw/department-pages/YYYY-MM-DD/<institution>/<department>/`.

Actions:

1. For each source, fetch a 20-record sample.
2. Save the exact request URL, timestamp, response status, and response path in `reports/source-inventory.csv`.
3. Record missing fields and access constraints in `reports/source-inventory.md`.
4. Mark each source as one of:
   - `core`: reliable for repeatable monitoring
   - `supplemental`: useful but partial
   - `enrichment`: use only after core corpus exists
   - `exclude`: too brittle, restricted, or noisy

Acceptance check:

- Each retained source has a reproducible fetch command and a visible raw file on disk.
- Department pages are not promoted to `core` unless they provide reliable publication metadata.

## Phase 2: Seed Corpus Download

Goal: build the first 2024-present metadata corpus.

Steps:

1. Run source-specific fetch scripts from `scripts/`.
2. Write raw source files only to `data/raw/<source>/<run-date>/`.
3. Use one manifest per fetch run:

```text
data/raw/<source>/<run-date>/manifest.json
```

Each manifest includes:

- source
- script name and git commit
- run timestamp
- query/filter parameters
- page count
- record count
- response files
- known failures

Initial target sizes:

- OpenAlex: 10,000 to 50,000 works
- Crossref: 5,000 to 25,000 works
- DOAJ: 2,000 to 10,000 works
- Humanities Commons / CORE: 500 to 5,000 records
- SocArXiv: 500 to 3,000 records
- arXiv: 200 to 2,000 records
- NBER: 200 to 2,000 records
- department pages: no more than 100 pages in the pilot

The exact numbers should be adjusted based on source limits and relevance. The pilot should prefer a smaller inspectable corpus over a larger untrusted one.

Acceptance check:

- Every raw record can be traced to a source, request, and fetch manifest.
- No secret-bearing files are written under `docs/experiments/`.

## Phase 3: Normalize And Dedupe

Goal: turn heterogeneous source records into one durable works table.

Steps:

1. Parse source records into `data/interim/normalized-works.jsonl`.
2. Emit companion files:
   - `data/interim/normalized-authors.jsonl`
   - `data/interim/normalized-sources.jsonl`
3. Use these canonical fields for works:
   - `work_id`
   - `source_record_id`
   - `source_name`
   - `title`
   - `abstract`
   - `publication_date`
   - `year`
   - `doi`
   - `url`
   - `open_access_url`
   - `venue_name`
   - `publisher`
   - `work_type`
   - `authors`
   - `affiliations`
   - `institutions`
   - `concepts`
   - `references`
   - `cited_by_count`
   - `license`
   - `raw_path`
4. Dedupe in this order:
   - exact DOI match
   - exact normalized URL match
   - normalized title plus year
   - high-similarity title plus overlapping authors
5. Write possible duplicate clusters to `data/interim/dedupe-candidates.jsonl`.
6. Write final tables to `data/processed/`.

Acceptance check:

- A random sample of 100 normalized records has correct title, date, source, and provenance.
- Duplicate rate and merge rules are summarized in `reports/work.md`.

## Phase 4: Humanities Relevance And Method Classification

Goal: classify works by topic, discipline, method, corpus, and quantitative-humanities relevance.

Steps:

1. Build `data/interim/extraction-inputs.jsonl` with bounded text for each work:
   - title
   - abstract
   - venue
   - source concepts
   - author keywords where available
2. Classify each work against `config/taxonomy.yml`.
3. Extract:
   - discipline labels
   - topic clusters
   - method labels
   - period studied
   - geography studied
   - primary corpus/archive/source material
   - named theorists, authors, artists, or historical figures
   - quantitative/computational signal
4. Write `data/processed/topics.parquet`.
5. Write an inspectable CSV of representative works:

```text
data/processed/representative-works.csv
```

Classification must preserve uncertainty. Use fields such as:

- `label`
- `confidence`
- `evidence_text`
- `evidence_field`
- `needs_review`

Acceptance check:

- At least 50 classified examples are manually reviewed and summarized.
- The report distinguishes traditional humanities, digital/computational humanities, and adjacent quantitative social science.

## Phase 5: Topic Mapping And Trend Analysis

Goal: identify what people are talking about and publishing.

Analyses:

1. Publication volume by month, source, venue, and discipline.
2. Topic clusters and representative works.
3. Method prevalence:
   - close reading
   - archival history
   - philology
   - intellectual history
   - reception history
   - canon studies
   - translation studies
   - cultural analytics
   - stylometry
   - network analysis
   - topic modeling
   - GIS/spatial humanities
   - AI/LLM-assisted humanities
4. Corpus/archive reuse:
   - newspapers
   - books
   - syllabi
   - letters
   - court records
   - museum collections
   - social media
   - oral histories
   - library catalogs
5. Institution and venue mapping.
6. Citation and related-work graph where source data supports it.
7. Emerging-topic detection by comparing recent windows, such as 2024, 2025, and 2026-to-date.

Outputs:

- `reports/topic-map.html`
- `reports/topic-map.json`
- `data/processed/quantitative-humanities-opportunities.csv`

Acceptance check:

- Every major claim in the topic map links back to representative works.
- The trend analysis does not treat source coverage changes as intellectual trends without caveats.

## Phase 6: Literature Review Artifact

Goal: produce the first human-readable literature review.

Write:

```text
reports/report.html
reports/result.json
reports/work.md
```

The report includes:

1. Executive summary.
2. Source coverage and limitations.
3. Main topic clusters.
4. Methods map.
5. Where quantitative humanities is already active.
6. Where traditional humanities questions could become Alpha Research experiments.
7. Representative works table.
8. Venue and institution notes.
9. Open questions and recommended next collection.

`result.json` includes:

- source inventory
- corpus counts
- top topics
- top methods
- representative works
- opportunity briefs
- caveats
- file manifest

`work.md` records:

- commands run
- source fetch dates
- scripts used
- validation checks
- unresolved issues

Acceptance check:

- The artifact bundle can stand alone as an Alpha Research completed run.
- A reader can move from summary claim to supporting works and source files.

## Phase 7: Department Page Enrichment

Goal: add institution-level color after the core corpus exists.

Do this only after Phase 6 identifies high-signal authors, institutions, and topics.

Steps:

1. Create a department allowlist from the topic map.
2. For each institution/department, identify one or two stable pages:
   - faculty publications
   - news
   - research centers/labs
   - recent dissertations
   - events/colloquia
3. Fetch HTML snapshots into:

```text
data/raw/department-pages/<run-date>/<institution>/<department>/
```

4. Extract only public metadata:
   - title
   - author/person
   - date
   - department
   - URL
   - linked DOI or publisher URL
   - page type
5. Normalize into the same works model where possible.
6. Use department pages as enrichment evidence, not as the main source of publication counts.

Acceptance check:

- Department-derived records are labeled separately.
- Reports do not rank departments based on incomplete scrape coverage.

## Phase 8: Recurring Monitor

Goal: convert the pilot into a repeatable monthly or weekly monitor.

Steps:

1. Add a run configuration:

```text
config/monitor.yml
```

2. Store each monitor run under:

```text
docs/experiments/humanities-literature-radar/runs/YYYY-MM-DD/
```

3. For each run, write:
   - `manifest.json`
   - `new-works.parquet`
   - `changed-sources.csv`
   - `report.html`
   - `result.json`
   - `work.md`
4. Compare against the prior processed corpus.
5. Emit:
   - new works
   - newly active topics
   - newly active venues
   - notable method changes
   - candidate Alpha Research experiments

Acceptance check:

- A new run can be reproduced from config without editing scripts.
- The monitor separates newly discovered old records from genuinely new publications.

## Phase 9: Alpha Research Dataset Registration

Goal: make the corpus navigable through the Alpha Research dashboard and remote runs.

Steps:

1. Create a dataset briefing:

```text
docs/experiments/humanities-literature-radar/dataset_briefing.md
```

2. Include:
   - what the corpus contains
   - source coverage
   - date range
   - field list
   - known limitations
   - suggested starter questions
3. Deploy the processed bundle to the dataset mount:

```text
/data/datasets/humanities-literature-radar/
```

4. Register the dataset in the control plane with a stable dataset id:

```text
humanities-literature-radar
```

5. Verify dashboard dataset detail renders the briefing and processed artifact inventory.

Acceptance check:

- The dataset appears as ready for research.
- A remote run can answer a question from the processed tables and cite source records.

## Initial Experiment Briefs To Generate

The first literature review should produce short experiment briefs for:

1. AI and archives in the humanities.
2. Quantitative canon formation using syllabi, anthologies, citations, or library metadata.
3. Concept drift in humanities keywords such as democracy, civilization, empire, labor, race, and nature.
4. Computational reception history for authors, texts, and theorists.
5. Translation analysis across editions and historical periods.
6. Citation and influence networks in political theory, literary studies, or classics.
7. Institutional language change in universities, museums, and foundations.
8. Humanities-adjacent economic history from NBER and related sources.

Each brief should include:

- research question
- why it matters
- likely data sources
- required transformations
- expected outputs
- quality risks
- first small runnable pilot

## Risks And Controls

- Coverage bias: Open indexes may underrepresent books, chapters, non-English scholarship, and paywalled journals. Reports must label coverage clearly.
- Scraping risk: Department pages and publisher pages may be brittle or restricted. Prefer APIs and public metadata exports.
- False trend risk: Indexing lag can look like topic decline. Compare sources and date windows carefully.
- Classification drift: LLM or heuristic labels must include evidence and uncertainty fields.
- Copyright risk: Store metadata and short excerpts only unless a source explicitly provides open full text.
- Secret handling: Do not store API keys, session tokens, cookies, or private credentials in the experiment directory.

## Pilot Definition Of Done

The pilot is done when these files exist and pass inspection:

```text
docs/experiments/humanities-literature-radar/reports/source-inventory.md
docs/experiments/humanities-literature-radar/data/processed/works.parquet
docs/experiments/humanities-literature-radar/data/processed/topics.parquet
docs/experiments/humanities-literature-radar/data/processed/representative-works.csv
docs/experiments/humanities-literature-radar/data/processed/quantitative-humanities-opportunities.csv
docs/experiments/humanities-literature-radar/reports/report.html
docs/experiments/humanities-literature-radar/reports/result.json
docs/experiments/humanities-literature-radar/reports/work.md
```

The final report must make clear:

- what was collected
- what was excluded
- what is genuinely trending
- what is only visible because of source coverage
- which Alpha Research demos are worth running next
