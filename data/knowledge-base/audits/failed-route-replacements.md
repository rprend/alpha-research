# KB Failed Route Replacement Plans

Generated at: 2026-06-14T21:10:38.591Z
Resolved historical failures: 14
Replacement plans: 2

## Resolved Historical Failures

- aha-annual-meeting-programs: latest successful route https://www.historians.org/wp-json/wp/v2/search?search=annual%20meeting%20program&per_page=20 | https://www.historians.org/wp-json/wp/v2/pages?search=annual%20meeting%20program&per_page=20 at 2026-06-14T20:34:13.681Z (20 records).
- columbia-humanities-departments: latest successful route https://history.columbia.edu/ at 2026-06-14T20:34:06.522Z (1 records).
- doaj-humanities: latest successful route https://doaj.org/api/search/articles/digital%20humanities?page=1&pageSize=20 at 2026-06-14T20:28:04.857Z (20 records).
- expanded-university-humanities-departments: latest successful route https://history.berkeley.edu/news | https://rhetoric.berkeley.edu/people | https://rhetoric.berkeley.edu/people/faculty/lecturers | https://www.english.upenn.edu/about | https://www.english.upenn.edu/about/academic-freedom-statement | https://www.english.upenn.edu/events/2026/06/19/juneteenth-no-classes | https://www.english.upenn.edu/news/2026/03/05/dr-deborah-burnham-leading-writing-life-program-abramson-cancer-center | http://english.duke.edu/2023-e-newsletter-chair | http://english.duke.edu/2023-e-newsletter-graduate | http://english.duke.edu/2023-e-newsletter-other | http://english.duke.edu/2023-e-newsletter-undergraduate | http://english.duke.edu/2024-e-newsletter-chair | http://english.duke.edu/2024-e-newsletter-faculty | http://english.duke.edu/2024-e-newsletter-graduate | http://english.duke.edu/2024-e-newsletter-other | http://english.duke.edu/2024-e-newsletter-undergraduate at 2026-06-14T20:42:04.005Z (16 records).
- hathitrust-bibliographic-metadata: latest successful route Internet Archive identifiers -> HathiTrust Bibliographic API brief endpoint at 2026-06-14T21:01:23.282Z (5 records).
- lareviewofbooks: latest successful route https://lareviewofbooks.org/ at 2026-06-14T20:28:09.368Z (18 records).
- library-of-congress: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:34.343Z (50 records).
- met-collection-api: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:33.316Z (50 records).
- princeton-humanities-departments: latest successful route https://english.princeton.edu/events | https://philosophy.princeton.edu/events | https://artandarchaeology.princeton.edu/events at 2026-06-14T20:42:04.005Z (3 records).
- smithsonian-open-access: latest successful route source-specific cultural collections API routes at 2026-06-14T19:00:08.030Z (200 records).
- uchicago-humanities-departments: latest successful route https://humanities.uchicago.edu/news | https://humanities.uchicago.edu/articles/2025/11/phd-student-naomi-harris-publishes-three-new-hittite-poems-paris-review | https://humanities.uchicago.edu/events | https://humanities.uchicago.edu/newsevents at 2026-06-14T21:09:40.673Z (4 records).
- wayback-machine-cdx: latest successful route https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=20 at 2026-06-14T20:28:09.044Z (20 records).
- wikidata-cultural-entities: latest successful route https://query.wikidata.org/sparql at 2026-06-14T20:02:20.514Z (25 records).
- yale-humanities-departments: latest successful route http://complit.yale.edu/about/department-history at 2026-06-14T20:42:04.005Z (1 records).

## harvard-humanities-departments

- Name: Harvard Humanities Department Public Pages
- Class: university-department-web
- Ingest status: seeded-from-experiment
- Replacement status: replacement-needed
- Failure count: 26
- Latest failure: 2026-06-14T21:09:18.725Z
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
