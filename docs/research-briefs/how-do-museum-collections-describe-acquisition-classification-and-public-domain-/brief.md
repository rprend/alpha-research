# Local KB Brief: How do museum collections describe acquisition, classification, and public-domain image availability?

Generated at: 2026-06-14T19:26:44.737Z
Inferred source priority: cultural-collections

## Local Evidence Sources

- met-collection-api: 255 local docs; 10 direct evidence hits (cultural-collections, active, metadata-ok)
- cleveland-museum-open-access: 200 local docs; 8 direct evidence hits (cultural-collections, active, metadata-ok)
- smithsonian-open-access: 225 local docs; 0 direct evidence hits (cultural-collections, active, metadata-ok)
- library-of-congress: 308 local docs; 0 direct evidence hits (cultural-collections, active, metadata-ok)
- internet-archive-metadata: 150 local docs; 0 direct evidence hits (open-text-metadata, active, metadata-only)
- wikidata-cultural-entities: 757 local docs; 0 direct evidence hits (linked-open-data, active, derived-metadata-ok)
- project-gutenberg: 200 local docs; 0 direct evidence hits (public-domain-texts, active, public-domain-text-ok)
- expanded-university-humanities-departments: 38 local docs; 0 direct evidence hits (university-department-web, active, local-analysis-only)
- journal-new-literary-history: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- journal-pmla: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- museum-language-drift: 24 local docs; 0 direct evidence hits (experiment-derived, seeded-from-experiment, local-analysis-only)
- stanford-humanities-departments: 17 local docs; 0 direct evidence hits (university-department-web, active, local-analysis-only)

## Local Evidence Hits

- cleveland-museum-open-access: Twilight in the Wilderness (museum-object; https://clevelandart.org/art/1965.233)
- cleveland-museum-open-access: Stag at Sharkey's (museum-object; https://clevelandart.org/art/1922.1133)
- cleveland-museum-open-access: Nathaniel Hurd (museum-object; https://clevelandart.org/art/1915.534)
- cleveland-museum-open-access: Mme L . . . (Laure Borreau) (museum-object; https://clevelandart.org/art/1962.2)
- cleveland-museum-open-access: The Biglin Brothers Turning the Stake (museum-object; https://clevelandart.org/art/1927.1984)
- cleveland-museum-open-access: In the Waves (Dans les Vagues) (museum-object; https://clevelandart.org/art/1978.63)
- cleveland-museum-open-access: Portrait of Dora Wheeler (museum-object; https://clevelandart.org/art/1921.1239)
- cleveland-museum-open-access: The Race Track (Death on a Pale Horse) (museum-object; https://clevelandart.org/art/1928.8)
- met-collection-api: Painting (museum-object; https://www.metmuseum.org/art/collection/search/488660)
- met-collection-api: Painting (museum-object; https://www.metmuseum.org/art/collection/search/490190)

## Preliminary Study Design

- Unit of analysis: collection object or public metadata record
- Suggested method: compare object metadata fields across institution, department, classification, date, rights, and image availability
- Time handling: date coverage is weak in direct hits; first normalize dates from matched source records
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims

## Candidate Outputs

- source coverage table by source_id and rights status
- top matching records with URLs and quote restrictions
- time-series table after date normalization
- missing-data memo for blocked, planned, and low-evidence sources
- term-frequency table by school, department, page_type, and fetch year
- institution-by-concept heatmap for department language
- page-type comparison table for home/about/news/events/faculty pages

## Publication Concept

- Working title: Museum Collections Describe Acquisition, Classification, Public-domain Image Availability
- Why this matters: This question can now start from local cultural-collections evidence instead of fresh scraping, with 18 direct hits and top local sources including Metropolitan Museum of Art Collection API, Cleveland Museum of Art Open Access API, Smithsonian Open Access.
- Follow-up acquisition: Expand cultural-collection API pulls by institution, classification, and accession/acquisition fields.

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
