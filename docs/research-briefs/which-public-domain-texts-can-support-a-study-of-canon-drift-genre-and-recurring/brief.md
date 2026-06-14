# Local KB Brief: Which public-domain texts can support a study of canon drift, genre, and recurring language?

Generated at: 2026-06-14T19:30:52.865Z
Inferred source priority: public-domain-texts, open-text-metadata

## Local Evidence Sources

- project-gutenberg: 200 local docs; 16 direct evidence hits (public-domain-texts, active, public-domain-text-ok)
- internet-archive-metadata: 150 local docs; 0 direct evidence hits (open-text-metadata, active, metadata-only)
- openalex-humanities: 273 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- expanded-university-humanities-departments: 38 local docs; 2 direct evidence hits (university-department-web, active, local-analysis-only)
- doaj-humanities: 2948 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- wikidata-cultural-entities: 757 local docs; 0 direct evidence hits (linked-open-data, active, derived-metadata-ok)
- crossref-humanities: 208 local docs; 0 direct evidence hits (scholarly-metadata, active, metadata-ok)
- met-collection-api: 255 local docs; 0 direct evidence hits (cultural-collections, active, metadata-ok)
- stanford-humanities-departments: 17 local docs; 0 direct evidence hits (university-department-web, active, local-analysis-only)
- cleveland-museum-open-access: 200 local docs; 0 direct evidence hits (cultural-collections, active, metadata-ok)
- journal-new-literary-history: 25 local docs; 0 direct evidence hits (journals-and-reviews, active, metadata-only)
- museum-language-drift: 24 local docs; 0 direct evidence hits (experiment-derived, seeded-from-experiment, local-analysis-only)

## Local Evidence Hits

- project-gutenberg: Henry Clay's Remarks in House and Senate (public-domain-book; https://www.gutenberg.org/ebooks/739)
- project-gutenberg: On the Decay of the Art of Lying (public-domain-book; https://www.gutenberg.org/ebooks/2572)
- project-gutenberg: William Gibson Interviewed (public-domain-book; https://www.gutenberg.org/ebooks/235)
- project-gutenberg: Tales and Novels of J. de La Fontaine — Volume 25 (public-domain-book; https://www.gutenberg.org/ebooks/5299)
- project-gutenberg: The Experiences of a Bandmaster (public-domain-book; https://www.gutenberg.org/ebooks/2589)
- project-gutenberg: A Few Figs from Thistles (public-domain-book; https://www.gutenberg.org/ebooks/4399)
- project-gutenberg: The Lady, or the Tiger? (public-domain-book; https://www.gutenberg.org/ebooks/396)
- project-gutenberg: Tales and Novels of J. de La Fontaine — Volume 02 (public-domain-book; https://www.gutenberg.org/ebooks/5276)
- project-gutenberg: The Star-Spangled Banner (public-domain-book; https://www.gutenberg.org/ebooks/727)
- project-gutenberg: The Story of Little Black Sambo, and The Story of Little Black Mingo (public-domain-book; https://www.gutenberg.org/ebooks/1330)

## Preliminary Study Design

- Unit of analysis: public-domain text or bibliographic metadata record
- Suggested method: build a rights-filtered text/metadata evidence table, then separate quote-ready full text from discovery-only records
- Time handling: content-date coverage spans 1710-2020; use date-coverage.json to separate content years from fetch years before longitudinal claims
- Date coverage: 147 matched local records carry content years spanning 1710-2020; 1 matched sources look longitudinal-ready for scoping.
- Claim strength: moderate local evidence for scoping; needs source-specific normalization before publication claims

## Candidate Outputs

- source coverage table by source_id and rights status
- top matching records with URLs and quote restrictions
- time-series table after date normalization
- missing-data memo for blocked, planned, and low-evidence sources
- public-domain text hit table with source URLs and quote status
- genre/bookshelf coverage table
- term/context concordance table over reusable full text

## Publication Concept

- Working title: Public-domain Texts Can Support Study Canon Drift, Genre,
- Why this matters: This question can now start from local public-domain-texts, open-text-metadata evidence instead of fresh scraping, with 18 direct hits and top local sources including Project Gutenberg Catalog And Texts, Internet Archive Metadata.
- Follow-up acquisition: Expand Project Gutenberg/public-domain text imports for matched authors, genres, and bookshelves.

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
