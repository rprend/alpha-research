# RISD Graphic Design Syllabus Corpus Implementation Plan

## Objective

Build a RISD Graphic Design corpus that reconstructs the classroom artifact layer: syllabi, weekly schedules, readings, textbooks, project briefs, assignment constraints, critique formats, grading rubrics, tools, student outputs, and tacit studio norms.

The output should not be a degree-map summary. It should answer: "What would a RISD Graphic Design student actually receive, read, make, present, revise, and be critiqued on in each course?"

## Architecture Benchmark

Open Syllabus is the architectural benchmark, but not the product target.

Open Syllabus uses:

- General-purpose crawlers over many seeds
- Custom scrapers for specific sites
- Common Crawl and Internet Archive mining
- Syllabus classification
- Structured span extraction
- Citation parsing and bibliographic linking
- Near-duplicate clustering
- Field classification across academic disciplines

Our current implementation does not match Open Syllabus yet. It is a seed-based RISD-specific crawler. To become useful for tacit knowledge reconstruction, it needs to adopt the relevant Open Syllabus-style steps while staying narrower and deeper for RISD Graphic Design.

The product target is not "more comprehensive than Open Syllabus globally." The target is "more useful than Open Syllabus for reconstructing RISD Graphic Design studio practice."

## Scope

Initial scope:

- School: Rhode Island School of Design
- Program: Graphic Design
- Degree levels: BFA first, then MFA
- Time range: prioritize 2020-present, then backfill 2010-2019, then earlier historical archives when they contain high-value assignments
- Source types: official course pages, catalogs, syllabi, assignment pages, course websites, faculty teaching pages, student work archives, thesis pages, web archives, public commentary

Out of scope:

- Bypassing Canvas, Blackboard, private Google Drive, private Discord/Slack, paywalls, or login walls
- Downloading or redistributing copyrighted readings
- Treating social media or anonymous student comments as verified course facts
- Publishing private student information

## Current State

Implemented script:

- `scripts/risd-graphic-design-corpus.mjs`

Current generated artifacts:

- `docs/research-plans/risd-graphic-design-corpus/sources.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/courses.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/syllabi.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/assignments.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/readings.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/faculty.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/faculty_course_edges.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/student_work.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/source_clusters.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/source_versions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/wayback_captures.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/search_candidates.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/common_crawl_candidates.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/common_crawl_promotions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/faculty_profile_candidates.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/review_queue.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/review_decisions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/field_conflicts.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/needs_followup.md`
- `docs/research-plans/risd-graphic-design-corpus/search_queries.json`
- `docs/research-plans/risd-graphic-design-corpus/course_reconstruction.md`
- `docs/research-plans/risd-graphic-design-corpus/tacit_knowledge_memo.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_curriculum.md`
- `docs/research-plans/risd-graphic-design-corpus/source_audit.md`

Current seed sources include:

- RISD Graphic Design BFA program page
- RISD Graphic Design MFA program page
- RISD Graphic Design courses page
- RISD Coursedog BFA Graphic Design catalog record
- RISD Teaching & Learning Lab syllabus guidance
- Adam Fein, `Introduction to Graphic Design`, `GRAPH-W336-01`, Wintersession 2021 syllabus PDF
- John Caserta, `Design Studio 1`, 2016 class page
- `ds1618.risd.gd` Design Studio 2016-18 archive and printable book view
- Type Two 2015 public syllabus PDF
- Web Type Spring 2022 public syllabus
- RISD GD Spring 2019 elective page
- John Caserta student work archive
- RISD story on `In Motion: Design for Video and Animation`

Known gaps:

- Discovery is still seed-based.
- Citation extraction is heuristic.
- Assignment extraction is currently snippet-based, not structured enough.
- Search candidate import is supported through local JSON/JSONL exports, but no live search API provider is wired yet.
- A bounded Common Crawl candidate, promotion, and ingestion pass exists, but it is still capped and should be expanded carefully.
- Faculty/course edges are derived from course evidence, and bounded RISD faculty-profile candidate discovery/ingestion is implemented. Faculty-portfolio expansion is still capped to curated public hints and should be expanded carefully.
- Near-duplicate clustering is implemented as a review artifact, but clusters are not yet used to collapse generated course packets.
- Manual review artifacts exist, but human decisions have not been filled in yet.
- A generated self-study curriculum artifact exists, but it remains bounded by current public evidence and should expand as more course artifacts are recovered.

