# Local KB Brief: Which cultural entities, movements, authors, and institutions can anchor a field map of modern humanities topics?

Generated at: 2026-06-14T19:30:53.113Z
Inferred source priority: linked-open-data, scholarly-metadata, journals-and-reviews

## Local Evidence Sources

- crossref-humanities: 208 local docs; 1 direct evidence hits (scholarly-metadata, active, metadata-ok)
- openalex-humanities: 273 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- doaj-humanities: 2948 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- wikidata-cultural-entities: 757 local docs; 0 direct evidence hits (linked-open-data, active, derived-metadata-ok)
- journal-new-literary-history: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- journal-pmla: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- journal-digital-humanities-quarterly: 10 local docs; 0 direct evidence hits (journals-and-reviews, active, local-analysis-only)
- public-books: 10 local docs; 0 direct evidence hits (journals-and-reviews, active, local-analysis-only)
- journal-critical-inquiry: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- project-gutenberg: 200 local docs; 7 direct evidence hits (public-domain-texts, active, public-domain-text-ok)
- internet-archive-metadata: 150 local docs; 0 direct evidence hits (open-text-metadata, active, metadata-only)
- dh-conference-programs: 25 local docs; 0 direct evidence hits (conference-programs, active, metadata-only)

## Local Evidence Hits

- crossref-humanities: Digital Humanities as a Field (scholarly-work; https://doi.org/10.2307/j.ctv65sx0t.6)
- expanded-university-humanities-departments: Front Page | English Department (department-home; https://english.duke.edu/)
- expanded-university-humanities-departments: Department of History | Department of History (department-home; https://history.cornell.edu/)
- expanded-university-humanities-departments: Home - Department of English UCLA (department-home; https://english.ucla.edu/)
- project-gutenberg: Henry Clay's Remarks in House and Senate (public-domain-book; https://www.gutenberg.org/ebooks/739)
- expanded-university-humanities-departments: Welcome to Literatures in English | Literatures in English (department-home; https://english.cornell.edu/)
- yale-humanities-departments: Current Job Searches | Department of History (department-about; https://history.yale.edu/about-us/current-job-searches)
- stanford-humanities-departments: Department of Philosophy (department-home; https://philosophy.stanford.edu/)
- project-gutenberg: William Gibson Interviewed (public-domain-book; https://www.gutenberg.org/ebooks/235)
- uchicago-humanities-departments: Home | Department of English Language and Literature (department-home; https://english.uchicago.edu/)

## Preliminary Study Design

- Unit of analysis: linked cultural entity, person, work, movement, institution, or concept
- Suggested method: build an entity table first, then join people, works, movements, institutions, and concepts to scholarly or collection records
- Time handling: content-date coverage spans 1400-2026; use date-coverage.json to separate content years from fetch years before longitudinal claims
- Date coverage: 3934 matched local records carry content years spanning 1400-2026; 7 matched sources look longitudinal-ready for scoping.
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims

## Candidate Outputs

- source coverage table by source_id and rights status
- top matching records with URLs and quote restrictions
- time-series table after date normalization
- missing-data memo for blocked, planned, and low-evidence sources
- publication-year trend table by venue and source
- top venue and publisher table for matched works
- author/institution coverage table after identity normalization

## Publication Concept

- Working title: Cultural Entities, Movements, Authors, Institutions Can Anchor Field
- Why this matters: This question can now start from local linked-open-data, scholarly-metadata, journals-and-reviews evidence instead of fresh scraping, with 18 direct hits and top local sources including Crossref Humanities DOI Metadata, OpenAlex Humanities Metadata, DOAJ Humanities Open Access Metadata.
- Follow-up acquisition: Expand Wikidata cultural-entity pulls for matched occupations, movements, works, institutions, and humanities concepts.

## Planned Or Missing Leads

No matched planned leads without local documents.

## What Can Be Checked Locally First

- Query the source registry for relevant source classes and rights constraints.
- Check `data/knowledge-base/audits/kb-status.md` for local table and text availability.
- Use existing experiment artifacts listed in `data/knowledge-base/audits/existing-experiment-inventory.md` before starting a new scrape.

## Claim Boundaries

- Treat `planned` sources as leads, not evidence.
- Treat `seeded-from-experiment` sources as partial evidence until promoted into KB raw/processed tables.
- Do not quote or redistribute full text unless the source rights fields allow it.
