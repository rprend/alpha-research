-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities'

SELECT *
FROM source_documents
WHERE source_id IN ('expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"humanities" OR "departments" OR "visible" OR "faculty" OR "events" OR "news" OR "public" OR "language"'
ORDER BY rank ASC
LIMIT 25;
