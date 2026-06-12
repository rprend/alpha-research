# Cultural Observatory Research Program Plan

## Purpose

Build a public research program and publication engine for data-driven essays about cultural, intellectual, literary, institutional, and scholarly change over time.

The working product concept is not simply "quantitative humanities." That phrase is accurate but too method-forward. The public-facing promise should be broader:

> Use archives, bibliographic data, longitudinal corpora, and AI-assisted research agents to find patterns in culture and scholarship that ordinary reading misses, then publish inspectable essays with evidence, caveats, and reusable datasets.

The first corpus build still matters, but it serves a larger goal: a Substack/site where the author publishes findings, field maps, and study directions under a sharper editorial identity.

## Naming And Editorial Positioning

Avoid leading with "quantitative humanities" as the brand name. It sounds dry, defensive, and academic, and it over-centers method instead of discovery.

Candidate names:

- Archive Signals
- The Cultural Observatory
- The Shape of Thought
- Canon Drift
- The Drift
- Patterns in the Archive
- What Changed?
- Cultural Time Series
- The Moving Canon
- The Measure of Culture
- The Discourse Map
- Signals from the Archive
- Observatory of Ideas

Recommended naming direction:

- Use `Archive Signals` for a Substack or newsletter voice.
- Use `The Cultural Observatory` for a site, lab, or research-program wrapper.
- Keep `quantitative humanities` as a descriptive tag, not necessarily the title.

Possible tagline:

```text
Essays and datasets on how culture changes.
```

Alternate taglines:

- Measuring the movement of ideas.
- A public notebook for measuring cultural and intellectual change.
- Data-driven essays about ideas, archives, institutions, and canons over time.
- A field guide to cultural change, built from archives and data.

## Program Goals

The program should answer four recurring kinds of questions:

1. What changed?
   - Longitudinal studies of terms, institutions, canons, genres, scholarly fields, and public rhetoric.
2. What is the shape of this field?
   - Literature maps, method maps, venue maps, author/institution networks, and topic clusters.
3. What is being remembered, forgotten, elevated, or displaced?
   - Canon formation, reception history, citation networks, syllabus drift, anthology drift, translation history, and library/archive presence.
4. What should be studied next?
   - AI-assisted research scouts that inspect a field, identify underexplored corpora or questions, and propose concrete studies that might expand the bubble of knowledge.

The publication standard is:

- ask a clear question
- define the corpus
- show the time range
- explain the method
- publish charts/tables where useful
- include representative passages or records
- state limitations plainly
- link to reusable artifacts when possible
- separate what the evidence shows from what it merely suggests

## Editorial Formats

### 1. What Changed?

Longitudinal studies of cultural, institutional, scholarly, or semantic change.

Examples:

- How did university mission statements shift from truth/citizenship language to innovation/impact language?
- How did `democracy`, `civilization`, `empire`, `labor`, `race`, or `nature` change in scholarly and public writing?
- When did `canon` become a problem-word rather than a prestige-word?
- How did museum language around civilization, world culture, repatriation, and decolonization shift?
- How did literary criticism change after theory, identity politics, or AI?

Default outputs:

- time series
- term/context drift
- representative excerpts
- corpus and source caveats
- reusable dataset

### 2. The Map Of A Field

AI-assisted and bibliometric maps of live scholarly domains.

Examples:

- What are people publishing about AI and the humanities?
- Where is quantitative work entering literary studies?
- What are the main clusters in recent classics scholarship?
- What does recent environmental humanities publishing actually discuss?
- Which archives, methods, and periods dominate digital humanities?

Default outputs:

- topic clusters
- representative works
- venue and institution maps
- method map
- open questions
- overlooked areas

### 3. The Moving Canon

Studies of reception, citation, syllabi, anthologies, translation, library presence, and curriculum.

Examples:

- Which authors are rising or falling in syllabi?
- How does the literary canon differ between elite universities and public universities?
- Which philosophers are central in journal citations but absent in teaching?
- How did Arendt, Foucault, Du Bois, Austen, Homer, Confucius, or Marx move across institutions and decades?

Default outputs:

- ranked changes
- cohort comparisons
- institution/source stratification
- citation or assignment networks
- caveated interpretation

### 4. Research Agendas From The Machine

Use AI agents as research scouts, not as authorities.

The agent task is to inspect a field, identify candidate gaps, find source material, and propose studies. The human task is to audit those suggestions against actual evidence and decide what is worth running.

Examples:

- Ten underexplored datasets for studying American religion.
- What would a quantitative history of translation look like?
- Where literary studies has data but no questions.
- Five neglected ways to measure reception.
- What cultural historians could do with library metadata.

