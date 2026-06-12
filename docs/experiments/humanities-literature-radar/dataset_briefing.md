# Humanities Literature Radar Dataset Briefing

## What This Dataset Contains

This dataset is the first source-backed corpus for the Cultural Observatory / Archive Signals research program. It collects public metadata about recent humanities and humanities-adjacent scholarship from:

- OpenAlex
- Crossref
- DOAJ
- OSF Preprints / SocArXiv
- Knowledge Commons Works / Humanities Commons
- arXiv
- NBER search pages
- selected public department and digital-humanities pages

The current committed run is a bounded implementation corpus, not the final broad backfill. It proves source access, normalization, dedupe, source inventory, topic labeling, opportunity extraction, and article-draft generation.

## Current Files

- `data/raw/<source>/2026-06-12/`: raw source responses and manifests
- `data/interim/normalized-works.jsonl`: normalized work records before final table export
- `data/processed/works.json`: deduped work records
- `data/processed/works.csv`: tabular work inventory
- `data/processed/topics.json`: heuristic topic/method/signal counts
- `data/processed/topics.csv`: topic table
- `data/processed/representative-works.csv`: high-signal works for review
- `data/processed/quantitative-humanities-opportunities.csv`: candidate essay/study opportunities
- `reports/source-inventory.md`: source run summary
- `reports/report.html`: field-map artifact
- `reports/result.json`: structured result payload
- `reports/work.md`: work log and caveats
- `reports/public-draft.md`: public-facing draft scaffold

Current processed corpus summary:

- 128 deduped works
- 75 works dated 2024-present
- 45 quantitative/computational humanities candidates
- processed sources: OpenAlex, Crossref, DOAJ, OSF Preprints / SocArXiv, Knowledge Commons Works / Humanities Commons, and arXiv

## Fields

Primary work fields include:

- `work_id`
- `source_name`
- `source_record_id`
- `title`
- `abstract`
- `publication_date`
- `year`
- `doi`
- `url`
- `open_access_url`
- `venue_name`
- `publisher`
- `work_type`
- `authors`
- `institutions`
- `concepts`
- `references`
- `cited_by_count`
- `license`
- `raw_path`
- `disciplines`
- `methods`
- `quantitative_signals`
- `is_quantitative_humanities_candidate`

## Known Limitations

- The current run is intentionally bounded and should be expanded before public trend claims.
- Public metadata underrepresents books, book chapters, non-English scholarship, and paywalled humanities journals.
- DOAJ API search is appropriate for bounded discovery; large-scale DOAJ harvesting should use public dumps or OAI-PMH.
- OSF/SocArXiv coverage currently comes from bounded title searches, not a complete provider harvest.
- Knowledge Commons Works / Humanities Commons coverage currently uses bounded API keyword searches.
- arXiv records are filtered for humanities relevance, but some technical false positives may remain.
- Department-page records are coverage/enrichment evidence and should not be used to rank departments.
- Classification is heuristic and needs manual audit before publication.

## Starter Questions

- What are the main topic clusters in AI-and-humanities publishing since 2020?
- Which venues and sources publish computational or quantitative humanities work?
- Which methods are most visible: LLMs, corpus methods, bibliometrics, network analysis, stylometry, or topic modeling?
- Which works should be manually reviewed before publishing the first field-map essay?
- What source gaps would change the interpretation most?
- Which candidate public essays are ready for a larger data run?
