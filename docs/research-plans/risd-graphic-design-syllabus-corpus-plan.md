# RISD Graphic Design Syllabus Corpus Plan

## Objective

Build a comprehensive, evidence-graded corpus for the Rhode Island School of Design Graphic Design program that captures the classroom artifact layer: syllabi, weekly lecture topics, readings, textbooks, project briefs, assignment constraints, critique structure, grading rubrics, tools, student outputs, and tacit studio norms.

The goal is not to summarize the RISD degree map. The goal is to reconstruct how RISD Graphic Design courses are actually taught, with enough detail to create a self-study curriculum that approximates the training environment.

## Scope

Initial scope:

- School: Rhode Island School of Design
- Program: Graphic Design
- Degree levels: BFA first, then MFA
- Time range: prioritize 2020-present, then backfill 2010-2019 where useful
- Units of analysis: course offering, syllabus, assignment, reading, student work artifact, course-site page, public comment thread, faculty page

Out of scope unless explicitly authorized:

- Circumventing login walls, Canvas, Blackboard, Google Drive permissions, or private student groups
- Downloading or redistributing copyrighted readings
- Scraping personal data beyond what is necessary to attribute public course artifacts
- Treating anonymous social posts as verified facts without corroboration

## Research Questions

1. What are the core RISD Graphic Design courses, sequences, and studios?
2. Which courses have public syllabi, assignment briefs, or course websites?
3. What readings, textbooks, lectures, exercises, and project archetypes recur?
4. How are critiques structured, and what kinds of feedback or standards are implied?
5. What student work artifacts reveal the expected level of execution?
6. Which gaps can be reconstructed from adjacent evidence, and which gaps must remain unknown?

## Expected Artifacts

- `sources.jsonl`: one row per discovered source
- `courses.jsonl`: normalized RISD Graphic Design course records
- `syllabi.jsonl`: parsed syllabus records
- `assignments.jsonl`: assignment/project briefs and constraints
- `readings.jsonl`: books, articles, videos, and course packets
- `student_work.jsonl`: public student work linked to course, instructor, or term when possible
- `course_reconstruction.md`: reconstructed course-by-course curriculum with evidence grades
- `tacit_knowledge_memo.md`: synthesis of studio norms, critique patterns, hidden standards, and skill progression
- `source_audit.md`: reproducibility notes, query log, access limitations, and unresolved gaps

## Source Ladder

### Tier 1: Official RISD Sources

These are highest-confidence sources for program structure, course names, course descriptions, facilities, degree requirements, and institutional teaching expectations.

- RISD Graphic Design BFA program page: `https://www.risd.edu/academics/graphic-design/bachelors-program`
- RISD Graphic Design MFA program page: `https://www.risd.edu/academics/graphic-design/masters-programs`
- RISD Graphic Design courses page: `https://www.risd.edu/academics/graphic-design/courses`
- RISD Coursedog catalog program record: `https://risd.coursedog.com/programs/cfa6776e92151000bceb55330dc80000`
- RISD Coursedog course records, including archive subdomains
- RISD Teaching & Learning Lab syllabus guidance: `https://teachingandlearninglab.risd.edu/teaching-support/syllabus-and-course-design`
- RISD Digital Commons course catalogs and announcements: `https://digitalcommons.risd.edu/archives_coursecatalogsannouncements/`
- RISD Digital Commons theses: `https://digitalcommons.risd.edu/masterstheses/`
- RISD accreditation and self-study reports where they mention syllabus standards or Graphic Design review processes

Collection actions:

1. Crawl the RISD Graphic Design program, course, faculty, news, and archive pages.
2. Extract all course codes, course titles, descriptions, credits, prerequisites, degree requirements, and cross-listings.
3. Save source URL, retrieved date, page title, raw HTML/PDF checksum, and extracted text.
4. Record whether the source is official, current, archived, or historical.

### Tier 2: Public RISD Course Syllabi and Course Sites

These are the most important sources for reconstructing the classroom layer.

Known seed examples:

- Adam Fein, `Introduction to Graphic Design`, `GRAPH-W336-01`, Wintersession 2021: `https://ajfein.squarespace.com/s/AdamFein_IntroToGraphicDesign.pdf`
- John Caserta, `Design Studio 1`, 2016: `https://johncaserta.com/ds1-2016.html`
- Public Google Doc result titled `DS3 Syllabus 2017`

