# Archive Signals / Cultural Observatory Research Program Plan

## Purpose

Build a public research program and publication engine for data-driven essays about cultural, intellectual, literary, institutional, and scholarly change over time.

The working product concept is not simply "quantitative humanities." That phrase is accurate but too method-forward. The public-facing promise should be broader:

> Use archives, bibliographic data, longitudinal corpora, and AI-assisted research agents to find patterns in culture and scholarship that ordinary reading misses, then publish inspectable essays with evidence, caveats, and reusable datasets.

The first corpus build still matters, but it serves a larger goal: a Substack/site where the author publishes findings, field maps, and study directions under a sharper editorial identity. The program should not be framed as a demo that proves Alpha Research can handle a few examples. It should be framed as an evidence machine for recurring public essays.

The default posture is full-scale collection where a source permits it. Small pulls are only for schema probes, smoke tests, and cost/rate-limit validation. Public conclusions should come from broad backfills, recurring monitors, or clearly bounded corpora, not deliberately tiny slices.

## Scale Doctrine

This program should not optimize for toy demonstrations. It should optimize for publishable empirical leverage. A dataset is allowed to be small only when the world is small, the source is bounded, or the essay is explicitly a feasibility note. Otherwise, the expected path is:

1. Probe small to understand schema, access, rate limits, and licensing.
2. Backfill as broadly as the source safely permits.
3. Monitor on a recurring cadence.
4. Publish from the broad corpus, not from the probe.

Use these scale tiers in every study spec:

- `schema-probe`: 10 to 500 records, used only to validate access and fields.
- `pilot-corpus`: enough records to test normalization, dedupe, classification, and chart shape; not enough for strong public trend claims unless the source itself is narrow.
- `publication-corpus`: broad enough to support the article's stated claim by year, source, genre, field, or institution.
- `monitor-corpus`: a publication corpus with a repeatable update path and a baseline for detecting new or changed records.
- `full-source-corpus`: all records available from a source under the access terms, when technically and legally feasible.

Every public artifact should name which tier it uses. If a piece uses a pilot corpus, the public claim must be framed as "what this source probe shows" or "what a full study should measure," not as a general fact about the field.

The preferred unit of ambition is a season of accumulating corpora, not isolated scripts. Small slices are acceptable as engineering checkpoints; they are not the research product.

## North Star

Create a publication that can repeatedly answer:

```text
What is changing in culture, institutions, scholarship, and memory, and how can we know?
```

The site/newsletter should combine:

- longitudinal studies of cultural and institutional language
- maps of live scholarly fields
- studies of canons, syllabi, anthologies, citations, libraries, and archives
- AI-assisted research scouting that proposes concrete new studies
- reusable datasets and reproducibility notes behind each public claim

Success is not "many users used Alpha Research." Success is that the author can publish a steady run of source-backed essays that would be difficult to produce by reading alone.

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
- Avoid making the method the brand. Readers should feel the promise is discovery: patterns, drift, memory, and change.

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

## Product Concept

The output should be a Substack/site plus a reusable research archive. The public brand can be `Archive Signals` or `The Cultural Observatory`, with `quantitative humanities` as the category label rather than the masthead.

The public site should have four durable surfaces:

1. Essays: narrative posts with charts, representative records, limitations, and a clear claim.
2. Field maps: living pages for domains such as AI and the humanities, museum language, canon drift, or humanities datasets.
3. Dataset notes: concise data cards for reusable corpora, including source coverage, fields, known gaps, and starter questions.
4. Research agendas: AI-assisted, human-audited proposals for studies that could expand what the field knows.

Alpha Research is the backend evidence system for those surfaces. It should preserve provenance, run remote analyses, generate artifacts, and make it possible to move from a public sentence back to a record, table, chart, or source inventory.

The first public milestone is not "launch a tool." It is to publish a first season of essays where each post leaves behind a durable dataset or run artifact that makes the next post easier.

## Updated Concept: Archive Signals As A Research Publication

The stronger concept is not a blog about "quantitative humanities" as a method. It is a publication that treats culture, institutions, scholarship, and memory as things that leave measurable traces.

Working product:

```text
Archive Signals
Essays and datasets on how culture changes.
```

Site/research wrapper:

