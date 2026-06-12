# Humanities Literature Radar Dataset Briefing

## What This Dataset Contains

This dataset is the source-backed literature-radar corpus for the Cultural Observatory / Archive Signals research program. It collects public metadata about recent humanities and humanities-adjacent scholarship from OpenAlex, Crossref, DOAJ, OSF Preprints / SocArXiv, Knowledge Commons Works / Humanities Commons, arXiv, NBER search pages, and selected public department pages.

The current committed run is a bounded implementation corpus. It is ready for field-map research and publication drafting with source-coverage caveats, but broad trend claims should wait for larger source backfills and manual audit of representative records.

## Current Corpus

- 4434 deduped works
- 2512 works dated 2024-present
- 965 quantitative/computational humanities candidates
- processed sources: hcommons, doaj-oai, crossref, arxiv, doaj, openalex, osf-preprints
- readiness: ready-for-editorial-review
- bootstrap monitor: 0 genuinely new publications and 0 newly discovered old records

## Current Files

- `manifest.json`: dataset bundle manifest
- `dataset_profile.json`: machine-readable dataset profile
- `schema.json`: inferred processed-work schema
- `sample_rows.json`: bounded sample rows for prompt/dashboard context
- `processed/works.json`: deduped work records
- `processed/works.csv`: tabular work inventory
- `processed/topics.json`: heuristic topic/method/signal counts
- `processed/representative-works.csv`: high-signal works for review
- `processed/quantitative-humanities-opportunities.csv`: candidate essay/study opportunities
- `reports/source-inventory.md`: source run summary
- `reports/result.json`: structured field-map result payload
- `reports/work.md`: work log and caveats
- `runs/2026-06-12/`: bootstrap recurring monitor run

## Fields

Primary work fields include `work_id`, `source_name`, `source_record_id`, `title`, `abstract`, `publication_date`, `year`, `doi`, `url`, `open_access_url`, `venue_name`, `publisher`, `work_type`, `authors`, `institutions`, `concepts`, `references`, `cited_by_count`, `license`, `raw_path`, `disciplines`, `methods`, `quantitative_signals`, and `is_quantitative_humanities_candidate`.

## Current Topic Signals

history (1737), literature (921), philosophy (653), sociology (422), digital humanities (364), network (248), corpus (224), political science (205), spatial (194), large language models (186)

## Known Limitations

- This first artifact uses public metadata and abstracts where available, not full-text scholarship.
- Open indexes underrepresent books, chapters, non-English work, and paywalled humanities journals.
- Trend claims require source-coverage checks and manual review of representative works before publication.
- Public metadata underrepresents books, book chapters, non-English scholarship, and paywalled humanities journals.
- Department-page records are coverage/enrichment evidence and should not be used to rank departments.
- Classification is heuristic and needs manual audit before public claims.

## Starter Questions

- What are the main topic clusters in AI-and-humanities publishing since 2020?
- Which venues and sources publish computational or quantitative humanities work?
- Which methods are most visible across the corpus?
- Which representative works should be manually reviewed before publishing the first field-map essay?
- What source gaps would change the interpretation most?
