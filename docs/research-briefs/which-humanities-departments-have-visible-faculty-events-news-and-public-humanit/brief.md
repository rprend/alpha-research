# Local KB Brief: Which humanities departments have visible faculty, events, news, and public humanities language in the local corpus?

Generated at: 2026-06-14T19:20:50.425Z
Inferred source priority: university-department-web

## Local Evidence Sources

- expanded-university-humanities-departments: 38 local docs; 2 direct evidence hits (university-department-web, active, local-analysis-only)
- stanford-humanities-departments: 17 local docs; 4 direct evidence hits (university-department-web, active, local-analysis-only)
- yale-humanities-departments: 15 local docs; 4 direct evidence hits (university-department-web, active, local-analysis-only)
- uchicago-humanities-departments: 12 local docs; 4 direct evidence hits (university-department-web, active, local-analysis-only)
- columbia-humanities-departments: 4 local docs; 1 direct evidence hits (university-department-web, active, local-analysis-only)
- humanities-centers-public-pages: 12 local docs; 3 direct evidence hits (university-department-web, active, local-analysis-only)
- harvard-humanities-departments: 5 local docs; 0 direct evidence hits (university-department-web, seeded-from-experiment, local-analysis-only)
- princeton-humanities-departments: 4 local docs; 0 direct evidence hits (university-department-web, planned, local-analysis-only)
- dh-conference-programs: 25 local docs; 0 direct evidence hits (conference-programs, active, metadata-only)
- doaj-humanities: 2948 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- openalex-humanities: 273 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- crossref-humanities: 208 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)

## Local Evidence Hits

- stanford-humanities-departments: Department of English (department-home; https://english.stanford.edu/)
- uchicago-humanities-departments: Home | Department of English Language and Literature (department-home; https://english.uchicago.edu/)
- uchicago-humanities-departments: Division of the Humanities (division-home; https://humanities.uchicago.edu/)
- stanford-humanities-departments: Department of Philosophy (department-home; https://philosophy.stanford.edu/)
- expanded-university-humanities-departments: Home | Department of History (department-home; https://history.berkeley.edu/)
- yale-humanities-departments: Welcome | Department of Comparative Literature (department-home; https://complit.yale.edu/)
- yale-humanities-departments: Department of History | (department-home; https://history.yale.edu/)
- columbia-humanities-departments: Department of History - Columbia University | (department-home; https://history.columbia.edu/)
- uchicago-humanities-departments: Department of Philosophy | Department of Philosophy (department-home; https://philosophy.uchicago.edu/)
- uchicago-humanities-departments: Department of History | Department of History (department-home; https://history.uchicago.edu/)

## Preliminary Study Design

- Unit of analysis: source page or institutional document
- Suggested method: compare term frequencies and framing across institution, department, source type, and capture/fetch year
- Time handling: date coverage is weak in direct hits; first normalize dates from matched source records
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims

## Candidate Outputs

- source coverage table by source_id and rights status
- top matching records with URLs and quote restrictions
- time-series table after date normalization
- missing-data memo for blocked, planned, and low-evidence sources

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
