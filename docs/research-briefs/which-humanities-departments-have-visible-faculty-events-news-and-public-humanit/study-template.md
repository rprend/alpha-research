# Study Template: Which humanities departments have visible faculty, events, news, and public humanities language in the local corpus?

## Local Tables

- source_documents
- rights
- pages
- works
- objects
- venues
- authors
- citations
- topics

## Unit Of Analysis

source page or institutional document

## Claim Strength

moderate local evidence for scoping; needs source-specific normalization before publication claims

## Date Coverage

fetch-date-only-or-missing: Matched local records lack enough content-date fields for longitudinal claims; use fetch dates only for crawl coverage, not historical interpretation.

## Minimum Next Steps

- Review evidence.json for quote restrictions and source URLs.
- Run queries.sql against data/knowledge-base/processed/knowledge-base.sqlite.
- Normalize dates and source-specific identifiers before longitudinal claims.
- Use missing-data.md before any fresh scrape.

## Publication Concept

- Humanities Departments Visible Faculty, Events, News, Public Humanities
- What Local Humanities Data Shows About humanities departments visible faculty, events, news, public humanities
- A Field Map Of humanities departments visible faculty, events, news, public humanities

## Candidate Charts And Tables

- Department-page hit counts by school and page_type
- Concept frequency by department over fetch/archive year
- Matched source coverage by institution and rights status

## Follow-Up Acquisition

- Run deeper source-specific department crawlers for faculty/events/news/program pages on successful domains.
- Add replacement public routes or Wayback metadata for 403 department homepages.

## Why This Matters

This question can now start from local university-department-web evidence instead of fresh scraping, with 18 direct hits and top local sources including Expanded University Humanities Department Public Pages, Stanford Humanities Department Public Pages, Yale Humanities Department Public Pages.