## Required End State

The RISD corpus is useful when it can produce, for every recovered course:

- Course code, title, degree level, credits, instructor, term, and meeting pattern
- Source type and evidence grade
- Full syllabus fields when available
- Weekly topic and assignment schedule
- Required/recommended readings
- Project briefs and deliverables
- Critique and revision format
- Grading rubric or assessment strategy
- Tools/software/materials
- Linked public student work examples
- Tacit skill extraction
- Unknowns and inferred fields clearly marked
- Source IDs for every factual claim

## Data Model

### `sources.jsonl`

One row per discovered source.

Required fields:

- `source_id`
- `url`
- `retrieved_at`
- `source_type`
- `authority`
- `access`
- `fetch_status`
- `content_type`
- `checksum`
- `title`
- `text_length`
- `extraction_status`
- `confidence`
- `notes`

Source types:

- `official_program_page`
- `official_course_index`
- `official_catalog_program`
- `official_syllabus_guidance`
- `syllabus_pdf`
- `syllabus_html`
- `assignment_page`
- `course_site`
- `faculty_profile`
- `faculty_teaching_page`
- `student_work_archive`
- `thesis_archive`
- `social_commentary`
- `wayback_capture`

### `syllabi.jsonl`

Use an Open Syllabus-inspired span model.

Required fields:

- `syllabus_id`
- `source_ids`
- `course_code`
- `course_title`
- `section`
- `term`
- `year`
- `semester`
- `instructor`
- `class_days`
- `class_time`
- `class_location`
- `office_hours`
- `credits`
- `description`
- `learning_outcomes`
- `required_readings`
- `recommended_readings`
- `grading_rubric`
- `assessment_strategy`
- `topic_outline`
- `assignment_schedule`
- `policies`
- `tools`
- `materials`
- `raw_excerpts`
- `evidence_grade`

### `assignments.jsonl`

One row per distinct assignment, project, exercise, or critique prompt.

Required fields:

- `assignment_id`
- `course_code`
- `course_title`
- `syllabus_id`
- `source_ids`
- `title`
- `week_or_date`
- `prompt_excerpt`
- `constraints`
- `deliverables`
- `materials`
- `tools`
- `assignment_type`
- `studio_phases`
- `critique_questions`
- `output_format`
- `evidence_limits`
- `critique_format`
- `revision_expectation`
- `skills_trained`
- `tacit_goal`
- `evidence_grade`

### `readings.jsonl`

One row per reading/resource citation.

Required fields:

- `reading_id`
- `course_code`
- `course_title`
- `syllabus_id`
- `source_ids`
- `raw_citation`
- `title`
- `author`
- `publication_year`
- `publisher_or_source`
- `resource_type`
- `required_or_recommended`
- `week_or_date`
- `canonical_work_id`
- `linking_status`

### `student_work.jsonl`

One row per public student-work artifact.

Required fields:

- `student_work_id`
- `url`
- `source_ids`
- `course_code`
- `course_title`
- `instructor`
- `term`
- `student_name_public`
- `medium`
- `project_title`
- `project_statement_excerpt`
- `assignment_link_confidence`
- `visual_standard_notes`
- `evidence_grade`

### `faculty.jsonl`

One row per public faculty/instructor identity found in official or course-artifact evidence.

Required fields:

- `faculty_id`
- `name`
- `affiliation`
- `department`
- `profile_urls`
- `source_ids`
- `course_codes`
- `course_titles`
- `terms`
- `evidence_grade`

### `search_candidates.jsonl`

One row per query backlog item, curated search seed, or imported search result.

Required fields:

- `candidate_id`
- `query`
- `rank`
- `title`
- `snippet`
- `url`
- `discovered_at`
- `source`
- `status`
- `promoted_source_id`

### `common_crawl_candidates.jsonl`

One row per bounded Common Crawl CDX hit or query failure.

Required fields:

- `candidate_id`
- `query_id`
- `url_pattern`
- `index_id`
- `index_name`
- `discovered_at`
- `url`
- `timestamp`
- `status_code`
- `mime`
- `digest`
- `length`
- `source_type_hint`
- `relevance_score`
- `candidate_status`
- `promoted_source_id`
- `promotion_fetch_status`
- `promotion_extraction_status`
- `error`