```text
The Cultural Observatory
A public research archive behind Archive Signals.
```

The site should publish three kinds of pieces:

1. Findings: evidence-backed essays with a clear claim, such as "What universities now say they are for" or "AI is now a humanities object."
2. Maps: field guides to an intellectual area, such as recent AI-and-humanities publishing, museum language, humanities datasets, or canon-drift signals.
3. Agendas: AI-assisted, human-audited study proposals that identify what could be measured next, what data exists, and what would actually add knowledge.

The point is to create a recurring intellectual product:

- longitudinal studies that show change over time
- broad field maps that tell readers what people are publishing and discussing now
- source inventories that make hidden research infrastructure legible
- study proposals that expand the set of measurable humanities questions
- reusable public artifacts behind the essays

Alpha Research is the operating layer for this: it stores source inventories, runs backfills, keeps processed datasets, runs analyses, generates artifacts, and makes every public claim traceable.

## Non-Negotiable Scale Contract

The plan should not be deliberately nerfed. Small slices are allowed only for these reasons:

- `schema-probe`: to learn fields, access patterns, pagination, robots constraints, and failure modes.
- `smoke-run`: to prove a script, remote run, or dashboard path works.
- `manual-audit-sample`: to estimate extraction quality before trusting a broader corpus.
- `bounded-world`: when the source itself is small or the essay is explicitly about feasibility.

Everything else should aim at the broadest lawful, technically reliable corpus:

- full source backfill when an API, dump, OAI-PMH endpoint, public export, or complete crawl route exists
- multi-year longitudinal windows instead of recent-only snapshots
- source-layer separation rather than arbitrary caps
- recurring monitors after the first broad build
- publication claims gated by corpus breadth, provenance, and audit quality

The research product is not the probe. The research product is the accumulated corpus plus the public interpretation it supports.

Every study folder must label its corpus tier:

```text
schema-probe | pilot-corpus | publication-corpus | monitor-corpus | full-source-corpus
```

Any `schema-probe` or `pilot-corpus` post must be framed as a feasibility or methods essay. Trend claims require `publication-corpus`, `monitor-corpus`, or `full-source-corpus`.

## Operating Thesis

The project has three linked jobs:

1. Build corpora large enough to detect real movement.
2. Turn those corpora into essays with clear, inspectable claims.
3. Use AI agents to expand the research frontier by proposing new corpora, comparisons, and experiments.

This means the work should not stop at a literature review. A literature review is one editorial format inside a broader observatory. The durable product is an accumulating research archive with repeatable pipelines.

Each study should be designed around one of three evidence modes:

- `longitudinal`: compare the same class of documents over time
- `field-map`: map a scholarly or cultural domain at a point in time, then monitor it
- `research-scout`: have agents inspect a field and propose source-backed experiments, then audit the proposals manually

The public voice should be essayistic and curious. The backend should be boringly rigorous: manifests, raw snapshots, normalized tables, readiness gates, and artifact bundles.

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

## First Season

Think in seasons rather than isolated experiments. A plausible first season has six publishable pieces:

1. `What Universities Say They Are For`
   - Longitudinal mission/about-page drift.
   - Shows the core format: time, language, institutions, caveats.

2. `The Rise Of AI And The Humanities`
   - Field map of recent publishing, preprints, repositories, and computational-humanities venues.
   - Shows how Alpha Research can turn a messy field into a navigable map.

3. `What Counts As A Humanities Dataset?`
   - Research-scout essay on reusable corpora: syllabi, catalogs, newspapers, letters, museum collections, library holdings, translations, anthologies, bibliographies.
   - Good bridge between public readers and future research directions.

4. `Canon Drift: A Feasibility Report`
   - Not a premature grand claim. A precise map of what sources can and cannot support: Open Syllabus, public syllabi, anthology TOCs, citation data, library holdings.

5. `The Language Of Museums After Decolonization`
   - Longitudinal institutional language study using museum pages, exhibition descriptions, collection notes, annual reports, and archived pages.

6. `Where The Quantitative Humanities Already Exists`
   - A field-map essay using literature-radar outputs to show where computational and quantitative methods are already active, and where traditional questions could be made measurable.

Each piece should leave behind an experiment folder, source inventory, processed table, report, public draft, and follow-up queue.

## Current Implementation Status

