# KB Date Quality Audit

Generated at: 2026-06-14T22:11:03.492Z
Status: pass

## nber-culture-history

Status: pass
Date kind: publication-date
Rows: 50
Year coverage: 100%
ISO date coverage: 100%
Source-label coverage: 100%
Fetch timestamp coverage: 100%
Precision-label coverage: 0%
Fetch-date-only risks: 0
Study-period risks: 0

Failures: none

NBER rows should use page-level citation_publication_date metadata, not search-result display dates or crawl timestamps.

## ssrn-humanities-adjacent

Status: pass
Date kind: posted-or-issued-year
Rows: 25
Year coverage: 100%
ISO date coverage: 0%
Source-label coverage: 100%
Fetch timestamp coverage: 100%
Precision-label coverage: 0%
Fetch-date-only risks: 0
Study-period risks: 0

Failures: none

SSRN rows currently come from Crossref posted-content metadata; publication_year is treated as an issued/posted year, not SSRN page full-text evidence.

## conference-programs

Status: pass
Date kind: mixed-page-date-event-year
Rows: 51
Year coverage: 92%
ISO date coverage: 49%
Source-label coverage: 0%
Fetch timestamp coverage: 100%
Precision-label coverage: 100%
Fetch-date-only risks: 0
Study-period risks: 0

Failures: none

Conference rows mix page/post dates, event-year records, and program metadata. The audit requires broad year coverage and fetch provenance, but does not treat these dates as normalized event dates yet.

## university-department-web

Status: pass
Date kind: crawl-snapshot-date
Rows: 533
Year coverage: 0%
ISO date coverage: 0%
Source-label coverage: 0%
Fetch timestamp coverage: 100%
Precision-label coverage: 0%
Fetch-date-only risks: 0
Study-period risks: 0

Failures: none

Department web rows are current-page crawl snapshots unless a source-specific event/page date is later extracted. `fetched_at` is provenance, not a content date.

## cultural-collections

Status: pass
Date kind: object-or-item-date
Rows: 988
Year coverage: 96%
ISO date coverage: 0%
Source-label coverage: 0%
Fetch timestamp coverage: 100%
Precision-label coverage: 100%
Fetch-date-only risks: 0
Study-period risks: 0

Failures: none

Cultural collection rows use item/object dates and accession years where supplied. These are not publication dates and need source-specific precision parsing before strong object-date trend claims.