Default outputs:

- candidate research questions
- source list
- feasibility assessment
- expected artifacts
- reasons the idea might be wrong
- first runnable study design

## First Three Public Essays

Start with concrete work before publishing a manifesto.

1. What Changed In University Mission Statements?
   - Public, scrapeable, longitudinal, institutionally legible, and easy to explain.
   - Likely sources: archived university pages, current mission/about pages, catalogs, strategic plans, Wayback where feasible.
   - Output: term drift, topic shift, representative quotes, institution clusters.

2. The Rise Of AI And The Humanities
   - Directly explains the research program and uses the literature-radar corpus.
   - Likely sources: OpenAlex, Crossref, DOAJ, Humanities Commons, arXiv, SocArXiv, Project MUSE metadata where available.
   - Output: publication trend, method clusters, venues, fields, representative works, open questions.

3. Canon Drift In Syllabi Or Anthologies
   - More humanities-native and more distinctive.
   - Likely sources: Open Syllabus where available, public syllabi, anthology tables of contents, course catalogs, library holdings.
   - Output: rising/falling authors, institutional differences, period/genre shifts, limitations.

## Alpha Research Role

Alpha Research should be the research operating system for this publication:

- ingest messy public and private datasets
- preserve raw source provenance
- normalize records into reusable tables
- run remote analysis jobs
- generate inspectable artifacts
- produce charts, tables, and structured result files
- let AI agents propose studies, audit source coverage, and draft research plans
- keep every public claim traceable to data and artifacts

Every article should correspond to a durable Alpha Research run or dataset bundle with:

- `report.html`: public or near-public essay artifact
- `result.json`: structured findings and chart/table data
- `work.md`: methods, commands, source notes, caveats, and reproducibility log
- `data/processed/*`: shareable derived tables where licensing allows
- `data/raw/*`: local provenance-preserving raw records, not necessarily public

## Repository And Storage Layout

The first large corpus is the literature-radar dataset. Local project files live under:

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

Goal: define the corpus boundaries before downloading data, with expansion as the default posture.

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

Initial backfill range:

```text
2020-01-01 through current run date
```

The first report should emphasize 2024-present trends, but the downloaded corpus should backfill to 2020 so recent movement can be compared against a real baseline. If a source makes larger backfills cheap and reliable, preserve the larger historical window in raw storage and filter analytically later.

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
   - Begin with a broad but controlled institution/department inventory instead of treating department pages as an afterthought.
   - Build an allowlist of humanities departments, research centers, labs, dissertation pages, faculty publication pages, and news pages.
   - Use department pages both for early signal discovery and later enrichment, while labeling their coverage separately from bibliographic indexes.
   - Store fetched HTML snapshots in `data/raw/department-pages/YYYY-MM-DD/<institution>/<department>/`.

Actions:

1. For each source, run a connectivity and schema probe that fetches enough records to validate pagination, rate limits, and field coverage.
2. Save the exact request URL, timestamp, response status, and response path in `reports/source-inventory.csv`.
3. Record missing fields and access constraints in `reports/source-inventory.md`.
4. Mark each source as one of:
   - `core`: reliable for repeatable monitoring
   - `supplemental`: useful but partial
   - `web-crawl`: useful through public page snapshots with separately labeled coverage
   - `exclude`: too brittle, restricted, or noisy

Acceptance check:

- Each retained source has a reproducible fetch command and a visible raw file on disk.
- Department pages have a source coverage note, crawl manifest, and extraction confidence label rather than being omitted from the main plan.
- Probe fetches are for schema validation only; they do not define the final corpus size.

## Phase 2: Broad Corpus Backfill

Goal: build a broad 2020-present humanities and humanities-adjacent metadata corpus, then produce 2024-present trend slices from it.

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

- OpenAlex: 250,000 to 2,000,000 works, depending on topic and source filters.
- Crossref: 100,000 to 1,000,000 works, with DOI and publisher metadata used for dedupe and venue coverage.
- DOAJ: 25,000 to 250,000 article and journal records where humanities/social-science filters are available.
- Humanities Commons / CORE: all accessible matching records for 2020-present, expected range 5,000 to 50,000.
- SocArXiv: all accessible matching records for 2020-present plus relevant older high-citation records, expected range 2,000 to 25,000.
- arXiv: all matching computational humanities, cultural analytics, NLP-for-humanities, authorship, archive, and stylometry records, expected range 2,000 to 25,000.
- NBER: all matching working papers and relevant metadata for economic history, culture, institutions, religion, education history, migration, slavery, colonialism, and long-run historical data, expected range 2,000 to 20,000.
- department pages: 1,000 to 10,000 public pages across top humanities departments, research centers, labs, dissertation pages, faculty publication pages, and event/news archives.

