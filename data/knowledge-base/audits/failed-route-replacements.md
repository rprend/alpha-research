# KB Failed Route Replacement Plans

Generated at: 2026-06-14T20:42:25.603Z
Resolved historical failures: 9
Replacement plans: 7

## Resolved Historical Failures

- aha-annual-meeting-programs: latest successful route https://www.historians.org/wp-json/wp/v2/search?search=annual%20meeting%20program&per_page=20 | https://www.historians.org/wp-json/wp/v2/pages?search=annual%20meeting%20program&per_page=20 at 2026-06-14T20:34:13.681Z (20 records).
- doaj-humanities: latest successful route https://doaj.org/api/search/articles/digital%20humanities?page=1&pageSize=20 at 2026-06-14T20:28:04.857Z (20 records).
- expanded-university-humanities-departments: latest successful route https://history.berkeley.edu/news | https://rhetoric.berkeley.edu/people | https://rhetoric.berkeley.edu/people/faculty/lecturers | https://www.english.upenn.edu/about | https://www.english.upenn.edu/about/academic-freedom-statement | https://www.english.upenn.edu/events/2026/06/19/juneteenth-no-classes | https://www.english.upenn.edu/news/2026/03/05/dr-deborah-burnham-leading-writing-life-program-abramson-cancer-center | http://english.duke.edu/2023-e-newsletter-chair | http://english.duke.edu/2023-e-newsletter-graduate | http://english.duke.edu/2023-e-newsletter-other | http://english.duke.edu/2023-e-newsletter-undergraduate | http://english.duke.edu/2024-e-newsletter-chair | http://english.duke.edu/2024-e-newsletter-faculty | http://english.duke.edu/2024-e-newsletter-graduate | http://english.duke.edu/2024-e-newsletter-other | http://english.duke.edu/2024-e-newsletter-undergraduate at 2026-06-14T20:42:04.005Z (16 records).
- library-of-congress: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:34.343Z (50 records).
- met-collection-api: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:33.316Z (50 records).
- princeton-humanities-departments: latest successful route https://english.princeton.edu/events | https://philosophy.princeton.edu/events | https://artandarchaeology.princeton.edu/events at 2026-06-14T20:42:04.005Z (3 records).
- wayback-machine-cdx: latest successful route https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=20 at 2026-06-14T20:28:09.044Z (20 records).
- wikidata-cultural-entities: latest successful route https://query.wikidata.org/sparql at 2026-06-14T20:02:20.514Z (25 records).
- yale-humanities-departments: latest successful route http://complit.yale.edu/about/department-history at 2026-06-14T20:42:04.005Z (1 records).

## harvard-humanities-departments

- Name: Harvard Humanities Department Public Pages
- Class: university-department-web
- Ingest status: seeded-from-experiment
- Replacement status: replacement-needed
- Failure count: 22
- Latest failure: 2026-06-14T20:41:35.267Z
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

## columbia-humanities-departments

- Name: Columbia Humanities Department Public Pages
- Class: university-department-web
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 11
- Latest failure: 2026-06-14T20:41:47.780Z
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
- Ingest status: active
- Replacement status: replacement-needed
- Failure count: 7
- Latest failure: 2026-06-14T20:33:43.035Z
- Latest error: https://lareviewofbooks.org/feed/: HTTP 404 Not Found
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

## ssrn-humanities-adjacent

- Name: SSRN Humanities-Adjacent Metadata
- Class: humanities-adjacent-policy-history
- Ingest status: blocked
- Replacement status: permission-needed
- Failure count: 3
- Latest failure: 2026-06-14T20:34:13.823Z
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
- Failure count: 5
- Latest failure: 2026-06-14T20:34:06.390Z
- Latest error: https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=humanities&rows=20: HTTP 429 Too Many Requests; https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=art%20history&rows=20: HTTP 429 Too Many Requests
- Affected targets: No target metadata.
- Failed routes:
  - source-specific cultural collections API routes
  - https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=humanities&rows=20 | https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=art%20history&rows=20
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
- Failure count: 3
- Latest failure: 2026-06-14T20:34:13.751Z
- Latest error: https://catalog.hathitrust.org/Search/Home?lookfor=humanities&type=all&ft=ft&setft=true: HTTP 403 Forbidden
- Affected targets: No target metadata.
- Failed routes:
  - https://catalog.hathitrust.org/Search/Home?lookfor=humanities&type=all&ft=ft&setft=true
- Replacement routes:
  - Use documented HathiTrust bibliographic data files or metadata exports rather than blocked catalog result pages.
  - Store metadata only and keep rights fields attached before any text access decisions.
- Next action: Replace catalog-page scraping with documented metadata download/export workflow after terms review.
- Do not do: Do not scrape blocked catalog pages or store restricted full text.
