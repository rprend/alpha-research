# Cultural Observatory Implementation Index

The Cultural Observatory / Archive Signals program is a public research and publishing system for data-driven essays about cultural, intellectual, literary, institutional, and scholarly change over time.

## Implemented Tracks

### Research Backlog And Scout Workflow

Path: `docs/experiments/research-backlog/`

Status: program queue for turning AI-assisted study proposals into source-probed experiment folders.

Implemented:

- machine-readable study backlog
- research-scout prompt template
- audit questions for rejecting weak ideas
- status vocabulary from `idea` through `publishable` and `blocked`

Current backlog items:

- What Universities Say They Are For
- The Rise Of AI And The Humanities
- The Language Of Museums After Decolonization
- Canon Drift: A Feasibility Report
- What Counts As A Humanities Dataset?

Next implementation moves:

- expand museum language drift beyond current about pages
- source-probe museum annual reports, exhibition pages, collection pages, provenance pages, and Wayback snapshots
- add a readiness gate before any public claims

### Humanities Literature Radar

Path: `docs/experiments/humanities-literature-radar/`

Status: runnable v1 corpus and field-map artifact.

Implemented:

- source configs
- OpenAlex fetcher
- Crossref fetcher
- DOAJ fetcher
- OSF Preprints / SocArXiv fetcher
- Knowledge Commons Works / Humanities Commons fetcher
- arXiv fetcher
- NBER search-page fetcher
- department-page fetcher
- normalization and dedupe
- heuristic topic/method/signal classification
- representative works table
- opportunity brief table
- source inventory
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- `dataset_briefing.md`
- one-command `run-pipeline.mjs` smoke/v1 runner

Current committed corpus:

- 128 deduped works
- 75 works dated 2024-present
- 45 quantitative/computational humanities candidates
- sources represented in processed records: arXiv, Crossref, OpenAlex, DOAJ, OSF Preprints / SocArXiv, Knowledge Commons Works / Humanities Commons

Next implementation moves:

- replace bounded DOAJ search with public dump or OAI-PMH harvest
- improve NBER extraction or switch to an official metadata route if available
- expand OSF/SocArXiv beyond bounded title search
- expand Knowledge Commons Works / Humanities Commons beyond bounded keyword search
- run a broader 2020-present backfill
- manually audit representative works

### University Mission Statement Drift

Path: `docs/experiments/university-mission-statement-drift/`

Status: runnable `What Changed?` article baseline with current pages plus a sparse Wayback historical layer.

Implemented:

- current public page source list
- Wayback target source list
- term-family taxonomy
- current-page fetcher
- Wayback snapshot fetcher with request timeouts
- current and historical page processing
- page-level term counts
- term-family-by-year table
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- `dataset_briefing.md`

Current committed corpus:

- 10 current university pages
- 4 historical Wayback snapshots
- year range: 2010-2026
- term families: truth/knowledge, civic/public, innovation/impact, global/leadership, excellence/prestige, inclusion/belonging, career/economy

Next implementation moves:

- discover historical URLs rather than relying only on current URLs
- add university catalogs
- add strategic plans
- add president speeches
- separate source layers by genre
- hand-audit snippets before public claims

### Museum Language Drift

Path: `docs/experiments/museum-language-drift/`

Status: longitudinal source probe with current pages, sparse Wayback snapshots, report, audit packet, and readiness gate.

Implemented:

- 42-page museum source allowlist
- current-page fetcher
- Wayback target config
- Wayback snapshot fetcher
- one-command source-probe pipeline runner
- term-family taxonomy for civilization/world culture, provenance/ownership, restitution/repatriation, decolonization/reckoning, access/public, community/inclusion, and research/scholarship
- processed page table
- page-term counts
- term-family-by-year table
- source inventory
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- audit packet
- readiness gate

Current corpus:

- 33 current public museum pages collected in the latest run
- 4 historical Wayback snapshots collected in the latest run; Wayback coverage is sparse and variable
- 14 museums represented
- year range: 2010-2026
- current source genres represented: about, collection, education, exhibition, and research pages
- readiness: not ready for publication because historical coverage and audit flags still need work

Next implementation moves:

- add annual reports as a separate source layer
- add provenance/repatriation pages that are fetchable without browser challenges
- improve Wayback coverage using historical URLs and source-specific stable paths
- clear or explain snippet audit flags before public claims

### Canon Drift Feasibility

Path: `docs/experiments/canon-drift-feasibility/`

Status: source-probed feasibility artifact ready for editorial review as a methods piece, not as a canon-change claim.

Implemented:

- source-probe config for public courseware, Open Syllabus, anthology/publisher pages, Library of Congress JSON, HathiTrust, and WorldCat
- author cohort config for OpenAlex citation/scholarly-discussion probes
- web source probe
- OpenAlex author-search probe
- feasibility matrix
- source inventory
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- readiness gate
- one-command pipeline runner

Current corpus:

- 13 source probes
- 11 accessible probes
- 5 signal types: teaching, anthologization, holdings-or-collections, holdings-or-editions, citation-or-scholarly-discussion
- readiness: ready for editorial review as a feasibility/methods artifact

Next implementation moves:

- choose one author cohort and one signal for a narrow canon pilot
- resolve Open Syllabus export/access before assignment-level claims
- add audited anthology tables of contents before anthologization claims
- add edition-aware normalization before library or anthology trend claims

### Humanities Dataset Registry

Path: `docs/experiments/humanities-dataset-registry/`

Status: source-probed research-agenda artifact ready for editorial review.

Implemented:

- candidate dataset registry
- access and metadata probe
- readiness scoring model
- ranked dataset table
- source inventory
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- readiness gate
- one-command pipeline runner

Current corpus:

- 15 candidate humanities corpora
- 11 accessible candidates in the latest run
- 6 ready-now candidates
- domains represented: museum collections, linked open data, archives/library, teaching syllabi, books/literature, newspapers, data repositories, scholarly repositories, books/library, books/media/web, aggregated archives
- readiness: ready for editorial review as a research-agenda artifact

Next implementation moves:

- create study specs for the top three ready-now corpora
- add file-level and pagination probes for the highest-ranked APIs
- add explicit licensing notes before publishing derived datasets
- turn one ready-now corpus into a first public essay

## Editorial Formats

- `what-changed`: longitudinal study of cultural, institutional, scholarly, or semantic change
- `field-map`: topic, method, venue, institution, and source map of a live field
- `moving-canon`: reception, citation, syllabus, anthology, translation, library, or curriculum drift
- `research-agenda`: AI-assisted research scout for source-grounded study directions

## Publication Standard

Every public essay should have:

- one sentence thesis
- corpus note
- method note
- 2 to 5 central findings
- 1 to 3 charts or tables
- representative records or excerpts
- limitations
- what to study next

Every public claim should point back to `result.json`, a processed table, a source manifest, or an audited snippet.