The exact numbers should be adjusted upward when a source supports reliable bulk access. Sampling is used for validation, not for limiting ambition. Large raw pulls are acceptable when manifests, source labels, and dedupe rules preserve provenance.

Collection waves:

1. Wave A: OpenAlex, Crossref, and DOAJ broad backfill.
2. Wave B: Humanities Commons, SocArXiv, arXiv, and NBER specialty backfill.
3. Wave C: department and research-center web crawl.
4. Wave D: citation/reference expansion from high-signal works, constrained by provenance and date filters.
5. Wave E: targeted gap filling for undercovered journals, books, chapters, non-US institutions, and non-English scholarship.

Acceptance check:

- Every raw record can be traced to a source, request, and fetch manifest.
- No secret-bearing files are written under `docs/experiments/`.
- The first processed corpus is large enough to support trend analysis by year, source, venue, method, and topic without relying on handpicked examples.

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

## Phase 6: Field Map And Article Artifact

Goal: produce the first article-ready field map for the publication, with enough supporting evidence to become both a public essay and an Alpha Research artifact.

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
10. A publishable argument: what changed, what is newly visible, or what the field appears to be missing.
11. Article notes: headline candidates, chart candidates, caveats to preserve in public copy, and source links safe to publish.

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
- The report can be turned into a Substack/site post without rerunning the analysis.

## Phase 7: Public Essay Pipeline

Goal: turn research artifacts into a repeatable publishing workflow.

For each public essay, create:

```text
docs/experiments/<essay-slug>/
  README.md
  data/
    raw/
    interim/
    processed/
  reports/
    report.html
    result.json
    work.md
    public-draft.md
    charts/
    tables/
  scripts/
```

Each essay begins with a one-page study spec:

- working title
- editorial format: `what-changed`, `field-map`, `moving-canon`, or `research-agenda`
- research question
- claim the essay might support
- corpus and time range
- sources to collect
- units of analysis
- expected charts/tables
- representative examples needed
- known caveats
- publication decision: what would make the essay worth publishing?

Every public draft should include:

- one sentence thesis
- corpus note
- method note
- 2 to 5 central findings
- 1 to 3 charts or tables
- representative records or excerpts
- limitations
- "what to study next"

Acceptance check:

- A completed essay folder has both a research artifact and a public-facing draft.
- Claims in `public-draft.md` point back to `result.json`, charts, tables, or source records.

## Phase 8: Department Page Enrichment

Goal: add institution-level color after the core corpus exists.

Do this after Phase 6 identifies high-signal authors, institutions, and topics, or earlier when a public essay requires institution-level evidence.

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

## Phase 9: Recurring Monitor

Goal: convert the broad corpus build into a repeatable monthly or weekly monitor.

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

## Phase 10: Alpha Research Dataset Registration

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

## Initial Essay And Experiment Briefs To Generate

The first field map should produce short essay and experiment briefs for:

1. AI and archives in the humanities.
2. Quantitative canon formation using syllabi, anthologies, citations, or library metadata.
3. Concept drift in humanities keywords such as democracy, civilization, empire, labor, race, and nature.
4. Computational reception history for authors, texts, and theorists.
5. Translation analysis across editions and historical periods.
6. Citation and influence networks in political theory, literary studies, or classics.
7. Institutional language change in universities, museums, and foundations.
8. Humanities-adjacent economic history from NBER and related sources.
9. University mission statement drift.
10. Museum and archive language drift.
11. Field-map essays for AI and the humanities, environmental humanities, public history, and digital humanities.

Each brief should include:

- research question
- why it matters
- likely data sources
- required transformations
- expected outputs
- quality risks
- first high-leverage runnable corpus build
- likely public essay angle
- title candidates

## Risks And Controls

- Coverage bias: Open indexes may underrepresent books, chapters, non-English scholarship, and paywalled journals. Reports must label coverage clearly.
- Scraping risk: Department pages and publisher pages may be brittle or restricted. Prefer APIs and public metadata exports.
- False trend risk: Indexing lag can look like topic decline. Compare sources and date windows carefully.
- Classification drift: LLM or heuristic labels must include evidence and uncertainty fields.
- Copyright risk: Store metadata and short excerpts only unless a source explicitly provides open full text.
- Secret handling: Do not store API keys, session tokens, cookies, or private credentials in the experiment directory.

## V1 Corpus Definition Of Done

The v1 corpus build is done when these files exist and pass inspection:

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
- which public essays are worth publishing next
- which Alpha Research demos are worth running next
