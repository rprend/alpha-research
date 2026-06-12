# Cultural Observatory Implementation Index

The Cultural Observatory / Archive Signals program is a public research and publishing system for data-driven essays about cultural, intellectual, literary, institutional, and scholarly change over time.

## Operating Direction

The program goal is a publishing engine, not a small demo catalog. Small pulls are acceptable for source probes, schema discovery, and smoke tests; public claims should come from broad backfills, full-source harvests where access permits, recurring monitors, or clearly labeled feasibility artifacts.

Working brand direction:

- `Archive Signals` for the essay/newsletter voice.
- `The Cultural Observatory` for the research-program and dataset wrapper.
- `quantitative humanities` as a descriptive tag, not the main title.

Current production priorities:

1. Publish from the existing copyedit-ready handoffs.
2. Upgrade bounded corpora to publication-scale or full-source corpora where the source permits it.
3. Prove every registered dataset can support remote Alpha Research runs that cite source records.
4. Convert successful one-off pipelines into recurring monitors.
5. Use AI research scouts to propose new study directions, then require human source audits before promoting them into experiments.

Scale tiers used across this index:

- `schema-probe`: validates access and fields only.
- `pilot-corpus`: proves normalization, classification, and chart shape.
- `publication-corpus`: broad enough to support the stated essay claim.
- `monitor-corpus`: repeatable publication corpus with a baseline for new or changed records.
- `full-source-corpus`: all safely accessible records from a source.

## Implemented Tracks

### Publication Queue

Path: `docs/experiments/publication-queue/`

Status: program-level editorial queue generated from experiment readiness artifacts.

Implemented:

- publication queue generator
- queue JSON/CSV/Markdown outputs
- editorial calendar draft
- ready vs source-work grouping
- priority scoring from readiness, drafts, charts, and editorial lane
- publication handoff detection for copyedit-ready essays

Current queue:

- 6 tracked essay/research artifacts
- 6 ready for editorial review
- 0 not ready for publication
- 6 copyedit-ready handoff packets
- first public essay candidate: What A Museum Collection Looks Like When It Becomes Data

Next implementation moves:

- copyedit the Cleveland handoff into a first post
- copyedit the literature radar, museum language drift, mission drift, canon drift, and dataset registry handoffs into posts
- choose which Cleveland charts to publish
- add second-layer source corpora for the longitudinal posts after the first copyedit pass

### Research Backlog And Scout Workflow

Path: `docs/experiments/research-backlog/`

Status: program queue and completed scout-run workflow for turning AI-assisted study proposals into source-probed experiment folders.

Implemented:

- machine-readable study backlog
- research-scout prompt template
- completed research-scout run artifact folder
- deterministic scout-run builder
- selected-briefs output
- audit questions for rejecting weak ideas
- status vocabulary from `idea` through `publishable` and `blocked`

Current backlog items:

- What Universities Say They Are For
- The Rise Of AI And The Humanities
- The Language Of Museums After Decolonization
- Canon Drift: A Feasibility Report
- What Counts As A Humanities Dataset?
- When Museums Started Explaining Repair
- The Strategic Plan University
- What Humanities AI Actually Studies
- The Anthology Table Of Contents As Canon Sensor
- The Afterlife Of Humanities Datasets

Current scout run:

- path: `docs/experiments/research-scouts/2026-06-12-cultural-memory/`
- proposals: 5
- selected briefs: 5
- audit decisions: 3 accepted, 2 narrowed
- output files: `prompt.md`, `source-context.md`, `proposals.json`, `audit.md`, `selected-briefs.md`

Next implementation moves:

- turn the museum annual-report and university strategic-plan briefs into experiment folders
- add source-probe commands for the humanities AI corpora map and anthology TOC pilot
- use the dataset-afterlife brief as the next research-agenda artifact after the first public dataset-registry post

### Humanities Literature Radar

Path: `docs/experiments/humanities-literature-radar/`

Status: runnable v1 corpus and field-map artifact.

Implemented:

