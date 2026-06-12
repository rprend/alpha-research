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

- run the first scout pass for museum language drift
- create the museum-language experiment folder
- source-probe museum current pages, annual reports, and Wayback snapshots
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
