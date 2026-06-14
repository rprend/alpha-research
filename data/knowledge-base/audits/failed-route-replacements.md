# KB Failed Route Replacement Plans

Generated at: 2026-06-14T20:29:09.696Z
Resolved historical failures: 6
Replacement plans: 10

## Resolved Historical Failures

- doaj-humanities: latest successful route https://doaj.org/api/search/articles/digital%20humanities?page=1&pageSize=20 at 2026-06-14T20:28:04.857Z (20 records).
- lareviewofbooks: latest successful route https://lareviewofbooks.org/ at 2026-06-14T20:28:09.368Z (18 records).
- library-of-congress: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:34.343Z (50 records).
- met-collection-api: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:33.316Z (50 records).
- wayback-machine-cdx: latest successful route https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=20 at 2026-06-14T20:28:09.044Z (20 records).
- wikidata-cultural-entities: latest successful route https://query.wikidata.org/sparql at 2026-06-14T20:02:20.514Z (25 records).

## harvard-humanities-departments

- Name: Harvard Humanities Department Public Pages
- Class: university-department-web
- Ingest status: seeded-from-experiment
- Replacement status: replacement-needed
- Failure count: 18
- Latest failure: 2026-06-14T20:21:59.769Z
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
- Failure count: 15
- Latest failure: 2026-06-14T20:22:16.649Z
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
- Failure count: 14
- Latest failure: 2026-06-14T20:22:00.960Z
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
- Failure count: 9
- Latest failure: 2026-06-14T20:22:06.009Z
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

## smithsonian-open-access

- Name: Smithsonian Open Access
- Class: cultural-collections
- Ingest status: active
- Replacement status: rate-limit-backoff
- Failure count: 3
- Latest failure: 2026-06-14T20:02:34.741Z
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