Search patterns:

```text
site:risd.edu "Graphic Design" "syllabus" filetype:pdf
site:risd.edu "GRAPH" "syllabus" filetype:pdf
site:risd.edu "Typography" "syllabus" "RISD"
site:digitalcommons.risd.edu "Graphic Design" "syllabus"
site:coursedog.com "RISD" "GRAPH"
site:johncaserta.com "RISD" "Graphic Design"
site:*.squarespace.com "RISD" "Graphic Design" "syllabus"
site:docs.google.com "RISD" "Graphic Design" "syllabus"
"RISD" "Graphic Design" "assignment" "critique"
"RISD" "Design Studio" "syllabus"
"RISD" "Typography" "assignment" "Graphic Design"
"RISD" "GRAPH-W" "syllabus"
"RISD" "GRAPH-" "project"
```

Collection actions:

1. Search web indexes with the patterns above.
2. Follow faculty and adjunct portfolio sites from every public RISD Graphic Design faculty profile.
3. For each syllabus or course page, extract:
   - course code
   - course title
   - term
   - instructor
   - meeting pattern
   - description
   - learning outcomes
   - required tools/software
   - required readings/textbooks
   - weekly schedule
   - assignments/projects
   - critique format
   - grading breakdown
   - attendance and participation policies
   - final deliverables
4. Preserve source provenance and mark whether data is directly quoted, paraphrased, or inferred.

### Tier 3: Faculty Websites, CVs, Portfolios, and Teaching Pages

Faculty pages often reveal course titles, methods, assignments, class archives, and student outcomes when official course pages do not.

Search patterns:

```text
"RISD Graphic Design" "faculty" "syllabus"
"RISD Graphic Design" "teaching" "assignment"
"RISD" "Graphic Design" "course website"
"RISD" "Graphic Design" "students" "project"
"RISD" "Design Studio" "John Caserta"
"RISD" "Graphic Design" "Ramon Tejada"
"RISD" "Graphic Design" "Mindy Seu"
"RISD" "Graphic Design" "James Goggin"
"RISD" "Graphic Design" "Lucinda Hitchcock"
```

Collection actions:

1. Build a faculty roster from RISD pages and historical catalogs.
2. Search each faculty member by name plus `RISD`, `Graphic Design`, `syllabus`, `course`, `teaching`, `assignment`, `studio`, `Typography`, `Design Studio`.
3. Capture course-specific pages, PDFs, class blogs, Are.na channels, GitHub repositories, public Google Docs, and archived class sites.
4. Link each artifact to the faculty member and course when evidence permits.

### Tier 4: Student Work Archives and Thesis/Exhibition Pages

Student work is essential for tacit knowledge because it reveals the expected artifact quality, project constraints, and visual standards.

Sources:

- RISD Graphic Design department news and exhibition pages
- RISD Digital Commons graduate theses
- RISD thesis exhibitions
- Student portfolio sites
- Behance
- Cargo
- Are.na
- Instagram posts when public and clearly course-related
- Vimeo/YouTube motion-design class outputs
- GitHub repositories for interaction, web, or creative coding courses

Search patterns:

```text
"RISD Graphic Design" "Typography I"
"RISD Graphic Design" "Design Studio 1"
"RISD Graphic Design" "Design Studio 3"
"RISD Graphic Design" "thesis"
"RISD Graphic Design" "student work"
"RISD" "Graphic Design" "class of" "portfolio"
site:behance.net "RISD" "Graphic Design" "Typography"
site:cargo.site "RISD" "Graphic Design" "RISD"
site:arena.com "RISD" "Graphic Design"
site:github.com "RISD" "Graphic Design"
site:vimeo.com "RISD" "Graphic Design" "motion"
```

Collection actions:

1. Collect only public pages.
2. Record student name only when already publicly attached to the work and necessary for attribution.
3. Extract course link if explicit; otherwise mark as `course_unknown`.
4. Classify artifacts by medium: poster, book, website, type specimen, identity system, motion piece, publication, exhibition, thesis, interaction prototype.
5. Capture visual metadata: format, dimensions if available, medium, tools, constraints, critique notes, project statement.