- source configs
- recurring monitor config
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
- `post.md`
- `post-evidence-audit.json`
- `publication-handoff.md`
- `dataset_briefing.md`
- `dataset-bundle/` Alpha Research dataset bundle
- `registration/control-plane-registration.json`
- `registration/remote-smoke-run.json`
- `runs/2026-06-12/` bootstrap monitor
- one-command `run-pipeline.mjs` smoke/v1 runner

Current committed corpus:

- 1,951 deduped works
- 1,155 works dated 2024-present
- 593 quantitative/computational humanities candidates
- sources represented in processed records: arXiv, Crossref, OpenAlex, DOAJ, OSF Preprints / SocArXiv, Knowledge Commons Works / Humanities Commons
- monitor baseline: 1,951 records absent from bootstrap baseline, including 1,155 genuinely new publications and 796 newly discovered old records
- dataset registration: stable id `humanities-literature-radar`, Modal bundle synced, control-plane profile attached with 26 schema fields and 10 sample rows, live dataset row promoted to `ready`/`ready` with manifest `/data/datasets/humanities-literature-radar/manifest.json`
- remote smoke run: `d866dce5-a99b-459f-a932-a0aff4fec638`, status `ready`, with mounted dataset files inspected and valid `report.html`, `result.json`, and `work.md` artifacts returned
- publication post: `reports/post.md`, a polished field-map draft titled `AI Is Now A Humanities Object`
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 4/4 representative citations matched processed source records
- readiness: ready for editorial review with source-coverage caveats

Next implementation moves:

- final editorial review for `reports/post.md`
- use the remote smoke run as proof that the dataset can support Alpha Research questions from processed source records
- run the recurring monitor after the next broad backfill with `--prior-works`
- replace bounded DOAJ search with public dump or OAI-PMH harvest
- improve NBER extraction or switch to an official metadata route if available
- expand OSF/SocArXiv beyond bounded title search
- expand Knowledge Commons Works / Humanities Commons beyond bounded keyword search
- manually audit representative works

### University Mission Statement Drift

Path: `docs/experiments/university-mission-statement-drift/`

Status: runnable `What Changed?` article baseline with current pages, a Wayback historical layer, audit packet, and publication handoff.

Implemented:

- current public page source list
- Wayback target source list
- curated historical Wayback target source list
- term-family taxonomy
- current-page fetcher
- merge-safe Wayback snapshot fetcher with request timeouts
- exact Wayback snapshot fetcher for hand-curated archived pages
- current and historical page processing
- page-level term counts
- term-family-by-year table
- audit packet
- publication handoff with corpus notes, historical snapshot table, and public-claim checklist
- readiness gate
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- `post.md`
- `post-evidence-audit.json`
- `publication-handoff.md`
- `dataset_briefing.md`

Current committed corpus:

- 10 current university pages
- 12 historical Wayback snapshots
- year range: 2000-2026
- term families: truth/knowledge, civic/public, innovation/impact, global/leadership, excellence/prestige, inclusion/belonging, career/economy
- publication post: `reports/post.md`, a polished source-layer methods draft
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 23/23 source, term, year, and audit checks passed
- readiness: ready for editorial review with source-layer caveats

Next implementation moves:

- final editorial review for `reports/post.md`
- add university catalogs
- add strategic plans
- add president speeches
- separate source layers by genre
- hand-audit snippets before public claims

### Museum Language Drift

Path: `docs/experiments/museum-language-drift/`

Status: longitudinal source probe with current pages, historical Wayback snapshots, report, audit packet, readiness gate, and publication handoff.

Implemented:

- 42-page museum source allowlist
- exact excluded-page config for weak extracted rows
- current-page fetcher
- Wayback target config
- Wayback snapshot fetcher
- exact Wayback snapshot fetcher for hand-curated archived pages
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
- `post.md`
- `post-evidence-audit.json`
- `publication-handoff.md`
- audit packet
- readiness gate

Current corpus:

