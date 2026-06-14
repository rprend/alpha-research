# KB Failed Route Replacement Plans

Generated at: 2026-06-14T19:50:55.513Z
Replacement plans: 15

## harvard-humanities-departments

- Name: Harvard Humanities Department Public Pages
- Class: university-department-web
- Ingest status: seeded-from-experiment
- Replacement status: replacement-needed
- Failure count: 14
- Latest failure: 2026-06-14T19:49:18.974Z
- Latest error: HTTP 403 Forbidden
- Affected targets: Harvard University English department-sitemap; Harvard University History department-sitemap; Harvard University Philosophy department-sitemap; Harvard University Classics department-sitemap
- Failed routes:
  - https://english.fas.harvard.edu/
  - https://history.fas.harvard.edu/
  - https://philosophy.fas.harvard.edu/
  - https://classics.fas.harvard.edu/
  - https://english.fas.harvard.edu/sitemap.xml
  - https://history.fas.harvard.edu/sitemap.xml
  - https://philosophy.fas.harvard.edu/sitemap.xml
  - https://classics.fas.harvard.edu/sitemap.xml
- Replacement routes:
  - Use already responding same-domain department pages discovered from successful homepages.
  - Try official school search, sitemap.xml, RSS/news feeds, or department directory pages before retrying blocked homepages.
  - Use Wayback CDX metadata for historical coverage; do not store archived page text unless rights are reviewed.
- Next action: Create source-specific alternate target entries for Harvard University English department-sitemap, Harvard University History department-sitemap, Harvard University Philosophy department-sitemap, Harvard University Classics department-sitemap using public about/news/events/faculty routes that return 200.
- Do not do: Do not bypass 403 responses, spoof browsers, solve challenges, or scrape behind access controls.

## expanded-university-humanities-departments

- Name: Expanded University Humanities Department Public Pages
- Class: university-department-web
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 12
- Latest failure: 2026-06-14T19:49:30.609Z
- Latest error: HTTP 403 Forbidden
- Affected targets: University of California, Berkeley History department-sitemap; University of California, Berkeley Rhetoric department-sitemap; University of Michigan English Language and Literature department-sitemap; University of Michigan History department-sitemap; University of Pennsylvania English department-sitemap; University of Pennsylvania History department-sitemap
- Failed routes:
  - https://lsa.umich.edu/english
  - https://lsa.umich.edu/history
  - https://www.history.upenn.edu/
  - https://history.berkeley.edu/sitemap.xml
  - https://rhetoric.berkeley.edu/sitemap.xml
  - https://lsa.umich.edu/sitemap.xml
  - https://www.english.upenn.edu/sitemap.xml
  - https://www.history.upenn.edu/sitemap.xml
- Replacement routes:
  - Use already responding same-domain department pages discovered from successful homepages.
  - Try official school search, sitemap.xml, RSS/news feeds, or department directory pages before retrying blocked homepages.
  - Use Wayback CDX metadata for historical coverage; do not store archived page text unless rights are reviewed.
- Next action: Create source-specific alternate target entries for University of California, Berkeley History department-sitemap, University of California, Berkeley Rhetoric department-sitemap, University of Michigan English Language and Literature department-sitemap, University of Michigan History department-sitemap, University of Pennsylvania English department-sitemap, University of Pennsylvania History department-sitemap using public about/news/events/faculty routes that return 200.
- Do not do: Do not bypass 403 responses, spoof browsers, solve challenges, or scrape behind access controls.

## princeton-humanities-departments

- Name: Princeton Humanities Department Public Pages
- Class: university-department-web
- Ingest status: planned
- Replacement status: replacement-needed
- Failure count: 10
- Latest failure: 2026-06-14T19:14:40.327Z
- Latest error: HTTP 403 Forbidden
- Affected targets: No target metadata.
- Failed routes:
  - https://english.princeton.edu/
  - https://history.princeton.edu/
  - https://philosophy.princeton.edu/
  - https://artandarchaeology.princeton.edu/
