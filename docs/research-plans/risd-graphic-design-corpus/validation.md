# RISD Graphic Design Corpus Validation

Generated: 2026-06-12

Overall status: pass

## Counts

- Sources: 142
- Courses: 134
- Official course inventory: 105
- RISD displayed course count: 105
- Syllabi/course artifacts: 82
- Structured syllabus records: 82
- Assignments: 585
- Structured assignment snippets: 585
- Studio-phase assignment snippets: 585
- High-confidence assignments: 121
- Medium-confidence assignments: 130
- Low-confidence assignment fragments: 334
- Long assignment brief blocks: 54
- Readings: 135
- Normalized reading snippets: 56
- Canonical reading works: 30
- Local catalog reading matches: 43
- External catalog reading matches: 12
- External catalog lookup attempts: 30
- Unresolved reading snippets: 45
- Non-citation reading fragments: 34
- Search candidates: 34
- Promoted search candidates: 10
- Imported search candidates: 0
- Live search API candidates: 6
- Live search provider-unconfigured rows: 6
- Common Crawl candidates: 168
- Common Crawl fetch candidates: 35
- Ingested Common Crawl candidates: 8
- Common Crawl promotions: 8
- Successful Common Crawl promotions: 8
- Ingested Common Crawl promotions: 8
- Faculty profile candidates: 47
- Ingested faculty profile candidates: 45
- Faculty rows with profile URLs: 26
- Faculty rows: 26
- Faculty-course edges: 48
- Student work rows: 41
- Structured student work rows: 41
- Course coverage rows: 134
- Courses at 80+ coverage: 7
- Courses below 40 coverage: 112
- Faculty portfolio examples: 60
- Structured faculty portfolio examples: 60
- Source clusters: 13
- Exact duplicate clusters: 2
- Near-duplicate source clusters: 1
- Related source-family clusters: 10
- Course packets with clustered evidence: 117
- Source versions: 28
- Fetched archive source comparisons: 1
- Metadata-only source versions: 27
- Wayback captures: 106
- Review queue rows: 11
- Review decision rows: 11
- Resolved generated review decisions: 11
- Field conflicts: 7

## Checks

- PASS sources_have_required_metadata: 142 sources inspected.
- PASS failed_fetches_do_not_create_syllabi: 0 syllabus rows reference failed sources.
- PASS syllabi_have_course_identity: 0 syllabus rows lack both course code and title.
- PASS syllabi_have_structured_top_level_fields: 82 syllabus rows include top-level schema fields for schedule, readings, policies, tools, materials, evidence, or raw excerpts.
- PASS assignments_reference_valid_syllabi_and_sources: 0 assignment reference errors.
- PASS assignments_have_structured_signals: 585 assignment snippets include inferred deliverables, constraints, tools, critique, revision, or tacit goals.
- PASS assignments_have_studio_phase_signals: 585 assignment snippets include assignment type, studio phase, or output-format signals.
- PASS assignments_have_confidence_boundaries: 121 high, 130 medium, and 334 low confidence assignment rows; 0 boundary metadata errors.
- PASS assignments_include_long_brief_blocks: 54 assignment records contain long prompt/brief blocks rather than only sentence snippets.
- PASS readings_reference_valid_syllabi_and_sources: 0 reading reference errors.
- PASS readings_have_normalized_work_links: 56 reading snippets linked to 30 canonical works; 43 local catalog matches, 12 external catalog matches, 45 unresolved, 34 non-citation fragments.
- PASS readings_external_links_have_metadata: 30 Open Library lookup attempts recorded; 12 reading snippets have external catalog matches; 0 external-link metadata errors.
- PASS search_candidates_have_provenance: 34 search candidates, 10 promoted, 0 imported, 6 live API rows (6 provider-unconfigured); 0 candidate reference errors.
- PASS common_crawl_candidates_have_provenance: 168 Common Crawl candidates, 35 fetch candidates, 8 ingested; 0 provenance errors.
- PASS common_crawl_promotions_reference_candidates: 8 Common Crawl promotions, 8 successful, 8 ingested; 0 reference errors.
- PASS faculty_graph_references_valid_sources: 26 faculty rows and 48 faculty-course edges; 0 reference errors.
- PASS faculty_profile_candidates_have_provenance: 47 faculty profile candidates, 45 ingested, 26 faculty rows with profile URLs; 0 reference errors.
- PASS student_work_reference_valid_sources: 0 student work source reference errors.
- PASS student_work_has_structured_public_examples: 41 student work rows include URL plus medium/project/evidence metadata.
- PASS course_coverage_matrix_references_valid_sources: 134 course coverage rows for 134 courses; 7 at 80+ coverage, 112 below 40 coverage, and 0 coverage metadata/reference errors.
- PASS faculty_portfolio_examples_reference_valid_sources: 0 faculty portfolio example reference errors across 60 examples.
- PASS faculty_portfolio_examples_have_structured_metadata: 60 faculty portfolio examples include faculty plus title/medium/statement/visual metadata.
- PASS source_clusters_reference_valid_sources: 0 source cluster reference errors across 13 clusters.
- PASS source_clusters_include_dedup_signals: 2 exact duplicate clusters, 1 near-duplicate text clusters, and 10 related source-family clusters.
- PASS source_clusters_are_used_for_packet_grouping: 117 course packets include source-cluster grouped evidence families.
- PASS source_versions_reference_valid_sources: 0 source version reference errors across 28 version rows.
- PASS source_versions_record_wayback_comparisons: 1 fetched archive comparisons and 27 metadata-only version rows.
- PASS manual_review_artifacts_have_valid_references: 11 generated review decisions resolved, 0 review decision reference errors, and 0 field conflict reference errors.
- PASS official_course_inventory_reconciled: 105 official offerings parsed; RISD page displays 105 results.
- PASS wayback_captures_recorded: 106 Wayback capture records.
- PASS course_records_created: 134 course records created.
