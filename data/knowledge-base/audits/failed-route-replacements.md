# KB Failed Route Replacement Plans

Generated at: 2026-06-14T22:07:15.327Z
Resolved historical failures: 15
Replacement plans: 1

## Resolved Historical Failures

- aha-annual-meeting-programs: latest successful route https://www.historians.org/wp-json/wp/v2/search?search=annual%20meeting%20program&per_page=25 | https://www.historians.org/wp-json/wp/v2/pages?search=annual%20meeting%20program&per_page=25 at 2026-06-14T21:24:40.163Z (25 records).
- columbia-humanities-departments: latest successful route https://history.columbia.edu/ at 2026-06-14T21:24:34.262Z (1 records).
- doaj-humanities: latest successful route https://doaj.org/api/search/articles/digital%20humanities?page=1&pageSize=20 at 2026-06-14T20:28:04.857Z (20 records).
- expanded-university-humanities-departments: latest successful route https://history.berkeley.edu/news | https://rhetoric.berkeley.edu/people | https://rhetoric.berkeley.edu/people/faculty/lecturers | https://www.english.upenn.edu/about | https://www.english.upenn.edu/about/academic-freedom-statement | https://www.english.upenn.edu/events/2026/06/19/juneteenth-no-classes | https://www.english.upenn.edu/news/2026/03/05/dr-deborah-burnham-leading-writing-life-program-abramson-cancer-center | http://english.duke.edu/2023-e-newsletter-chair | http://english.duke.edu/2023-e-newsletter-graduate | http://english.duke.edu/2023-e-newsletter-other | http://english.duke.edu/2023-e-newsletter-undergraduate | http://english.duke.edu/2024-e-newsletter-chair | http://english.duke.edu/2024-e-newsletter-faculty | http://english.duke.edu/2024-e-newsletter-graduate | http://english.duke.edu/2024-e-newsletter-other | http://english.duke.edu/2024-e-newsletter-undergraduate at 2026-06-14T20:42:04.005Z (16 records).
- harvard-humanities-departments: latest successful route https://www.harvard.edu/programs/english/ | https://www.harvard.edu/programs/history/ | https://www.harvard.edu/programs/philosophy/ | https://www.harvard.edu/programs/classics/ at 2026-06-14T21:18:42.225Z (4 records).
- hathitrust-bibliographic-metadata: latest successful route Internet Archive identifiers -> HathiTrust Bibliographic API brief endpoint at 2026-06-14T21:01:23.282Z (5 records).
- lareviewofbooks: latest successful route https://lareviewofbooks.org/ at 2026-06-14T20:28:09.368Z (18 records).
- library-of-congress: latest successful route source-specific cultural collections API routes at 2026-06-14T20:02:34.343Z (50 records).
- princeton-humanities-departments: latest successful route https://english.princeton.edu/events | https://philosophy.princeton.edu/events | https://artandarchaeology.princeton.edu/events at 2026-06-14T20:42:04.005Z (3 records).
- smithsonian-open-access: latest successful route source-specific cultural collections API routes at 2026-06-14T19:00:08.030Z (200 records).
- ssrn-humanities-adjacent: latest successful route https://api.crossref.org/works?filter=type:posted-content&query=SSRN%20humanities&rows=25 | https://api.crossref.org/works?filter=type:posted-content&query=SSRN%20digital%20humanities%20culture%20history&rows=25 at 2026-06-14T21:24:40.914Z (25 records).
- uchicago-humanities-departments: latest successful route https://humanities.uchicago.edu/news | https://humanities.uchicago.edu/articles/2025/11/phd-student-naomi-harris-publishes-three-new-hittite-poems-paris-review | https://humanities.uchicago.edu/events | https://humanities.uchicago.edu/newsevents at 2026-06-14T21:09:40.673Z (4 records).
- wayback-machine-cdx: latest successful route https://web.archive.org/cdx?url=english.yale.edu%2F*&from=2020&to=2026&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=20 at 2026-06-14T20:28:09.044Z (20 records).
- wikidata-cultural-entities: latest successful route https://query.wikidata.org/sparql at 2026-06-14T20:02:20.514Z (25 records).
- yale-humanities-departments: latest successful route http://complit.yale.edu/about/department-history at 2026-06-14T20:42:04.005Z (1 records).

## met-collection-api

- Name: Metropolitan Museum of Art Collection API
- Class: cultural-collections
- Ingest status: active
- Replacement status: partial-route-review
- Failure count: 5
- Latest failure: 2026-06-14T22:07:00.214Z
- Latest error: No error text.
- Affected targets: No target metadata.
- Failed routes:
  - source-specific cultural collections API routes
  - https://collectionapi.metmuseum.org/public/collection/v1/objects/655853
  - https://collectionapi.metmuseum.org/public/collection/v1/objects/291426
  - https://collectionapi.metmuseum.org/public/collection/v1/objects/291419
  - https://collectionapi.metmuseum.org/public/collection/v1/objects/120990
- Replacement routes:
  - Check whether the failed route is an individual item/detail endpoint while broader search/list endpoints still work.
  - Keep successful local records and mark missing detail routes in the source-specific ingest audit.
  - Prefer documented bulk/list APIs or lower-volume detail retries where terms allow.
- Next action: Review source-specific audit output before retrying; retry only the failed route class, not the entire source.
- Do not do: Do not bypass 403 responses or treat item-level blocks as permission to scrape alternate restricted pages.