- Replacement routes:
  - Use already responding same-domain department pages discovered from successful homepages.
  - Try official school search, sitemap.xml, RSS/news feeds, or department directory pages before retrying blocked homepages.
  - Use Wayback CDX metadata for historical coverage; do not store archived page text unless rights are reviewed.
- Next action: Create source-specific alternate target entries for princeton-humanities-departments using public about/news/events/faculty routes that return 200.
- Do not do: Do not bypass 403 responses, spoof browsers, solve challenges, or scrape behind access controls.

## columbia-humanities-departments

- Name: Columbia Humanities Department Public Pages
- Class: university-department-web
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 7
- Latest failure: 2026-06-14T19:49:24.052Z
- Latest error: HTTP 403 Forbidden
- Affected targets: Columbia University English and Comparative Literature department-sitemap; Columbia University History department-sitemap; Columbia University Philosophy department-sitemap
- Failed routes:
  - https://english.columbia.edu/
  - https://philosophy.columbia.edu/
  - https://english.columbia.edu/sitemap.xml
  - https://history.columbia.edu/sitemap.xml
  - https://philosophy.columbia.edu/sitemap.xml
- Replacement routes:
  - Use already responding same-domain department pages discovered from successful homepages.
  - Try official school search, sitemap.xml, RSS/news feeds, or department directory pages before retrying blocked homepages.
  - Use Wayback CDX metadata for historical coverage; do not store archived page text unless rights are reviewed.
- Next action: Create source-specific alternate target entries for Columbia University English and Comparative Literature department-sitemap, Columbia University History department-sitemap, Columbia University Philosophy department-sitemap using public about/news/events/faculty routes that return 200.
- Do not do: Do not bypass 403 responses, spoof browsers, solve challenges, or scrape behind access controls.

## lareviewofbooks

- Name: Los Angeles Review of Books
- Class: journals-and-reviews
- Ingest status: blocked
- Replacement status: replacement-needed
- Failure count: 4
- Latest failure: 2026-06-13T16:41:51.214Z
- Latest error: HTTP 404 Not Found
- Affected targets: No target metadata.
- Failed routes:
  - https://lareviewofbooks.org/feed/
- Replacement routes:
  - Find the current RSS/feed URL from the site homepage or sitemap.
  - Use WordPress discovery endpoints such as /wp-json/wp/v2/posts only if public and allowed.
  - Use Crossref/OpenAlex/Internet Archive metadata as fallback for bibliographic discovery.
- Next action: Replace the stale feed URL before another automated ingest.
- Do not do: Do not repeatedly retry the known 404 feed route.

## uchicago-humanities-departments

- Name: University of Chicago Humanities Department Public Pages
- Class: university-department-web
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 3
- Latest failure: 2026-06-14T19:49:23.051Z
- Latest error: HTTP 404 Not Found
- Affected targets: University of Chicago Humanities Division department-sitemap; University of Chicago English department-sitemap; University of Chicago Philosophy department-sitemap
- Failed routes:
  - https://humanities.uchicago.edu/sitemap.xml
  - https://english.uchicago.edu/sitemap.xml
  - https://philosophy.uchicago.edu/sitemap.xml
- Replacement routes:
  - Try source-specific sitemap locations such as /sitemap_index.xml, /sitemap.xml.gz, or CMS-provided XML indexes where public.
  - Use already responding same-domain department pages and their discovered internal links.
  - Use official school directories, RSS/news feeds, or Wayback CDX metadata when current sitemap routes are absent.
- Next action: Create source-specific alternate sitemap/directory targets for University of Chicago Humanities Division department-sitemap, University of Chicago English department-sitemap, University of Chicago Philosophy department-sitemap; keep missing sitemap routes logged as failed metadata routes.
- Do not do: Do not repeatedly retry absent sitemap.xml routes or infer page text from sitemap URL metadata.

## yale-humanities-departments