As of 2026-06-12, the program has moved beyond planning. The repository contains a working Cultural Observatory index and multiple article-ready or near article-ready experiment folders:

- `docs/experiments/humanities-literature-radar/`: v1 field-map corpus for AI, computational, and quantitative humanities publishing, with processed records, report, public draft, publication handoff, dataset briefing, dataset bundle, monitor baseline, and Alpha Research control-plane registration.
- `docs/experiments/university-mission-statement-drift/`: longitudinal current-page plus Wayback source layer for a "What Changed?" essay on institutional language.
- `docs/experiments/museum-language-drift/`: longitudinal source probe for museum language around civilization, provenance, repatriation, access, community, and research.
- `docs/experiments/canon-drift-feasibility/`: feasibility artifact for syllabus, anthology, library, and citation signals, framed as a methods piece rather than a premature canon-change claim.
- `docs/experiments/humanities-dataset-registry/`: research-agenda artifact ranking reusable humanities corpora and generating first runnable study specs.
- `docs/experiments/cleveland-museum-collection-shape/`: first museum-collection shape essay from an open museum API, currently bounded but with a clear full-collection upgrade path.
- `docs/experiments/research-backlog/` and `docs/experiments/research-scouts/`: AI-assisted, human-audited proposal workflow.
- `docs/experiments/publication-queue/`: editorial queue and copyedit handoff surface.

The plan from here should therefore emphasize scale-up, publication polish, recurring monitors, and remote-run proof, not another round of abstract source brainstorming.

The post-Season-One research-production backlog is tracked in:

```text
docs/experiments/research-production-roadmap/
```

Run:

```bash
node docs/experiments/research-production-roadmap/scripts/check-roadmap.mjs
```

This roadmap is intentionally separate from the publication queue. Season One posts can be ready for final editorial review while broader corpus backfills, second-layer source layers, monitors, and dataset promotions remain active implementation work.

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

Alpha Research should also maintain a research backlog:

- candidate corpora
- candidate claims
- feasibility notes
- source access status
- scripts needed
- expected publication angle
- readiness state: `idea`, `source-probed`, `corpus-built`, `analysis-ready`, `drafted`, `publishable`, or `blocked`

## Repository And Storage Layout

Use one folder per study, plus a top-level index. The literature-radar dataset is the first field-map corpus, not the whole program. Local project files live under:

```text
docs/experiments/cultural-observatory-index.md
docs/experiments/humanities-literature-radar/
docs/experiments/university-mission-statement-drift/
docs/experiments/<future-study-slug>/
```

Each study should use this structure:

```text
docs/experiments/<study-slug>/
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
    check-readiness.mjs
```

Raw downloads are kept in `data/raw/<source>/<run-date>/` exactly as received, with timestamped filenames or source-stable names. Normalized and derived data are kept separately so the workflow can be rerun without destroying provenance. A pipeline runner may clear and regenerate the current run-date folder only when this behavior is explicit in `work.md` or the script README.

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

Goal: define the publication program and corpus boundaries before downloading data, with expansion as the default posture.

Steps:

1. Maintain `docs/experiments/cultural-observatory-index.md` as the editorial and research-control index for Archive Signals / The Cultural Observatory.
2. For each study, create `docs/experiments/<study-slug>/README.md` with the study question, date range, included source types, and exclusion rules.
3. Create `config/taxonomy.yml` with stable labels for disciplines, methods, periods, geographies, source types, and quantitative-humanities signals.
4. Create `config/queries.yml` with source-specific search terms and filters.
5. Create `config/sources.yml` with one record per source containing:
   - source name
   - access method: API, export, feed, static page, or manual seed list
   - base URL
   - terms/robots notes
   - fields expected
   - rate-limit assumptions
   - whether abstracts/full text are available
   - whether source can be used in recurring monitoring
6. Create a publication spec in each study folder:
   - working title
   - public question
   - likely claim types
   - required evidence tier
   - source layers required before trend claims are allowed
   - chart/table package expected
   - publication decision rule

Initial literature-radar backfill range:

```text
2020-01-01 through current run date
```

The first literature-radar report should emphasize 2024-present trends, but the downloaded corpus should backfill to 2020 so recent movement can be compared against a real baseline. If a source makes larger backfills cheap and reliable, preserve the larger historical window in raw storage and filter analytically later.