### Tier 5: Social Media, Forums, Reviews, and Student Commentary

These sources are useful for tacit norms, workload, critique culture, teacher reputation, and studio expectations. They are lower confidence and should not be used as sole evidence for factual claims.

Sources:

- Reddit threads
- Student blogs
- Public Instagram captions
- Public X/Twitter posts
- YouTube/Vimeo descriptions and comments
- RateMyProfessors only as low-confidence sentiment, not factual syllabus evidence
- Public Discord/Slack exports only if intentionally published

Search patterns:

```text
"RISD Graphic Design" "critique"
"RISD Graphic Design" "workload"
"RISD Graphic Design" "Typography" "crit"
"RISD Graphic Design" "Design Studio" "crit"
"RISD Graphic Design" "assignment"
site:reddit.com/r/risd "graphic design"
site:reddit.com "RISD" "Graphic Design" "Typography"
site:instagram.com "RISD Graphic Design" "Typography"
site:youtube.com "RISD Graphic Design" "critique"
```

Collection actions:

1. Store only public URLs and short paraphrased summaries unless the platform permits quoting.
2. Label source confidence as `low` unless corroborated by syllabi or official pages.
3. Extract recurring themes: workload, critique style, instructor standards, tools, studio culture, common pain points.
4. Do not infer private classroom details from isolated anecdotes.

### Tier 6: Web Archives

Many class pages disappear after a term. The Wayback Machine can recover course websites, syllabi PDFs, assignment pages, and faculty teaching pages.

Targets:

- RISD official course pages
- Faculty domains
- Squarespace class sites
- Google Docs export URLs where public
- Old Coursedog/archive catalog URLs
- Department pages

Collection actions:

1. For each discovered URL, query the Wayback CDX API.
2. Prioritize captures during academic terms: September, January, February, May.
3. Save memento URL, timestamp, status code, MIME type, and extracted content.
4. Compare current and archived versions for changed course names, assignments, or reading lists.

## Data Model

### `sources.jsonl`

```json
{
  "source_id": "src_risd_graph_w336_2021_fein_pdf",
  "url": "https://ajfein.squarespace.com/s/AdamFein_IntroToGraphicDesign.pdf",
  "retrieved_at": "2026-06-11",
  "source_type": "syllabus_pdf",
  "authority": "public_faculty_course_artifact",
  "access": "public_web",
  "program": "Graphic Design",
  "degree_level": "unknown_or_bfa_elective",
  "course_code": "GRAPH-W336-01",
  "course_title": "Introduction to Graphic Design",
  "term": "Wintersession 2021",
  "instructor": "Adam Fein",
  "confidence": "A",
  "checksum": null,
  "notes": "Public RISD syllabus PDF hosted on instructor Squarespace."
}
```

### `courses.jsonl`

```json
{
  "course_id": "risd_graph_w336",
  "school": "RISD",
  "department": "Graphic Design",
  "course_code": "GRAPH-W336",
  "course_title": "Introduction to Graphic Design",
  "degree_level": "BFA_or_elective",
  "credits": null,
  "description": null,
  "prerequisites": [],
  "source_ids": ["src_risd_graph_w336_2021_fein_pdf"],
  "evidence_grade": "A"
}
```

### `syllabi.jsonl`

```json
{
  "syllabus_id": "syl_risd_graph_w336_2021_fein",
  "course_id": "risd_graph_w336",
  "term": "Wintersession 2021",
  "instructor": "Adam Fein",
  "meeting_pattern": "Mon, Tues, alternate Weds, 1-6 pm",
  "platforms": ["Canvas", "Slack", "Zoom"],
  "description": null,
  "learning_outcomes": [],
  "weekly_schedule": [],
  "grading_breakdown": [],
  "assignments": [],
  "readings": [],
  "source_ids": ["src_risd_graph_w336_2021_fein_pdf"]
}
```

### `assignments.jsonl`

```json
{
  "assignment_id": "assign_placeholder",
  "course_id": "risd_graph_w336",
  "syllabus_id": "syl_risd_graph_w336_2021_fein",
  "title": null,
  "week": null,
  "prompt": null,
  "constraints": [],
  "deliverables": [],
  "critique_format": null,
  "skills_trained": [],
  "tacit_goal": null,
  "source_ids": []
}
```