- Name: Yale Humanities Department Public Pages
- Class: university-department-web
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 2
- Latest failure: 2026-06-14T19:49:19.491Z
- Latest error: HTTP 404 Not Found
- Affected targets: Yale University English department-sitemap; Yale University History department-sitemap
- Failed routes:
  - https://english.yale.edu/sitemap.xml
  - https://history.yale.edu/sitemap.xml
- Replacement routes:
  - Try source-specific sitemap locations such as /sitemap_index.xml, /sitemap.xml.gz, or CMS-provided XML indexes where public.
  - Use already responding same-domain department pages and their discovered internal links.
  - Use official school directories, RSS/news feeds, or Wayback CDX metadata when current sitemap routes are absent.
- Next action: Create source-specific alternate sitemap/directory targets for Yale University English department-sitemap, Yale University History department-sitemap; keep missing sitemap routes logged as failed metadata routes.
- Do not do: Do not repeatedly retry absent sitemap.xml routes or infer page text from sitemap URL metadata.

## ssrn-humanities-adjacent

- Name: SSRN Humanities-Adjacent Metadata
- Class: humanities-adjacent-policy-history
- Ingest status: blocked
- Replacement status: permission-needed
- Failure count: 1
- Latest failure: 2026-06-13T16:37:21.118Z
- Latest error: https://api.ssrn.com/content/v1/papers?query=humanities: HTTP 401 Unauthorized
- Affected targets: No target metadata.
- Failed routes:
  - https://api.ssrn.com/content/v1/papers?query=humanities
- Replacement routes:
  - Use an authorized export or API route if credentials/terms permit.
  - Use OpenAlex, Crossref, NBER, or publisher metadata as alternate discovery sources.
- Next action: Keep the source blocked until an authorized metadata route or allowed export is available.
- Do not do: Do not ask for secrets in chat or retry unauthorized API routes anonymously.

## wayback-machine-cdx

- Name: Internet Archive Wayback CDX
- Class: web-archives
- Ingest status: seeded-from-experiment
- Replacement status: retry-with-smaller-route
- Failure count: 10
- Latest failure: 2026-06-14T18:29:20.316Z
- Latest error: This operation was aborted
- Affected targets: Harvard University English department-home; Yale University English department-home; University of Chicago Humanities Division division-home; Harvard University History department-home; Yale University History department-home; Princeton University History department-home
- Failed routes:
  - https://web.archive.org/cdx?url=english.fas.harvard.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=3
  - https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=3
  - https://web.archive.org/cdx?url=humanities.uchicago.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=3
  - https://web.archive.org/cdx?url=english.fas.harvard.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=10
  - https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=10
  - https://web.archive.org/cdx?url=history.fas.harvard.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=10
  - https://web.archive.org/cdx?url=history.yale.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=10
  - https://web.archive.org/cdx?url=history.princeton.edu%2F*&from=2020&to=2026&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=10
- Replacement routes:
  - Use exact URL CDX queries before wildcard queries.
  - Reduce limits and avoid collapse parameters for unstable routes.
  - Persist partial CDX responses and retry failed targets individually.
- Next action: Split wildcard CDX targets into exact canonical URLs and retry with smaller limits.
- Do not do: Do not treat archived page text as redistributable without separate rights review.

## smithsonian-open-access

- Name: Smithsonian Open Access
- Class: cultural-collections
- Ingest status: active
- Replacement status: rate-limit-backoff
- Failure count: 1
- Latest failure: 2026-06-14T19:01:47.833Z
- Latest error: HTTP 429 Too Many Requests
- Affected targets: No target metadata.
- Failed routes:
  - source-specific cultural collections API routes
- Replacement routes:
  - Retry with lower per-source limits and longer backoff.
  - Prefer bulk/download routes if the source documents one.
- Next action: Schedule a polite retry with lower page size and source-specific backoff.
- Do not do: Do not increase concurrency or rotate identities.

## hathitrust-bibliographic-metadata

