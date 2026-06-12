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
- `docs/research-plans/risd-graphic-design-corpus/faculty_portfolio_examples.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/student_work.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/student_work_assignment_links.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/course_site_pages.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/schedule_rows.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/assignment_brief_pages.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/course_coverage.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/course_coverage.md`
- `docs/research-plans/risd-graphic-design-corpus/coverage_search_queries.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/source_clusters.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/source_versions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/archive_fetch_targets.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/archive_promotions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/wayback_captures.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/search_candidates.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/search_promotions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/faculty_search_queries.jsonl`
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
- `docs/research-plans/risd-graphic-design-corpus/self_study_modules.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_pacing_plan.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_pacing_profiles.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_progress_ledger.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_progress_ledger.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_progress_rollups.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_completion_gates.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_evidence_attachments.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_evidence_attachments.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_gate_status_template.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_gate_status_summary.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_gate_status_summary.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_review_index.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_review_index.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_reviewer_handoff.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_reviewer_handoff.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_reviewer_feedback_template.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_reviewer_feedback_template.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_revision_queue.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_revision_queue.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_gate_status_suggestions.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_gate_status_suggestions.md`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_milestones.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_reference_packets.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_source_excerpt_packets.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_export_manifests.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_briefs.jsonl`
- `docs/research-plans/risd-graphic-design-corpus/self_study_portfolio_briefs/*.md`
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
- Citation extraction is heuristic with local catalog matching and non-citation fragment classification. A bounded Open Library linking mode is now wired for plausible book citations and records external match metadata directly on reading rows.
- Assignment extraction now combines sentence snippets with bounded long-brief blocks from project, assignment, exercise, deliverable, due, presentation, and critique headings. It still needs richer field-specific parsing from complete assignment pages.
- Search candidate import is supported through local JSON/JSONL exports, and a live search API path is wired for Brave or Bing when an API key is present in the environment. Coverage-derived gap queries are now treated as first-class search backlog rows and bounded live API inputs while preserving course/gap provenance.
- A bounded Common Crawl candidate, promotion, and ingestion pass exists, but it is still capped and should be expanded carefully.
- Faculty/course edges are derived from course evidence, bounded RISD faculty-profile candidate discovery/ingestion is implemented, and faculty-derived teaching/course artifact queries now feed the search backlog and bounded live-search path. Faculty-portfolio expansion follows external links from official RISD profile pages; discovered faculty teaching artifacts still need actual search-result URLs to promote and classify.
- Source clustering is used to group evidence families in generated course packets. Current clusters are mostly related source families rather than exact duplicates, so the generator preserves distinct related pages and still needs stronger near-duplicate collapse once more duplicate evidence appears.
- Manual review artifacts include generated evidence-aware decisions for mechanically resolvable rows. Human review decisions have not been filled in yet.
- A generated self-study curriculum artifact exists, but it remains bounded by current public evidence and should expand as more course artifacts are recovered.

## Next Implementation Steps

The crawler now has the first Open Syllabus-style spine: seed and imported sources, bounded search backlogs, faculty-derived discovery queries, Common Crawl candidate ingestion, course-site page roles, assignment brief rollups, source families, archive metadata, validation, and generated curriculum outputs. The remaining work is to turn the recovered evidence into a denser classroom reconstruction layer without weakening provenance.

Implement the following slices in order. Each slice must update `scripts/risd-graphic-design-corpus.mjs`, regenerate the affected artifacts, add validation checks, and update this plan when the behavior changes.

### Step 1: Link Public Student Work To Course And Assignment Evidence

Status: implemented for generated relationship rows, conservative confidence boundaries, rejected weak/non-output matches, validation reporting, and generated reconstruction/curriculum comparison evidence.

Goal: make public student work useful as a tacit comparison set while avoiding unsupported claims about which assignment produced a project.

Implementation requirements:

1. Add `student_work_assignment_links.jsonl` as a derived artifact.
2. Build links from `student_work.jsonl`, `assignment_brief_pages.jsonl`, `assignments.jsonl`, and `course_site_pages.jsonl`.
3. Emit one row per defensible relationship, not one row per possible fuzzy match.
4. Allow three levels of relationship:
   - `assignment_link`: the source page or page structure explicitly ties a student artifact to an assignment/project prompt.
   - `brief_page_link`: the source provides course context and the work sits inside a course page or gallery connected to an assignment/project page.
   - `course_context_link`: the source provides course code, title, term, or instructor, but no exact assignment boundary.
5. Require `link_confidence`, `evidence_basis`, and `evidence_grade` on every row.
6. Preserve `student_work_id`, `student_work_url`, `source_ids`, `course_code`, `course_title`, `term`, `instructor`, `brief_page_id`, `assignment_id`, and `assignment_title` when known.
7. Carry `visual_standard_notes` forward from the student-work row and add short `comparison_use` notes such as `visual_calibration`, `deliverable_reference`, `process_reference`, or `critique_reference`.
8. Do not infer a student-work assignment link from title similarity alone.

Validation requirements:

- Every `student_work_id` must exist in `student_work.jsonl`.
- Every non-null `assignment_id` must exist in `assignments.jsonl`.
- Every non-null `brief_page_id` must exist in `assignment_brief_pages.jsonl`.
- Validation must report counts for course-context links, brief-page links, assignment links, and rejected weak matches.

Acceptance output:

- `student_work_assignment_links.jsonl`
- validation rows proving referential integrity and link-confidence boundaries
- generated reconstruction/curriculum sections that use linked student work only as comparison evidence, not as assignment requirements

### Step 2: Extract Explicit Schedule Rows From Course-Site Pages

Status: implemented for normalized schedule rows from syllabus tables/outlines and weekly evidence snippets, conservative assignment/reading links, validation reporting, coverage scoring, and generated reconstruction/curriculum schedule rhythm sections.

Goal: move from syllabus-level schedule snippets to reusable week/class/session rows.

Implementation requirements:

1. Add a `schedule_rows.jsonl` artifact.
2. Extract rows from syllabus tables, week pages, class-session pages, outline pages, and dated agenda bodies.
3. Preserve `schedule_id`, `source_id`, `page_id`, `syllabus_id`, `course_code`, `course_title`, `term`, `instructor`, `week_number`, `date`, `session_title`, `agenda_excerpt`, `due_assignment_ids`, `reading_ids`, `critique_signal`, `workshop_signal`, `evidence_grade`, and `boundary_status`.
4. Link rows to assignments and readings only when the source text contains due, read, critique, review, workshop, or class-session context.
5. Keep partial schedule evidence with explicit missing fields instead of discarding it.
6. Feed schedule rows into `course_reconstruction.md` and `self_study_curriculum.md`.

Validation requirements:

- Every row must reference an existing source.
- Linked assignments and readings must exist.
- Validation must separate table-derived, page-title-derived, and agenda-body-derived rows.

Acceptance output:

- `schedule_rows.jsonl`
- course packets with ordered week/session evidence where available
- coverage scores that improve the `weekly_schedule` requirement only when schedule rows exist

### Step 3: Deepen Assignment Brief Parsing Into Field-Level Records

Status: implemented for generated process steps, submission requirements, grading criteria, assignment boundary evidence, brief-page rollups, validation reporting, and generated reconstruction/curriculum details.

Goal: convert long assignment blocks into structured studio objects that answer what the student must make, under what constraints, with what critique loop.

Implementation requirements:

1. Extend assignment extraction from complete project pages using heading-bounded and list-bounded parsing.
2. Parse field-level arrays for `deliverables`, `constraints`, `materials`, `tools`, `process_steps`, `submission_requirements`, `critique_questions`, `revision_expectation`, `grading_criteria`, `output_format`, and `skills_trained`.
3. Add `assignment_boundary_evidence` with the heading text, URL fragment when available, and source excerpt.
4. Promote high-confidence assignment rows only when the assignment boundary is explicit enough to separate one prompt from neighboring content.
5. Retain low-confidence fragments, but exclude them from curriculum assignment lists unless a complete-brief signal is present.
6. Add `assignment_brief_pages.jsonl` counts to course coverage so complete brief pages improve `project_briefs`, `critique_revision`, and `tools_materials` requirements.

Validation requirements:

- High-confidence assignments must have at least one deliverable, constraint, tool/material, critique, revision, or output-format signal.
- Long brief rows must cite source IDs and boundary evidence.
- Course packets must distinguish complete assignment briefs from weak snippets.

Acceptance output:

- richer `assignments.jsonl`
- richer `assignment_brief_pages.jsonl`
- course reconstruction sections that show tangible project mechanics rather than only prompt excerpts

### Step 4: Promote Search And Faculty Discovery Results Into Sources

Status: implemented for bounded promotion scoring, public fetch attempts, rejected-before-fetch audit rows, candidate status updates, validation reporting, and regenerated corpus artifacts when promotions succeed. Current generated corpus has no URL-bearing live/imported search results, so the promotion artifact remains empty until a search API key or imported search export supplies URLs.

Goal: close the loop from backlog rows to fetched, classified, parseable sources.

Implementation requirements:

1. Keep `coverage_search_queries.jsonl` and `faculty_search_queries.jsonl` as executable search backlogs.
2. In `--search-api-only`, run bounded Brave or Bing searches for static, coverage-derived, and faculty-derived queries.
3. In `--promote-search-only`, score URL-bearing search candidates and write `search_promotions.jsonl`.
4. Promotion criteria should prioritize public course pages, syllabi, project briefs, schedules, reading lists, known faculty domains, `risd.gd`, `risd.edu`, GitHub course repos, and public PDF/HTML artifacts.
5. Promotion must reject login walls, private drives, admin pages, checkout pages, generic marketing pages, and ambiguous personal data pages.
6. Promoted rows must enter `sources.jsonl` and then pass through the same classification and extraction path as curated seeds.
7. Failed fetches and rejected candidates must remain auditable in promotion rows.

Validation requirements:

- Every successful promotion must reference an existing `sources.jsonl` row.
- Every rejected promotion must include a rejection reason.
- No failed or rejected candidate may create syllabus, assignment, reading, faculty, or student-work records.

Acceptance output:

- nonzero promoted search results when URL-bearing search exports or API results are available
- regenerated source, course-site, assignment, reading, and coverage artifacts from promoted sources

### Step 5: Expand Archive And Common Crawl Recovery

Status: implemented for Wayback capture metadata, source-version comparison rows, Common Crawl candidate/promotion artifacts, a ranked archive fetch target queue, and bounded archive-target promotion. Archive target rows identify the best public captures to fetch next by source, academic-term-start timing, course/artifact language, current fetch status, and existing archive-source coverage. `--promote-archive-only` fetches a bounded number of pending targets, records attempts in `archive_promotions.jsonl`, promotes parseable captures into `sources.jsonl` as `wayback_capture`, and regenerates downstream course-site, assignment, schedule, source-version, validation, reconstruction, and curriculum artifacts. Further work should expand the fetch limit gradually and add richer substantive-difference filtering before large historical backfills.

Goal: recover vanished course sites, older project prompts, and historical schedule/readings evidence.

Implementation requirements:

1. Query Wayback CDX for every source URL, course-site root, promoted search URL, faculty teaching URL, and known course domain.
2. Select captures near academic term starts: September, January, February, and May.
3. Fetch selected captures only when public and parseable.
4. Promote archive captures into `sources.jsonl` only when they contain classroom evidence.
5. Preserve original URL, capture timestamp, current-source relationship, text similarity, changed keywords, and substantive-change hints in `source_versions.jsonl`.
6. Expand the bounded Common Crawl pass for known domains and high-priority missing coverage gaps without making routine renders unbounded.
7. Keep historical course sections and materially different assignment versions separate.
8. Maintain `archive_fetch_targets.jsonl` as the bounded queue for selected Wayback captures before fetching. Each target must record the current source relationship, capture timestamp, replay/memento URLs, priority score, selection reason, target status, and whether it is already represented by a fetched archive source.
9. Maintain `archive_promotions.jsonl` as the audit trail for bounded archive target fetch attempts, successful promoted source IDs, failed fetches, and parse status.

Validation requirements:

- Every archive-derived source must cite original URL and capture timestamp.
- `source_versions.jsonl` must connect current and archived records.
- Duplicate captures with no substantive classroom difference should be clustered or marked cosmetic.
- Archive fetch targets must reference existing sources and source-version rows, include replay/memento URLs, include a selection reason, and report high-priority, pending, and term-aligned counts.
- Archive promotion rows must reference existing archive fetch targets, and every successful promotion must reference a real source row.

Acceptance output:

- fetched archive sources where currently only capture metadata exists
- archive-derived course-site pages, assignments, readings, or schedule rows when evidence is present
- `archive_fetch_targets.jsonl` showing which captures should be fetched first and why
- `archive_promotions.jsonl` showing which captures were fetched, promoted, or rejected by extraction failure

### Step 6: Upgrade Deduplication, Versioning, And Conflict Handling

Status: implemented for normalized cluster types, archive/current historical-version clusters, generic error-page exclusion from near-duplicate grouping, validation of the cluster vocabulary, and separate exact/near/historical/related cluster counts. Conflict rows now cover course, syllabus, source-cluster metadata variants, and course-evidence variants for assignment-title sets, reading sets, schedule patterns, and assessment/grading evidence. The next improvement should add source-authority-aware resolution ranking and human-review application for these conflict rows.

Goal: prevent expanded discovery from silently merging different sections, terms, instructors, or assignment variants.

Implementation requirements:

1. Upgrade `source_clusters.jsonl` from related-source families to explicit `exact_duplicate`, `near_duplicate`, `historical_version`, and `related_family` cluster types.
2. Cluster by canonical URL, checksum, normalized text similarity, title similarity, course code, term, instructor, assignment schedule hash, reading-set hash, and page role.
3. Keep distinct historical versions, different course sections, and different assignment revisions.
4. Expand `field_conflicts.jsonl` for contradictory course code, title, instructor, term, credits, schedule, reading, assignment title, and assessment evidence.
5. Add conflict resolution hints based on source authority and recency, but keep lower-authority evidence visible.

Validation requirements:

- Clusters must list representative source IDs and member source IDs.
- Course packets must not silently merge contradictory terms or instructors.
- Every conflict row must include enough record IDs and source IDs for manual review.

Acceptance output:

- more precise source clusters
- conflict reports that explain why a course packet has unresolved metadata

### Step 7: Add Review Workflow For High-Value Uncertainty

Status: implemented for generated missing-evidence review rows, conflict-derived high/medium review rows, structured review prompts, generated pending decisions for conflicts, validation that field conflicts route into the review queue, and follow-up markdown that surfaces review prompts and source IDs. Human decisions are still empty; the next improvement should apply human-reviewed decisions into reconstruction outputs and distinguish reviewed fields from generated/inferred fields.

Goal: route the uncertain but useful classroom artifacts into a human-review loop instead of hiding them in generated prose.

Implementation requirements:

1. Prioritize `review_queue.jsonl` by reconstruction value:
   - full syllabus
   - complete project page
   - weekly schedule
   - reading list
   - critique/grading text
   - linked student work
   - faculty teaching page
   - social commentary
2. Add structured review prompts for course identity, assignment boundary, deliverables, critique format, tacit skill, evidence grade, and parser action.
3. Apply `review_decisions.jsonl` during reconstruction.
4. Keep generated decisions separate from human decisions.
5. Regenerate `course_reconstruction.md`, `tacit_knowledge_memo.md`, and `self_study_curriculum.md` from reviewed evidence.

Validation requirements:

- Applied decisions must cite `review_id` and `decision_id`.
- Human-reviewed fields must be distinguishable from inferred fields.
- Rejected review decisions must not affect reconstruction.

Acceptance output:

- review queue sorted by value and uncertainty
- reconstruction docs that explicitly mark reviewed, inferred, and missing evidence

### Step 8: Improve Reading Citation Linking And Resource Semantics

Status: implemented for deterministic citation/resource classification, reading context labels, reverse links from reading rows to schedule rows and defensible same-source assignment-resource contexts, validation counts, and curriculum display tags. The next improvement should replace heuristic citation parsing with a stronger parser for complete bibliographic strings and page-level resource lists.

Goal: separate true bibliographic readings from resource links, videos, talks, software documentation, and inspiration references.

Implementation requirements:

1. Preserve current local catalog and bounded Open Library linking.
2. Add citation-type classification for book, article, essay, video, website, tool documentation, slide deck, inspiration reference, and non-reading resource.
3. Store `reading_context` such as `required`, `recommended`, `inspiration`, `technical_reference`, `lecture_support`, or `assignment_resource`.
4. Link readings to `schedule_rows.jsonl` and `assignments.jsonl` when the source says a reading supports a week, lecture, project, or critique.
5. Do not download or redistribute copyrighted readings.

Validation requirements:

- Bibliographic rows and non-bibliographic resource rows must be distinguishable.
- External work links must include provider, status, score, and matched metadata.
- Reading links to assignments or schedule rows must reference existing records.

Acceptance output:

- cleaner `readings.jsonl`
- course packets that show what to read, what to reference, and what to use as tool documentation

### Step 9: Generate A Mentor-Style Self-Study Curriculum From Evidence

Status: implemented for evidence-filtered module selection, filtered assignment/reading/schedule display, module-level practice loops, explicit missing-evidence warnings, student/faculty comparison boundaries, a machine-readable `self_study_modules.jsonl` artifact, weekly `self_study_pacing_plan.jsonl`, profile `self_study_pacing_profiles.jsonl`, learner-facing `self_study_progress_ledger.jsonl` and `.md` artifacts, portfolio progress rollup `self_study_portfolio_progress_rollups.jsonl`, milestone-level completion gate `self_study_portfolio_completion_gates.jsonl`, learner evidence attachment manifests `self_study_portfolio_evidence_attachments.jsonl` and `.md`, learner status import template `self_study_portfolio_gate_status_template.jsonl`, optional learner status import consumption from `self_study_portfolio_gate_status_import.jsonl`, applied status reports `self_study_portfolio_gate_status_summary.jsonl` and `.md`, compact review dashboard/index `self_study_portfolio_review_index.jsonl` and `.md`, review-index dashboard filters/groups for readiness, stage, import state, blocker type, workload band, and artifact completeness, reviewer handoff checklists `self_study_portfolio_reviewer_handoff.jsonl` and `.md`, reviewer feedback capture template `self_study_portfolio_reviewer_feedback_template.jsonl` and `.md`, optional reviewer feedback import consumption from `self_study_portfolio_reviewer_feedback_import.jsonl`, post-review revision queue `self_study_portfolio_revision_queue.jsonl` and `.md`, reviewer-feedback-derived gate status promotion suggestions `self_study_portfolio_gate_status_suggestions.jsonl` and `.md`, portfolio milestone `self_study_portfolio_milestones.jsonl`, relationship-labeled `self_study_portfolio_reference_packets.jsonl`, per-milestone `self_study_portfolio_source_excerpt_packets.jsonl`, optional printable/export `self_study_portfolio_export_manifests.jsonl`, and export-friendly `self_study_portfolio_briefs/*.md` artifacts, module-grounded `tacit_knowledge_memo.md` sections, per-module confidence scores/explanations, module ordering rationales with near-miss candidates, track-level prerequisite/dependency maps, learner-facing weekly pacing, workload estimates, adjustable compressed/standard/slow pacing profiles, portfolio milestone checkpoints, independent portfolio review pages, portfolio review readiness gates, evidence attachment slots for final artifacts/process evidence/critique notes/revision proof/source-boundary memos/export package files, attachment slot refs threaded into reviewer feedback templates and gate status suggestions, gate status summaries embedded in portfolio briefs, ledger-to-gate annotations for weekly rows, and validation that generated modules/pacing rows/profiles/progress ledger/progress rollups/completion gates/evidence attachment manifests/status templates/status imports/status summaries/review index/reviewer handoffs/reviewer feedback/revision queue/gate-status suggestions/milestones/briefs/reference packets/source excerpt packets/export manifests cite source IDs, explain selection confidence/order/dependencies, label student-work and faculty-example relationships, carry short assignment/reading/schedule evidence context, and reference existing assignment/reading/schedule/student-work/faculty-example records. The next improvement should add a reviewer feedback import example/smoke fixture that uses real evidence attachment slot refs to prove a resolved review can flow through the revision queue and gate status suggestion path.

Goal: make the corpus usable for the original purpose: tacit catch-up through concrete studio loops.

Implementation requirements:

1. Generate curriculum modules from high-confidence course packets first.
2. For each module, include:
   - source-grounded course evidence
   - tangible assignment loop
   - required or recommended readings/resources
   - critique/revision loop
   - public student-work or faculty-work comparison set when available
   - missing evidence warnings
3. Never invent private syllabus content, rubrics, or readings.
4. Convert inferred tacit knowledge into clearly marked practice instructions such as "make X, under Y constraints, compare against Z, revise after critique."
5. Add a module-level evidence grade and source ID list.

Validation requirements:

- Every curriculum module must cite source IDs.
- Every assignment in the curriculum must come from `assignments.jsonl` or `assignment_brief_pages.jsonl`.
- Every student-work comparison must come from `student_work_assignment_links.jsonl`, `student_work.jsonl`, or `faculty_portfolio_examples.jsonl` with the relationship marked.
- Every learner-facing progress ledger row must point to the portfolio completion gate that will review that week of work.
- Every standalone portfolio brief must surface its completion gate status, required evidence, blocking conditions, and ready-when conditions.
- Every portfolio evidence attachment manifest must map to a valid milestone, progress rollup, completion gate, and export manifest, and every gate check must have unique attachment slots.
- Every portfolio gate status template row must target a valid gate and valid check IDs.
- Optional learner status import rows must target valid gates/checks and cannot mark a gate ready unless every imported check is satisfied.
- Every portfolio gate status summary row must compare base and applied readiness, show whether an import was used, and list remaining blocking checks.
- Every portfolio review index row must link one milestone to its brief, gate status summary, source excerpt packet, reference packet, and export manifest.
- Every portfolio review index row must expose dashboard filters for readiness, stage, import state, blocker types, workload band, and artifact completeness.
- Every portfolio reviewer handoff row must map to a review-index row and include pre-review, live-review, critique-prompt, and post-review actions.
- Every portfolio reviewer feedback template/import row must map to a valid handoff, use bounded outcome/revision statuses, and expose valid evidence attachment slot refs for status updates and revision items.
- Every portfolio revision queue row must map back to a valid handoff and preserve blocker type, priority, status, and required evidence refs.
- Every gate status suggestion row must map reviewer feedback to a valid completion gate, only suggest valid check updates, and cannot suggest `ready_for_review` unless every check is satisfied with evidence refs.

Acceptance output:

- richer `self_study_curriculum.md`
- `self_study_modules.jsonl` for downstream rendering without Markdown parsing
- `self_study_progress_ledger.jsonl` and `.md` for learner-facing output, critique, and evidence-warning tracking
- `self_study_portfolio_progress_rollups.jsonl` for rolling weekly ledger rows into portfolio milestone packages
- `self_study_portfolio_completion_gates.jsonl` for explicit review-readiness checks and blocking conditions per portfolio milestone
- `self_study_portfolio_gate_status_template.jsonl` for learner-maintained status imports that can update gate readiness without editing generated briefs or ledgers
- `self_study_portfolio_gate_status_summary.jsonl` and `.md` for explaining applied learner imports and remaining review blockers
- `self_study_portfolio_review_index.jsonl` and `.md` for a compact, filterable milestone dashboard linking briefs, status summaries, source packets, reference packets, and export manifests
- `self_study_portfolio_reviewer_handoff.jsonl` and `.md` for mentor/external critique checklists grounded in the review index
- `self_study_portfolio_reviewer_feedback_template.jsonl` and `.md` for capturing critique outcomes without inventing review results
- `self_study_portfolio_revision_queue.jsonl` and `.md` for post-review learner revision work derived from imported feedback or unresolved blockers
- `self_study_portfolio_briefs.jsonl` plus one standalone Markdown brief per portfolio milestone, each with a review-readiness gate section
- `self_study_portfolio_reference_packets.jsonl` with relationship-labeled student-work and faculty-portfolio examples
- `self_study_portfolio_source_excerpt_packets.jsonl` with short source-context excerpts for each portfolio milestone
- `self_study_portfolio_export_manifests.jsonl` for packaging each brief, reference packet, and source ID manifest into external study tools
- `tacit_knowledge_memo.md` organized around observed studio practices rather than unsupported generalizations

### Step 10: Keep Validation, Documentation, And Deployment In Lockstep

Every implementation slice must update the corpus artifacts and the design document when behavior changes.

Required checks before shipping a corpus implementation slice:

```bash
node --check scripts/risd-graphic-design-corpus.mjs
node scripts/risd-graphic-design-corpus.mjs --render-derived-only
pnpm build
pnpm test
pnpm run qa:dashboard
pnpm run cf:deploy
```

If a slice changes search ingestion, also run:

```bash
node scripts/risd-graphic-design-corpus.mjs --search-api-only
```

If a slice changes archive ingestion or target promotion, also run:

```bash
node scripts/risd-graphic-design-corpus.mjs --promote-archive-only
```

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

`assignment_schedule` rows may include `schedule_source: "week_page"` when the row is reconstructed from a public week/class page title, date, and agenda body rather than from a table-style syllabus schedule.

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
- `process_steps`
- `submission_requirements`
- `grading_criteria`
- `assignment_type`
- `studio_phases`
- `critique_questions`
- `output_format`
- `evidence_limits`
- `critique_format`
- `revision_expectation`
- `skills_trained`
- `tacit_goal`
- `assignment_confidence`
- `boundary_status`
- `assignment_boundary_evidence`
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
- `external_work_id`
- `external_work_url`
- `external_link_provider`
- `external_link_status`
- `external_link_score`
- `external_title`
- `external_author`
- `external_first_publish_year`
- `external_publisher`
- `external_isbn`
- `external_edition_count`

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
- `course_inference_confidence`
- `course_inference_basis`
- `visual_standard_notes`
- `evidence_grade`

### `student_work_assignment_links.jsonl`

One row per defensible relationship between a public student-work artifact and recovered course, assignment, or assignment-brief evidence. This artifact supports comparison and tacit calibration; it must not turn weak visual/title similarity into a factual assignment claim.

Required fields:

- `link_id`
- `student_work_id`
- `student_work_url`
- `source_ids`
- `relationship_type`
- `link_confidence`
- `evidence_basis`
- `course_code`
- `course_title`
- `term`
- `instructor`
- `brief_page_id`
- `assignment_id`
- `assignment_title`
- `brief_page_url`
- `assignment_source_ids`
- `visual_standard_notes`
- `comparison_use`
- `rejection_reason`
- `evidence_grade`

Relationship types:

- `assignment_link`: explicit assignment/project relationship in source evidence.
- `brief_page_link`: public work is connected to a course-site page or gallery that has assignment/project evidence.
- `course_context_link`: source evidence supports course context but not exact assignment identity.
- `rejected_weak_match`: candidate relationship rejected because evidence is only fuzzy title, visual, or keyword similarity.

### `course_site_pages.jsonl`

One row per public course-site, syllabus, assignment, schedule, reading/resource, student-work, or archived page that can support page-role audit and classroom-artifact reconstruction.

Required fields:

- `page_id`
- `source_id`
- `url`
- `page_role`
- `source_type`
- `course_code`
- `course_title`
- `term`
- `instructor`
- `parent_source_id`
- `crawl_depth`
- `link_label`
- `extraction_status`
- `evidence_grade`
- `syllabus_ids`
- `assignment_ids`
- `reading_ids`
- `schedule_rows`
- `weekly_schedule_evidence_rows`
- `assignment_count`
- `long_assignment_briefs`
- `high_confidence_assignments`
- `reading_count`
- `normalized_readings`
- `has_classroom_artifact`

### `schedule_rows.jsonl`

One row per recovered week, class, session, agenda, or schedule-evidence item. Rows may come from structured syllabus tables/outlines or from partial weekly/class evidence snippets; the boundary status must make that distinction explicit.

Required fields:

- `schedule_id`
- `source_id`
- `page_id`
- `syllabus_id`
- `course_code`
- `course_title`
- `term`
- `instructor`
- `week_number`
- `date`
- `session_title`
- `agenda_excerpt`
- `due_assignment_ids`
- `reading_ids`
- `critique_signal`
- `workshop_signal`
- `schedule_source`
- `evidence_grade`
- `boundary_status`

Schedule sources:

- `syllabus_table_or_outline`
- `weekly_schedule_evidence_snippet`

Boundary statuses:

- `dated_schedule_row`
- `undated_schedule_row`
- `partial_schedule_evidence`

### `assignment_brief_pages.jsonl`

One row per course-site page with assignment/project evidence, rolling up the assignment records recovered from that page into a reviewable brief summary.

Required fields:

- `brief_page_id`
- `source_id`
- `url`
- `page_role`
- `course_code`
- `course_title`
- `term`
- `instructor`
- `parent_source_id`
- `evidence_grade`
- `assignment_ids`
- `assignment_count`
- `high_confidence_assignments`
- `medium_confidence_assignments`
- `low_confidence_assignments`
- `long_assignment_briefs`
- `deliverables`
- `constraints`
- `materials`
- `tools`
- `process_steps`
- `submission_requirements`
- `grading_criteria`
- `studio_phases`
- `output_formats`
- `critique_assignment_count`
- `revision_assignment_count`
- `tacit_goals`
- `representative_assignment_ids`
- `representative_prompts`
- `has_complete_brief_signal`

### `faculty_portfolio_examples.jsonl`

One row per public faculty portfolio/project example recovered from external faculty profile sources. These examples support visual/tacit calibration but are not student work or full course evidence unless another source links them to a course.

Required fields:

- `example_id`
- `faculty_name`
- `url`
- `source_ids`
- `title`
- `medium`
- `project_statement_excerpt`
- `visual_standard_notes`
- `relationship`
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
- `provider`
- `status`
- `promoted_source_id`
- `error`

Coverage-derived and faculty-derived candidate rows should also preserve discovery provenance:

- `query_id`
- `query_source`
- `course_code`
- `course_title`
- `missing_requirement`
- `coverage_score`
- `priority`
- `source_coverage_id`
- `faculty_id`

### `search_promotions.jsonl`

One row per bounded search candidate public-fetch attempt.

Required fields:

- `promotion_id`
- `candidate_id`
- `promoted_at`
- `promoted_source_id`
- `url`
- `query`
- `query_id`
- `query_source`
- `course_code`
- `course_title`
- `missing_requirement`
- `promotion_score`
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

### `faculty_search_queries.jsonl`

One row per faculty/course-derived public web query intended to find teaching pages, syllabi, project briefs, assignment pages, and studio artifacts.

Required fields:

- `query_id`
- `query`
- `faculty_id`
- `faculty_name`
- `course_code`
- `course_title`
- `term`
- `query_intent`
- `priority`
- `status`
- `generated_at`
- `source_edge_id`

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

### `archive_fetch_targets.jsonl`

One row per selected Wayback capture to fetch or audit next. This is a bounded priority queue, not a claim that the capture has already been ingested as evidence.

Required fields:

- `target_id`
- `source_id`
- `current_url`
- `current_status`
- `source_type`
- `course_code`
- `course_title`
- `term`
- `capture_timestamp`
- `capture_year`
- `capture_month`
- `original_url`
- `memento_url`
- `replay_url`
- `mimetype`
- `digest`
- `priority_score`
- `priority`
- `selection_reason`
- `academic_term_start_aligned`
- `comparison_status`
- `existing_archive_source_ids`
- `target_status`
- `evidence_grade`

Target statuses:

- `pending_archive_fetch`: selected capture should be fetched, parsed, and classified in a bounded archive run.
- `already_fetched_archive_source`: selected capture is already represented by a fetched archive-derived source.

### `archive_promotions.jsonl`

One row per bounded Wayback target fetch attempt. Successful rows promote public, parseable captures into `sources.jsonl`; failed rows remain as an audit trail and must not create course, assignment, reading, schedule, or student-work facts.

Required fields:

- `promotion_id`
- `target_id`
- `source_id`
- `promoted_at`
- `promoted_source_id`
- `original_url`
- `memento_url`
- `replay_url`
- `capture_timestamp`
- `priority_score`
- `priority`
- `selection_reason`
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
- `confidence`
- `evidence_summary`
- `next_parser_action`
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

1. Keep `search_candidates.jsonl` as the canonical search backlog and search-result artifact.
2. Support imported search exports and, when configured through `BRAVE_SEARCH_API_KEY` or `BING_SEARCH_API_KEY`, a search API provider.
3. Treat `coverage_search_queries.jsonl` as executable search backlog, not only a report.
4. Never require secrets in chat; use `~/.codex/scripts/ask-secret.sh` for API keys.
5. Deduplicate candidate URLs before fetch.
6. Record query, query source, rank, title, snippet, URL, discovery date, and course/faculty gap provenance when available.
7. Promote search candidates into `sources.jsonl` only after successful public fetch and classification.
8. Keep provider-unconfigured rows when no search API key is present so the backlog remains auditable.

### Tier 4: Faculty-Centric Expansion

Implementation requirements:

1. Build `faculty.jsonl` from current RISD profiles, course evidence, and historical catalogs.
2. Build `faculty_profile_candidates.jsonl` from RISD Graphic Design faculty profile URL patterns, the official RISD faculty index, official profile external links, and curated public faculty profile/portfolio hints.
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
6. Follow public faculty portfolio links beyond the curated hint list, starting with external links exposed on official RISD faculty profile pages.
7. Extract course-source-faculty edges into `faculty_course_edges.jsonl`.
8. Extract public faculty portfolio examples into `faculty_portfolio_examples.jsonl` for visual/tacit calibration, keeping them separate from student work.
9. Use faculty pages for discovery and attribution, not as full syllabus evidence unless they include classroom artifacts.

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

Assignment extraction should prefer bounded brief blocks over isolated sentences when a public course or assignment page contains headings such as `Project`, `Assignment`, `Exercise`, `Deliverables`, `Due`, `Presentation`, or `Critique`. Sentence snippets remain a fallback for broad recall, but validation should report long brief blocks separately so the corpus can distinguish complete prompts from weak fragments.

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
   - Open Library, using `https://openlibrary.org/search.json` with bounded, rate-limited lookup passes and no API key
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
- `scripts/risd-gd-link-readings.mjs`: normalize citations and run bounded external catalog linking, currently implemented inside `scripts/risd-graphic-design-corpus.mjs --link-readings-only`
- `scripts/risd-gd-dedupe.mjs`: exact and near-dedupe
- `scripts/risd-gd-reconstruct.mjs`: produce course packets and tacit memos
- `scripts/risd-gd-self-study.mjs`: produce self-study modules, pacing plans, portfolio milestones, and standalone portfolio brief pages
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
- Every self-study portfolio brief maps to a milestone and includes source IDs, review prompts, a review package, and an evidence boundary.
- Every self-study portfolio reference packet labels whether each item is assignment-linked student work, course-context student work, or context-only faculty portfolio evidence.
- Every self-study portfolio export manifest maps one milestone to its brief page, reference packet row, source ID manifest, and external tool payload.
- Every self-study portfolio source excerpt packet carries short assignment, reading/resource, schedule, and missing-evidence excerpts with valid source IDs.
- Every self-study progress ledger row maps to a pacing row and includes output checklist, critique/revision log, unresolved evidence warnings, and source IDs.
- Every self-study portfolio progress rollup maps ledger rows to a milestone export manifest and summarizes outputs, critique logs, and unresolved warnings.
- Every self-study portfolio completion gate maps to a progress rollup and export manifest, lists required evidence, records current readiness status, and states blocking conditions before review.
- Every self-study progress ledger row links back to a valid portfolio milestone and completion gate.
- Every self-study portfolio evidence attachment manifest covers each completion gate check with unique final-artifact, process-evidence, critique-note, revision-proof, source-boundary, or export-package slots.
- Every self-study portfolio gate status template row targets valid current gate/check IDs, and optional imported learner rows are safe to apply.
- Every self-study portfolio gate status summary row targets a valid gate, reports applied import state, and lists ready or blocking conditions.
- Every self-study portfolio review index row targets valid brief, status summary, source excerpt packet, reference packet, and export manifest artifacts.
- Every self-study portfolio review index row carries dashboard filter/group metadata for readiness, stage, import state, blocker type, workload, and artifact completeness.
- Every self-study portfolio reviewer handoff row targets a valid review-index row and includes concrete critique-session actions.
- Every self-study portfolio reviewer feedback row targets a valid handoff, links an evidence attachment manifest, and optional imported feedback rows use bounded outcomes, statuses, and evidence refs.
- Every self-study portfolio revision queue row targets a valid handoff and distinguishes generated blocker templates from imported reviewer feedback.
- Every self-study portfolio gate status suggestion row targets a valid handoff/gate pair, links revision queue rows, and emits a copyable import row only when reviewer feedback supplies valid evidence-backed check updates.
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
- Convert coverage-derived gap queries into search backlog rows.
- Run bounded live search over static, coverage-derived, and faculty-derived query rows.
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
  - Emit `self_study_progress_ledger.jsonl` and `.md` with learner-facing tracking rows for outputs, critique revisions, and unresolved evidence warnings.
  - Emit `self_study_portfolio_progress_rollups.jsonl` connecting weekly ledger rows to milestone export manifests.
  - Emit `self_study_portfolio_completion_gates.jsonl` defining review-readiness checks, blocking conditions, and required evidence for each portfolio milestone.
  - Emit `self_study_portfolio_briefs/*.md` as standalone portfolio review sheets for export or printing, including the current completion-gate status and blocking conditions.
  - Emit `self_study_portfolio_reference_packets.jsonl` with relationship-labeled public reference examples for each portfolio milestone.
  - Emit `self_study_portfolio_source_excerpt_packets.jsonl` with short evidence-context excerpts for each portfolio milestone.
  - Emit `self_study_portfolio_export_manifests.jsonl` to package each brief page with its reference packet and source IDs.
  - Emit `self_study_portfolio_gate_status_suggestions.jsonl` and `.md` to convert reviewer feedback imports into conservative gate status import rows.
  - Emit `self_study_portfolio_evidence_attachments.jsonl` and `.md` so final artifacts, process evidence, critique notes, revision proof, source-boundary memos, and export packages have stable evidence refs before review promotion.
  - Thread evidence attachment slot refs into reviewer feedback templates and gate status suggestions so reviewer imports can pick from manifest refs instead of free-text evidence strings.
  - Next: add a reviewer feedback import smoke fixture that marks one milestone partially or fully resolved with real attachment slot refs, then validates the generated revision queue and gate status suggestion behavior.

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
