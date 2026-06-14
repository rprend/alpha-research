# Local KB Brief: What local evidence exists for public humanities language in departments?

Generated at: 2026-06-14T20:04:11.033Z
Inferred source priority: university-department-web

## Local Evidence Sources

- expanded-university-humanities-departments: 214 local docs; 8 direct evidence hits (university-department-web, active, local-analysis-only)
- stanford-humanities-departments: 97 local docs; 4 direct evidence hits (university-department-web, active, local-analysis-only)
- yale-humanities-departments: 55 local docs; 2 direct evidence hits (university-department-web, active, local-analysis-only)
- uchicago-humanities-departments: 32 local docs; 3 direct evidence hits (university-department-web, active, local-analysis-only)
- columbia-humanities-departments: 4 local docs; 1 direct evidence hits (university-department-web, active, local-analysis-only)
- humanities-centers-public-pages: 12 local docs; 0 direct evidence hits (university-department-web, active, local-analysis-only)
- harvard-humanities-departments: 5 local docs; 0 direct evidence hits (university-department-web, seeded-from-experiment, local-analysis-only)
- princeton-humanities-departments: 13 local docs; 0 direct evidence hits (university-department-web, planned, local-analysis-only)
- dh-conference-programs: 25 local docs; 0 direct evidence hits (conference-programs, active, metadata-only)
- doaj-humanities: 2948 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- openalex-humanities: 273 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- crossref-humanities: 208 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)

## Local Evidence Hits

- uchicago-humanities-departments: Home | Department of English Language and Literature (department-home; https://english.uchicago.edu/)
- stanford-humanities-departments: Department of English (department-home; https://english.stanford.edu/)
- expanded-university-humanities-departments: Department of History | Department of History (department-home; https://history.cornell.edu/)
- expanded-university-humanities-departments: English | Brown University (department-home; https://english.brown.edu/)
- uchicago-humanities-departments: Division of the Humanities (division-home; https://humanities.uchicago.edu/)
- yale-humanities-departments: Welcome | Department of Comparative Literature (department-home; https://complit.yale.edu/)
- expanded-university-humanities-departments: Welcome to Literatures in English | Literatures in English (department-home; https://english.cornell.edu/)
- expanded-university-humanities-departments: Home | Department of History (department-home; https://history.berkeley.edu/)
- expanded-university-humanities-departments: Home | Rhetoric (department-home; https://rhetoric.berkeley.edu/)
- expanded-university-humanities-departments: UCLA Department of History (department-home; https://history.ucla.edu/)

## Preliminary Study Design

- Unit of analysis: source page or institutional document
- Suggested method: compare term frequencies and framing across institution, department, source type, and capture/fetch year
- Time handling: date coverage is weak; first normalize source-specific date fields and avoid longitudinal claims based only on fetch dates
- Date coverage: Matched local records lack enough content-date fields for longitudinal claims; use fetch dates only for crawl coverage, not historical interpretation.
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims

## Candidate Outputs

- source coverage table by source_id and rights status
- top matching records with URLs and quote restrictions
- time-series table after date normalization
- missing-data memo for blocked, planned, and low-evidence sources
- term-frequency table by school, department, page_type, and fetch year
- institution-by-concept heatmap for department language
- page-type comparison table for home/about/news/events/faculty pages

## Identity And Reference Leads

- Candidate people matching question terms: 2
- Candidate work references matching question terms: 12
- Person: Jak Spencer (name-only; 1 records; openalex-humanities)
- Person: Prince Atorkey (name-only; 1 records; openalex-humanities)
- Reference: 10.1017/CBO9780511597473 (doi; 5 citation edges; high)
- Reference: 10.2307/2861952 (doi; 5 citation edges; high)
- Reference: https://openalex.org/W2164861810 (openalex-work; 5 citation edges; high)
- Reference: https://openalex.org/W2462161029 (openalex-work; 5 citation edges; high)
- Reference: https://openalex.org/W2753533763 (openalex-work; 5 citation edges; high)

## Publication Concept

- Working title: Local Evidence Exists Public Humanities Language Departments
- Why this matters: This question can now start from local university-department-web evidence instead of fresh scraping, with 18 direct hits and top local sources including Expanded University Humanities Department Public Pages, Stanford Humanities Department Public Pages, Yale Humanities Department Public Pages.
- Follow-up acquisition: Run deeper source-specific department crawlers for faculty/events/news/program pages on successful domains.

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
