-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'openalex-humanities', 'crossref-humanities', 'uchicago-humanities-departments', 'yale-humanities-departments', 'cleveland-museum-open-access', 'project-gutenberg', 'harvard-humanities-departments', 'doaj-humanities', 'library-of-congress', 'met-collection-api', 'humanities-literature-radar', 'museum-language-drift'

SELECT *
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'uchicago-humanities-departments', 'yale-humanities-departments', 'cleveland-museum-open-access', 'project-gutenberg', 'harvard-humanities-departments', 'doaj-humanities', 'library-of-congress', 'met-collection-api', 'humanities-literature-radar', 'museum-language-drift');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, 3, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"language" OR "public" OR "humanities" OR "university" OR "departments" OR "centers"'
ORDER BY rank ASC
LIMIT 25;