### `common_crawl_promotions.jsonl`

One row per Common Crawl candidate promoted into a bounded public fetch attempt.

Required fields:

- `promotion_id`
- `candidate_id`
- `promoted_at`
- `promoted_source_id`
- `url`
- `source_type`
- `authority`
- `confidence`
- `fetch_status`
- `extraction_status`
- `content_type`
- `checksum`
- `title`
- `text_length`
- `notes`
- `error`

### `faculty_profile_candidates.jsonl`

One row per bounded RISD faculty profile or public faculty portfolio/profile candidate.

Required fields:

- `candidate_id`
- `faculty_id`
- `faculty_name`
- `url`
- `candidate_source`
- `matched_on`
- `status`
- `promoted_source_id`
- `extraction_status`
- `discovered_at`
- `ingested_at`

### `faculty_course_edges.jsonl`

One row per faculty-to-course attribution.

Required fields:

- `edge_id`
- `faculty_id`
- `faculty_name`
- `course_code`
- `course_title`
- `term`
- `source_ids`
- `relationship`
- `evidence_grade`

### `source_clusters.jsonl`

One row per exact duplicate, near-duplicate, or related source-family cluster.

Required fields:

- `cluster_id`
- `cluster_type`
- `representative_source_id`
- `source_ids`
- `source_count`
- `course_codes`
- `course_titles`
- `instructors`
- `terms`
- `source_url_families`
- `assignment_schedule_hash`
- `reading_set_hash`
- `normalized_text_hashes`
- `similarity`
- `reason`
- `collapse_recommendation`
- `evidence_grade`

### `source_versions.jsonl`

One row per source with Internet Archive capture evidence.

Required fields:

- `version_id`
- `source_id`
- `current_source_id`
- `current_url`
- `current_status`
- `archive_capture_count`
- `oldest_capture_timestamp`
- `newest_capture_timestamp`
- `fetched_archive_source_ids`
- `fetched_archive_count`
- `comparison_status`
- `current_text_length`
- `archive_text_length`
- `normalized_text_similarity`
- `current_keywords`
- `archive_keywords`
- `added_archive_keywords`
- `removed_archive_keywords`
- `substantive_change_hint`
- `evidence_grade`

### `review_decisions.jsonl`

One row per manual review queue item.

Required fields:

- `decision_id`
- `review_id`
- `status`
- `priority`
- `reason`
- `source_ids`
- `syllabus_id`
- `proposed_action`
- `reviewer`
- `decision`
- `decided_at`
- `notes`

### `field_conflicts.jsonl`

One row per detected contradictory or variant metadata field requiring review.

Required fields:

- `conflict_id`
- `record_kind`
- `entity_key`
- `field`
- `values`
- `record_ids`
- `source_ids`
- `severity`
- `resolution_status`
- `resolution_hint`

## Evidence Grades

- `A`: full public syllabus, course site, or assignment archive with schedule/assignments/readings
- `B`: partial syllabus, course website, assignment brief, or faculty teaching page
- `C`: official course/catalog/program description
- `D`: public student work or official news story that describes outputs but not the full course
- `E`: social/commentary source or inference from adjacent evidence

Every reconstruction must carry an evidence grade. Inferred content must be explicitly marked as inferred.

## Source Ladder

### Tier 1: Official RISD Sources

Primary sources:

- `https://www.risd.edu/academics/graphic-design/bachelors-program`
- `https://www.risd.edu/academics/graphic-design/masters-programs`
- `https://www.risd.edu/academics/graphic-design/courses`
- `https://risd.coursedog.com/programs/cfa6776e92151000bceb55330dc80000`
- RISD Coursedog course records
- RISD Teaching & Learning Lab syllabus guidance
- RISD Digital Commons course catalogs and announcements
- RISD Digital Commons theses
- RISD accreditation/self-study reports that mention syllabus requirements

Implementation requirements:

1. Parse all current RISD Graphic Design course-page offerings, not just seed courses.
2. Preserve period, level, credits, format, instructor, location, status, and section description.
3. Parse archived catalog PDFs when current course listings omit historical courses.
4. Produce a `course_inventory.jsonl` artifact with current and historical course records.

### Tier 2: Public Syllabi, Assignment Pages, And Course Sites

Known high-value seeds:

- `https://ajfein.squarespace.com/s/AdamFein_IntroToGraphicDesign.pdf`
- `https://johncaserta.com/ds1-2016.html`
- `https://ds1618.risd.gd/`
- `https://ds1618.risd.gd/book.html`
- `https://typetwo15.risd.gd/wp-content/uploads/2015/02/Type-2-Syllabus.pdf`
- `https://type.practise.studio/syllabus/`
- `https://webtype.htmlkitchen.net/syllabus/`
- `https://sp19.risd.gd/electives/graphic-design-for-the-web`

Implementation requirements:

1. Crawl discovered public course domains recursively within conservative depth limits.
2. For `*.risd.gd`, fetch linked syllabus, schedule, project, exercise, reading, and archive pages.
3. For course websites, classify each page as syllabus, schedule, project, exercise, reading, resource, or student work.
4. Parse structured weekly rows when present.
5. Parse project briefs into assignment records, not just text snippets.
6. Preserve source URLs for each assignment and schedule row.

### Tier 3: Search Result Ingestion

Search must become a first-class input, not a manual step.

Query families:

```text
site:risd.edu "Graphic Design" "syllabus" filetype:pdf
site:risd.edu "GRAPH" "syllabus" filetype:pdf
site:risd.gd "syllabus"
site:risd.gd "GRAPH"
site:risd.gd "assignment"
site:risd.gd "critique"
site:docs.google.com "RISD" "Graphic Design" "syllabus"
site:github.com "RISD" "Graphic Design" "syllabus"
site:github.com "RISD" "GRAPH"
site:johncaserta.com "RISD" "Graphic Design"
site:*.squarespace.com "RISD" "Graphic Design" "syllabus"
"RISD" "Typography" "syllabus" "Graphic Design"
"RISD" "Design Studio" "syllabus"
"RISD" "GRAPH-W" "syllabus"
"RISD" "GRAPH-" "project"
"RISD Graphic Design" "student work"
```

Implementation requirements:

1. Add `search_results.jsonl`.
2. Support imported search exports and, when configured, a search API provider.
3. Never require secrets in chat; use `~/.codex/scripts/ask-secret.sh` for API keys.
4. Deduplicate candidate URLs before fetch.
5. Record query, rank, title, snippet, URL, and discovery date.
6. Promote search candidates into `sources.jsonl` only after successful public fetch and classification.

### Tier 4: Faculty-Centric Expansion

Implementation requirements:

1. Build `faculty.jsonl` from current RISD profiles, course evidence, and historical catalogs.
2. Build `faculty_profile_candidates.jsonl` from RISD Graphic Design faculty profile URL patterns, the official RISD faculty index, and curated public faculty profile/portfolio hints.
3. Promote only successfully fetched public faculty profiles into `sources.jsonl` as `faculty_profile`.
4. Store profile URLs on the matching `faculty.jsonl` row and keep profile candidates linked to `promoted_source_id`.
5. For each faculty member, search public web for:
   - syllabus
   - course
   - teaching
   - assignment
   - studio
   - Typography
   - Design Studio
   - RISD Graphic Design
6. Follow public faculty portfolio links beyond the curated hint list.
7. Extract course-source-faculty edges into `faculty_course_edges.jsonl`.
8. Use faculty pages for discovery and attribution, not as full syllabus evidence unless they include classroom artifacts.

### Tier 5: Student Work And Thesis Archives

Implementation requirements:

1. Crawl RISD news, exhibition, thesis, and Digital Commons pages relevant to Graphic Design.
2. Crawl public faculty student-work archives.
3. Search public Behance, Cargo, GitHub, Vimeo, YouTube, Are.na, and portfolio pages.
4. Link student work to assignments only when source evidence supports the link.
5. Store project statements and metadata, not full image mirrors unless license/permission is clear.
6. Extract visual/tacit notes: medium, format, project type, material, level of polish, and apparent critique criteria.

### Tier 6: Social Commentary

Implementation requirements:

1. Search Reddit, public blogs, public videos, and public captions for RISD Graphic Design course commentary.
2. Store only URLs and paraphrased summaries unless quoting is permitted.
3. Mark all social sources `E` unless corroborated.
4. Use social commentary for hypotheses about workload, critique culture, and studio norms, not factual course reconstruction.

### Tier 7: Internet Archive And Common Crawl

Implementation requirements:

1. Query Wayback CDX for every official, faculty, course-site, and discovered candidate URL.
2. Fetch selected public captures, not just capture metadata.
3. Prefer captures around academic-term starts: September, January, February, May.
4. Compare current and archived versions for changed assignments, schedules, readings, and faculty.
5. Add `wayback_sources.jsonl` and `source_versions.jsonl`.
6. Add a later Common Crawl pass for `risd.gd`, `risd.edu`, faculty domains, and known course domains.

## Parser Design

The parser should have three layers.

### Layer 1: Document Classification

Classify fetched public documents as:

- full syllabus
- short syllabus/course stub
- assignment page
- schedule page
- reading/resource page
- student work page
- catalog/program page
- faculty page
- social/commentary page
- irrelevant

Initial implementation can use rules. Later implementation should use a labeled classifier.

Classification signals:

- course code
- term/year
- instructor
- meeting time
- grading language
- required readings
- assignment/schedule language
- project/critique language
- institutional source

### Layer 2: Span Extraction

Extract Open Syllabus-style spans:

- `title`
- `code`
- `section`
- `date`
- `class_days`
- `class_time`
- `class_location`
- `instructor`
- `office_hours`
- `credits`
- `description`
- `learning_outcomes`
- `citations`
- `required_reading`
- `grading_rubric`
- `assessment_strategy`
- `topic_outline`
- `assignment_schedule`
- `school_name`

Add RISD/tacit-specific spans:

- `critique_format`
- `revision_expectation`
- `materials`
- `tools`
- `deliverables`
- `student_work_links`
- `studio_norms`
- `implicit_quality_standard`

### Layer 3: Course Reconstruction

For each course:

1. Prefer direct syllabus evidence.
2. Merge assignment/schedule pages from the same course site.
3. Attach readings and resources to weeks when possible.
4. Attach public student work when explicitly linked.
5. Generate a reconstruction packet.
6. Mark every missing or inferred field.

## Citation Parsing And Linking

Implementation requirements:

1. Extract raw citation strings from syllabi and reading pages.
2. Split likely citations into title, author, publisher, and year when possible.
3. Link citations against public APIs where feasible:
   - Open Library
   - Crossref
   - OpenAlex
   - Wikidata
   - Library of Congress where available
4. Keep unresolved citations with `linking_status: "unresolved"`.
5. Do not download or redistribute copyrighted readings.

## Deduplication

Implementation requirements:

1. Exact dedupe by URL canonicalization and content checksum.
2. Near-dedupe by normalized text similarity.
3. Cluster versions by:
   - institution
   - course code
   - section
   - term/year
   - instructor
   - assignment schedule hash
   - reading set hash
   - source URL family
4. Keep substantively different versions.
5. Collapse cosmetic duplicates.

## Manual Review Queue

Automated extraction will miss tacit studio nuance. Add review artifacts:

- `review_queue.jsonl`: high-value uncertain sources
- `review_decisions.jsonl`: human decisions and corrections
- `field_conflicts.jsonl`: contradictory course metadata
- `needs_followup.md`: sources requiring manual inspection

Review priority:

1. Full syllabi
2. Assignment archives
3. Schedule pages
4. Reading pages
5. Student work tied to course prompts
6. Faculty teaching pages
7. Social/commentary sources

## Tacit Knowledge Extraction

For each `A` or `B` course, extract:

- Object students repeatedly make
- Perceptual skill trained
- Constraint system used to force learning
- Critique vocabulary
- Hidden standard of quality
- Expected revision loop
- Material/tool discipline
- Relationship between concept and execution
- Novice failure modes
- What "excellent" appears to mean

Example output:

```text
Course: Web Type
Explicit content: HTML/CSS/JS, browser typography, responsive systems
Training mechanism: working live URLs, critique before troubleshooting, repeated exercises
Tacit standard: typographic intent must survive the browser, device variation, and technical constraints
Common failure mode: treating code as implementation only instead of as a typographic medium
Evidence: syllabus A, schedule A, project pages B
```

## Pipeline Scripts

Target scripts:

- `scripts/risd-graphic-design-corpus.mjs`: orchestrator
- `scripts/risd-gd-seed-sources.mjs`: seed official and known sources
- `scripts/risd-gd-search-ingest.mjs`: import/search candidate URLs
- `scripts/risd-gd-fetch-sources.mjs`: fetch public sources with rate limits
- `scripts/risd-gd-wayback.mjs`: discover and fetch archive captures
- `scripts/risd-gd-classify-docs.mjs`: classify fetched documents
- `scripts/risd-gd-parse-syllabi.mjs`: extract spans and schedule fields
- `scripts/risd-gd-extract-assignments.mjs`: parse project briefs
- `scripts/risd-gd-link-readings.mjs`: normalize citations
- `scripts/risd-gd-dedupe.mjs`: exact and near-dedupe
- `scripts/risd-gd-reconstruct.mjs`: produce course packets and tacit memos
- `scripts/risd-gd-audit.mjs`: validate provenance, missing fields, and source coverage

The current single script can remain during iteration, but these are the intended module boundaries.

## Validation Gates

Minimum validation:

```bash
node scripts/risd-graphic-design-corpus.mjs
```

Corpus checks:

- `sources.jsonl` exists and every row has URL, source type, retrieval date, and extraction status.
- Failed fetches do not create syllabus records.
- No syllabus record has both missing `course_code` and missing `course_title` unless manually reviewed.
- Every assignment row points to a syllabus and source.
- Every reading row points to a syllabus and source.
- Every source-cluster row points to valid sources and includes a representative source.
- Every source-version row points to valid fetched current/archive sources when present.
- Every reconstruction claim cites source IDs.
- Inferred fields are marked.
- Official course inventory count is reconciled against the RISD course page count.
- Wayback captures are recorded and selected captures are fetched.

Repository checks before shipping:

```bash
pnpm build
pnpm test
pnpm run qa:dashboard
```

This is a docs/data pipeline, so full dashboard QA may not exercise the corpus directly, but the repo standard still requires it before final shipping unless the user explicitly narrows the task.

## Implementation Milestones

### Milestone 1: Correctness Of Current Seed Pipeline

- Prevent failed sources from creating syllabus records.
- Normalize course keys and prevent null-title/null-code false joins.
- Improve HTML line preservation.
- Add Open Syllabus-style span fields.
- Regenerate corpus artifacts.
- Add source audit checks.

### Milestone 2: Official Course Inventory

- Parse all RISD Graphic Design course-page offerings.
- Export `course_inventory.jsonl`.
- Reconcile count against the page's displayed result count.
- Link seed syllabi to official course records when codes/titles match.

### Milestone 3: Recursive RISD Course-Site Crawl

- Crawl `*.risd.gd` course archives within depth limits.
- Classify syllabus, project, schedule, reading, and student-work pages.
- Extract assignment pages as first-class records.
- Add archive/source versions.

### Milestone 4: Search Ingestion

- Add search result import/API support.
- Store query provenance.
- Fetch and classify candidate URLs.
- Expand faculty/course/source graph.

### Milestone 5: Wayback And Historical Recovery

- Fetch selected Wayback captures.
- Parse historical syllabi/course pages.
- Compare versions.
- Preserve substantive historical variants.

### Milestone 6: Citation Linking And Dedupe

- Normalize readings.
- Link readings to bibliographic records where possible.
- Add exact and near-dedupe.
- Produce reading frequency summaries.

### Milestone 7: Reconstruction And Review

- Generate course packets.
- Generate tacit knowledge memo.
- Generate review queue.
- Manually review high-value uncertain sources.
- Produce a self-study-ready RISD-style curriculum from the evidence.
  - Emit `self_study_curriculum.md` with evidence-bounded studio tracks, reading packets, recreated brief prompts, critique checkpoints, and public comparison sets.

## Definition Of Done

The implementation is finished only when the corpus can support a source-grounded reconstruction of RISD Graphic Design training:

1. Official course inventory is complete and reconciled.
2. Public syllabi/course sites/assignment pages have been discovered through seeds, search ingestion, recursive course-site crawling, and archive recovery.
3. Syllabus fields are structured, not merely summarized.
4. Assignments, readings, critique, grading, and weekly schedules are extracted as first-class records.
5. Student work is linked where public evidence supports it.
6. Dedupe and source grading prevent inflated or misleading coverage.
7. Reconstructions clearly separate direct evidence from inference.
8. A review queue captures remaining high-value uncertain sources.
9. The repo validation gates have been run.
10. Changes have been committed, pushed, and, if applicable, deployed according to repository instructions.