Initial longitudinal-study range:

```text
As far back as reliable public archives permit, with 2000, 2010, 2015, 2020, and current-year checkpoints as default anchors.
```

For mission statements, museum language, syllabi, catalogs, and institutional rhetoric, the plan should favor longer horizons over recent-only data. The central value is change over time.

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

- `docs/experiments/cultural-observatory-index.md`
- `config/sources.yml`
- `config/queries.yml`
- `config/taxonomy.yml`
- `reports/source-inventory.md`

Acceptance check:

- A reviewer can tell what will and will not be collected before any crawler runs.
- A reader can tell what public essay or research agenda the corpus supports.
- The study cannot silently become a small demo: the required corpus tier and scale-up path are written before collection begins.

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
5. Record the broadest lawful acquisition route:
   - complete dump
   - full API pagination
   - OAI-PMH harvest
   - sitemap crawl
   - Wayback CDX crawl
   - bounded public search results
   - manual seed list plus crawl
6. Estimate the expected publication-corpus size and the likely storage location before broad fetching.

Acceptance check:

- Each retained source has a reproducible fetch command and a visible raw file on disk.
- Department pages have a source coverage note, crawl manifest, and extraction confidence label rather than being omitted from the main plan.
- Probe fetches are for schema validation only; they do not define the final corpus size.
- Every retained source has a documented path from probe to broad backfill or a written reason why it cannot support broad collection.

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

The exact numbers should be adjusted upward when a source supports reliable bulk access. Sampling is used for validation, not for limiting ambition. Large raw pulls are acceptable when manifests, source labels, and dedupe rules preserve provenance. If a source supports complete export or repeatable paginated harvesting, prefer complete collection over arbitrary caps.

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
- If storage, rate limits, or source restrictions prevent the target range, the blocker is recorded in `reports/work.md` with the largest completed safe corpus and the exact next route.

## Phase 2B: Longitudinal Corpus Backfills

Goal: build the non-literature corpora that make the public project distinctive: studies of how institutional, cultural, and scholarly language changes over time.

Priority longitudinal corpora:

1. University mission/about/values pages.
   - Current pages plus Wayback snapshots.
   - Add catalogs, strategic plans, commencement speeches, and president messages where mission pages are sparse.
   - Store under `docs/experiments/university-mission-statement-drift/data/raw/<source-layer>/<run-date>/`.
   - Required processed fields: `institution`, `source_layer`, `source_genre`, `url`, `archive_url`, `snapshot_date`, `year`, `text`, `raw_path`.

2. Museum and archive language.
   - Museum about pages, exhibition descriptions, collection pages, annual reports, repatriation/provenance pages, and education pages.
   - Store under `docs/experiments/museum-language-drift/data/raw/<source-layer>/<run-date>/`.
   - Required processed fields: `institution`, `source_layer`, `source_genre`, `collection_area`, `url`, `snapshot_date`, `year`, `text`, `raw_path`.

3. Syllabi and course catalogs.
   - Public syllabi, Open Syllabus exports where available, course catalogs, reading lists, and department requirements.
   - Store under `docs/experiments/canon-drift-feasibility/` or a new signal-specific study folder once the source route is selected.
   - Keep assignment-level, course-level, institution-level, and catalog-level data separate.

4. Anthology and canon records.
   - Tables of contents, edition histories, publisher pages, library records, and public teaching materials.
   - Store edition-specific raw records and treat edition year separately from original publication year.

5. Library and archive metadata.
   - Holdings counts, subject headings, named collections, digitization status, and collection descriptions.
   - Use only source routes with clear licensing and redistribution terms for derived metadata.

6. Public-intellectual and review venues.
   - Book reviews, magazine archives, essay venues, and public humanities outlets where licensing and access permit metadata-scale analysis.
   - Prefer metadata, indexes, and citation-like references over full-text storage unless access terms clearly permit it.

For each corpus:

1. Write a one-page study spec before crawling.
2. Probe sources and access terms.
3. Backfill the broadest reliable historical range, with default anchors of 2000, 2010, 2015, 2020, and current year where complete yearly coverage is not available.
4. Store raw records with manifests.
5. Normalize into durable units of analysis.
6. Build a readiness gate that blocks premature public claims when coverage is too thin.
7. Build like-for-like comparison tables before claiming change:
   - same source genre over time
   - same institution or institution cohort over time
   - same metadata field over time
   - same collection or page type over time