- Name: HathiTrust Bibliographic Metadata
- Class: open-text-metadata
- Ingest status: blocked
- Replacement status: route-review-needed
- Failure count: 1
- Latest failure: 2026-06-13T16:37:21.021Z
- Latest error: https://catalog.hathitrust.org/Search/Home?lookfor=humanities&type=all&ft=ft&setft=true: HTTP 403 Forbidden
- Affected targets: No target metadata.
- Failed routes:
  - https://catalog.hathitrust.org/Search/Home?lookfor=humanities&type=all&ft=ft&setft=true
- Replacement routes:
  - Use documented HathiTrust bibliographic data files or metadata exports rather than blocked catalog result pages.
  - Store metadata only and keep rights fields attached before any text access decisions.
- Next action: Replace catalog-page scraping with documented metadata download/export workflow after terms review.
- Do not do: Do not scrape blocked catalog pages or store restricted full text.

## aha-annual-meeting-programs

- Name: American Historical Association Annual Meeting Programs
- Class: conference-programs
- Ingest status: blocked
- Replacement status: source-specific-review-needed
- Failure count: 1
- Latest failure: 2026-06-13T16:37:20.977Z
- Latest error: https://www.historians.org/events/annual-meeting/: HTTP 403 Forbidden
- Affected targets: No target metadata.
- Failed routes:
  - https://www.historians.org/events/annual-meeting/
- Replacement routes:
  - Review source terms, robots, documented APIs, sitemaps, and public exports.
  - Prefer metadata routes over page scraping where available.
- Next action: Write a source-specific acquisition note before retrying.
- Do not do: Do not repeatedly retry the same failed route without a changed route or terms decision.

## doaj-humanities

- Name: DOAJ Humanities Open Access Metadata
- Class: scholarly-metadata
- Ingest status: active
- Replacement status: partial-route-retry
- Failure count: 1
- Latest failure: 2026-06-13T16:25:24.203Z
- Latest error: This operation was aborted
- Affected targets: No target metadata.
- Failed routes:
  - https://doaj.org/api/search/articles/digital%20humanities?page=1&pageSize=10
- Replacement routes:
  - Retry the documented source API route with smaller page sizes and source-specific timeout/backoff.
  - Keep successful local records and treat this as a partial route failure, not a source-wide block.
- Next action: Use the source-specific ingest audit to identify which route/page failed, then retry only that route with lower limits.
- Do not do: Do not discard successful local records or reclassify the whole source as blocked because one route timed out.

## library-of-congress

- Name: Library of Congress Collections
- Class: cultural-collections
- Ingest status: active
- Replacement status: partial-route-retry
- Failure count: 1
- Latest failure: 2026-06-14T19:00:00.360Z
- Latest error: This operation was aborted
- Affected targets: No target metadata.
- Failed routes:
  - source-specific cultural collections API routes
- Replacement routes:
  - Retry the documented source API route with smaller page sizes and source-specific timeout/backoff.
  - Keep successful local records and treat this as a partial route failure, not a source-wide block.
- Next action: Use the source-specific ingest audit to identify which route/page failed, then retry only that route with lower limits.
- Do not do: Do not discard successful local records or reclassify the whole source as blocked because one route timed out.

## met-collection-api

- Name: Metropolitan Museum of Art Collection API
- Class: cultural-collections
- Ingest status: active
- Replacement status: partial-route-review
- Failure count: 1
- Latest failure: 2026-06-14T18:59:25.392Z
- Latest error: HTTP 403 Forbidden
- Affected targets: No target metadata.
- Failed routes:
  - source-specific cultural collections API routes
- Replacement routes:
  - Check whether the failed route is an individual item/detail endpoint while broader search/list endpoints still work.
  - Keep successful local records and mark missing detail routes in the source-specific ingest audit.
  - Prefer documented bulk/list APIs or lower-volume detail retries where terms allow.
- Next action: Review source-specific audit output before retrying; retry only the failed route class, not the entire source.
- Do not do: Do not bypass 403 responses or treat item-level blocks as permission to scrape alternate restricted pages.