### `readings.jsonl`

```json
{
  "reading_id": "reading_placeholder",
  "course_id": null,
  "syllabus_id": null,
  "author": null,
  "title": null,
  "publication_year": null,
  "reading_type": "book_or_article_or_video_or_web",
  "required_or_recommended": "unknown",
  "week": null,
  "source_ids": []
}
```

## Evidence Grades

- `A`: full public syllabus, course website, or official course artifact with assignments/readings/schedule
- `B`: partial syllabus, assignment brief, class site, or faculty teaching page
- `C`: official catalog/course description without classroom details
- `D`: student work or commentary implying course structure but not documenting it
- `E`: inference from comparable RISD course sequences or adjacent schools; clearly marked as reconstruction

Every reconstructed course must show its evidence grade and source list.

## Scraping Workflow

### Phase 1: Seed Official Course Inventory

1. Crawl official RISD Graphic Design BFA/MFA pages and course pages.
2. Crawl RISD Coursedog current and archived records.
3. Extract course code, title, description, credits, level, and prerequisites.
4. Produce `courses_seed.jsonl`.
5. Create a query set for each course:
   - exact course code
   - exact title
   - title plus `RISD`
   - title plus instructor names
   - title plus `syllabus`, `assignment`, `critique`, `student work`, `project`

### Phase 2: Find Syllabi and Assignment Artifacts

1. Run targeted web searches for each course query.
2. Search PDF, HTML, Google Docs, professor sites, GitHub, Are.na, Vimeo, YouTube, Behance, Cargo, and RISD Digital Commons.
3. Save each candidate source to `sources.jsonl`.
4. Parse PDFs with a layout-aware extractor.
5. Parse HTML pages with readability extraction plus DOM snapshots.
6. Parse Google Docs only when publicly accessible without authentication.
7. Mark each result as `syllabus`, `assignment`, `course_site`, `student_work`, `faculty_cv`, `catalog`, `commentary`, or `archive`.

### Phase 3: Faculty-Centric Expansion

1. Build current and historical RISD Graphic Design faculty roster.
2. For each faculty member, search:
   - personal domain
   - RISD profile
   - portfolio/CV
   - public teaching pages
   - PDFs
   - conference bios mentioning courses
3. Add discovered course artifacts back into the course inventory.
4. Repeat until no new faculty-course-source edges appear.

### Phase 4: Student Work and Public Commentary

1. Search by course title, instructor, and project names discovered in syllabi.
2. Collect public student work pages and extract project statements.
3. Identify recurring project forms and standards:
   - type specimen
   - poster sequence
   - book/publication
   - identity system
   - motion piece
   - interactive site
   - research archive
   - thesis installation
4. Collect public commentary only as low-confidence context.
5. Use commentary to generate hypotheses, not standalone claims.

### Phase 5: Wayback Recovery

1. Query Wayback CDX API for every official, faculty, and course-site URL.
2. Download public historical captures where permitted.
3. Extract archived syllabi, assignment pages, and project pages.
4. Add archive timestamp and original URL to source metadata.

### Phase 6: Normalize and Deduplicate

1. Deduplicate files by checksum and near-duplicate text similarity.
2. Merge equivalent course records across current and archived catalogs.
3. Normalize course codes and terms.
4. Create entity links:
   - instructor to course
   - course to syllabus
   - syllabus to assignments
   - assignment to student work
   - reading to course/week
5. Mark conflicting facts and preserve both with provenance.

### Phase 7: Reconstruct Courses

For each course, create a reconstruction packet:

```text
Course title/code
Evidence grade
Known instructors
Known terms
Official description
Observed syllabus structure
Weekly topics
Readings/textbooks
Assignments and deliverables
Critique format
Tools/software
Observed student work
Tacit skill progression
What "excellent" appears to mean
Known gaps
Source list
```

Reconstruction rules:

1. Use direct syllabus evidence first.
2. Use assignment/course-site evidence second.
3. Use student work to infer deliverable shape, not lecture content.
4. Use social commentary only for studio culture and workload hypotheses.
5. Keep inferred material visibly labeled.
6. Never fabricate weekly schedules when evidence is absent; instead provide a plausible reconstruction with confidence labels.

## Tacit Knowledge Extraction

For every `A` or `B` course, extract:

- The object students repeatedly make
- The perceptual skill being trained
- The constraint system used to force learning
- The critique vocabulary
- The hidden standard of quality
- The expected revision loop
- The material/tool discipline
- The relationship between concept and execution
- The difference between novice mistakes and advanced work

Example extraction frame:

```text
Course: Typography I
Explicit content: type anatomy, hierarchy, grid, spacing
Training mechanism: repeated visible comparison under critique
Tacit standard: optical control matters more than decorative novelty
Common failure mode: treating type as text content rather than visual material
Self-study reconstruction: weekly typesetting studies, pin-up critique, revision archive
Evidence: syllabus A, student work D, readings A
```

## Quality Checks

- Every source has a URL, retrieval date, type, and confidence grade.
- Every claim in the final reconstruction links to at least one source ID.
- Every inferred claim is marked `inferred`.
- Public and private access boundaries are documented.
- Dead links are checked against Wayback.
- Course codes are validated against official RISD catalog/Coursedog records.
- Readings are normalized by title, author, edition, and required/recommended status.
- Student work is never treated as official syllabus evidence unless it includes a course prompt or instructor attribution.

## Legal and Ethical Guardrails

- Collect only public web materials or materials the user has legal access to.
- Do not bypass authentication, paywalls, robots restrictions, private groups, or LMS access controls.
- Do not republish full copyrighted syllabi or readings where redistribution is not permitted.
- Store excerpts and structured metadata for analysis; keep raw files only where permitted.
- Do not scrape private student social accounts.
- Keep personally identifying information minimal and source-grounded.

## Initial Source Seeds

These should be manually verified first because they are high-yield seeds:

1. RISD Graphic Design BFA program page: `https://www.risd.edu/academics/graphic-design/bachelors-program`
2. RISD Graphic Design MFA program page: `https://www.risd.edu/academics/graphic-design/masters-programs`
3. RISD Graphic Design courses page: `https://www.risd.edu/academics/graphic-design/courses`
4. RISD Coursedog BFA Graphic Design catalog: `https://risd.coursedog.com/programs/cfa6776e92151000bceb55330dc80000`
5. RISD Teaching & Learning Lab syllabus guidance: `https://teachingandlearninglab.risd.edu/teaching-support/syllabus-and-course-design`
6. Adam Fein, `Introduction to Graphic Design`, Wintersession 2021 syllabus PDF: `https://ajfein.squarespace.com/s/AdamFein_IntroToGraphicDesign.pdf`
7. John Caserta, `Design Studio 1`, 2016 class page: `https://johncaserta.com/ds1-2016.html`
8. RISD news story on `In Motion: Design for Video and Animation`: `https://www.risd.edu/news/stories/risd-students-use-video-and-animation-techniques-bring-graphics-life`
9. RISD Digital Commons course catalogs and announcements
10. RISD Digital Commons Graphic Design theses and thesis-related records

## Implementation Notes

Preferred implementation is a reproducible research pipeline:

1. `seed_sources.mjs`: saves official RISD source URLs and search query templates.
2. `search_sources.mjs`: calls a search API or uses exported search results to build candidate URLs.
3. `fetch_sources.mjs`: fetches public HTML/PDF sources with rate limits and robots-aware behavior.
4. `parse_sources.mjs`: extracts text, sections, tables, links, and document metadata.
5. `extract_entities.mjs`: identifies course codes, titles, instructors, readings, assignments, dates, and tools.
6. `normalize_corpus.mjs`: deduplicates and links entities.
7. `reconstruct_courses.mjs`: creates course packets and evidence-graded reconstructions.
8. `audit_sources.mjs`: checks dead links, missing provenance, and ungrounded claims.

Use manual review after extraction. Fully automated extraction will miss studio-specific nuance, project constraints, and critique language.

## Definition of Done

The RISD Graphic Design corpus is useful when it can answer:

1. What would a student actually receive on day one for each recovered course?
2. What readings and assignments would they complete each week?
3. What would they make?
4. How would their work be critiqued?
5. What visual, conceptual, and material standards are implied?
6. Which parts are directly sourced and which parts are reconstructed?

The final deliverable should let a motivated learner take a reconstructed RISD-style course with source-grounded readings, exercises, critique criteria, and examples of expected output.