8. Add representative excerpts or records for every trend claim.

Acceptance check:

- At least three longitudinal study folders exist with source inventories, raw snapshots, processed tables, and readiness reports.
- The index can show which studies are publishable, which are still source-probing, and which are blocked.
- Each longitudinal essay has a source-layer caveat that prevents comparing unlike sources as if they were one stable corpus.
- Each public trend claim can be audited back to exact records or snapshots.

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

## Phase 6B: AI Research Scout Runs

Goal: use AI to reason about a field and propose studies that might expand the bubble of knowledge, while keeping the agent subordinate to evidence.

For each scout run:

1. Give the agent a bounded field or question.
2. Provide it with source inventories, existing processed tables, and known constraints.
3. Ask for:
   - candidate research questions
   - datasets required
   - transformations required
   - likely failure modes
   - why the study would add knowledge
   - a first runnable corpus build
   - what a null result would mean
   - what competing interpretations the data could distinguish
   - what source would make the study invalid if unavailable
4. Have a second pass audit:
   - whether sources actually exist
   - whether the proposed unit of analysis is measurable
   - whether the claim would be interesting if true
   - whether the likely data can distinguish competing interpretations
   - whether the proposal is just a familiar literature review in disguise
5. Save the result under:

```text
docs/experiments/research-scouts/<run-date>-<field-slug>/
  prompt.md
  source-context.md
  proposals.json
  audit.md
  selected-briefs.md
```

Acceptance check:

- A scout run produces at least three concrete study briefs that can be turned into experiment folders.
- The audit rejects weak ideas explicitly instead of forwarding all agent suggestions.
- Accepted briefs name exact source routes, storage paths, expected artifacts, and the first broad backfill command to implement.

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

Publication readiness gate:

- `source-ready`: sources collected and manifests complete
- `analysis-ready`: processed tables and checks exist
- `draft-ready`: public-draft exists and claims cite artifacts
- `publishable`: evidence is broad enough for the claim, caveats are explicit, and representative records are inspectable
- `not-ready`: source coverage, extraction quality, or analysis support is insufficient

Do not publish from `not-ready` artifacts except as a methods note about what failed or what remains hard to measure.

## Phase 7B: Site And Editorial System

Goal: make Archive Signals / The Cultural Observatory a durable public surface, not just a folder of reports.

Public surfaces:

1. `Archive Signals` essay feed.
   - Narrative posts with charts, representative examples, and limitations.
   - Each post links to a methods note or dataset note when available.

2. `The Cultural Observatory` index.
   - Living map of studies, datasets, source inventories, and research agendas.
   - Public-friendly version of `docs/experiments/cultural-observatory-index.md`.

3. Dataset notes.
   - One public data card per reusable corpus.
   - Include source coverage, fields, date range, caveats, licensing notes, and starter questions.

4. Research agendas.
   - Human-audited AI scout outputs.
   - Each agenda should produce at least one runnable study brief, not just a list of topics.

Repository outputs:

```text
docs/experiments/publication-queue/
  reports/editorial-calendar.md
  reports/season-one-package.md
  reports/season-one-package.json

docs/experiments/<study-slug>/reports/
  post.md
  post-evidence-audit.json
  publication-handoff.md
  dataset_briefing.md
```

Editorial cadence:

- Season One: six posts already packaged for final editorial review.
- Season Two: corpus scale-up posts and first monitor-driven updates.
- Monthly: one new finding or field map.
- Quarterly: one broader research agenda or "what changed" synthesis.

Publication readiness requires:

- post draft
- chart/table package or a clear reason charts are not useful
- post evidence audit
- corpus tier label
- source coverage caveat
- reusable artifact path
- next-study queue item

Acceptance check:

- A reader can enter through the site and understand the claim, corpus, method, caveat, and artifact path without reading repository internals.
- The public brand does not depend on the phrase "quantitative humanities," though that phrase remains available as a descriptive category.
- Every published post leaves behind a stronger dataset, monitor, source inventory, or study brief than existed before the post.

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