- 28 current public museum pages after excluding weak extracted rows
- 12 historical Wayback snapshots from hand-curated archived pages
- 14 museums represented
- year range: 2005-2026
- current source genres represented: about, collection, education, exhibition, and research pages
- audit packet: 0 flagged rows after weak-page exclusions
- publication handoff: ready for copyedit as a source-caveated longitudinal post
- publication post: `reports/post.md`, a polished source-layer methods draft
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 28/28 source, term, genre, and audit checks passed
- readiness: ready for editorial review with source-layer caveats

Next implementation moves:

- final editorial review for `reports/post.md`
- add annual reports as a separate source layer
- add provenance/repatriation pages that are fetchable without browser challenges
- build source-genre-specific trend lines before stronger temporal claims
- review source snippets by hand before quoting

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
- `post.md`
- `post-evidence-audit.json`
- publication handoff with evidence blocks, blocked-source notes, and public-claim checklist
- readiness gate
- one-command pipeline runner

Current corpus:

- 13 source probes
- 11 accessible probes
- 5 signal types: teaching, anthologization, holdings-or-collections, holdings-or-editions, citation-or-scholarly-discussion
- publication handoff: ready for copyedit as a methods piece
- publication post: `reports/post.md`, a polished feasibility/methods draft
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 21/21 source and signal checks passed
- readiness: ready for editorial review as a feasibility/methods artifact

Next implementation moves:

- final editorial review for `reports/post.md`
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
- generated study specs for ready-now candidates
- source inventory
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- `post.md`
- `post-evidence-audit.json`
- `study-specs.md`
- publication handoff with ready-now examples, editorial frame, and public-claim checklist
- readiness gate
- one-command pipeline runner

Current corpus:

- 15 candidate humanities corpora
- 11 accessible candidates in the latest run
- 6 ready-now candidates
- 5 ready-now study specs generated
- domains represented: museum collections, linked open data, archives/library, teaching syllabi, books/literature, newspapers, data repositories, scholarly repositories, books/library, books/media/web, aggregated archives
- publication handoff: ready for copyedit as a research-agenda piece
- publication post: `reports/post.md`, a polished research-agenda draft
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 21/21 registry, ready-now, blocked-source, and study-spec checks passed
- readiness: ready for editorial review as a research-agenda artifact

Next implementation moves:

- final editorial review for `reports/post.md`
- add file-level and pagination probes for the highest-ranked APIs
- add explicit licensing notes before publishing derived datasets
- turn one ready-now corpus into a first public essay

### Cleveland Museum Collection Shape

Path: `docs/experiments/cleveland-museum-collection-shape/`

Status: first runnable study generated from the Humanities Dataset Registry, ready for editorial review as a single-institution collection-shape essay.

Implemented:

- Cleveland Museum of Art Open Access API fetcher
- 5,000-record bounded sample
- artwork normalization
- department counts
- collection/type/culture counts
- creation-century table
- acquisition-decade table using accession-number year as an audited-risk proxy
- rights/license and image-availability summaries
- SVG chart artifacts for departments, creation centuries, acquisition decades, and image availability
- audit packet for accession-year proxy, explicit accession dates, provenance counts, and image/license checks
- `report.html`
- `result.json`
- `work.md`
- `public-draft.md`
- `post.md`
- `post-evidence-audit.json`
- readiness gate
- one-command pipeline runner

Current corpus:

- 5,000 sampled artwork records
- 68,743 total API records available
- 19 departments represented
- 56 creation-century rows
- 12 acquisition-decade rows
- 4 chart artifacts
- audit packet: 54 review rows, including 229 accession-year proxy mismatches across the full sample
- publication handoff: ready for copyedit with chart captions and claim checklist
- publication post: `reports/post.md`, a polished single-institution collection-shape draft
- post evidence audit: `reports/post-evidence-audit.json`, status `pass`, 15/15 count, chart, and caveat checks passed
- 87.2% of sampled records have an image
- readiness: ready for editorial review with single-institution and sample-size caveats

Next implementation moves:

- fetch the full collection or a larger paginated corpus
- final editorial review for `reports/post.md` as the first public post candidate
- review audit rows before strengthening acquisition-decade claims
- compare against a second open museum API before cross-institution claims

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
