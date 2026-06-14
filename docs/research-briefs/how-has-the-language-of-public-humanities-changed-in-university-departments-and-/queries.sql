-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'openalex-humanities', 'crossref-humanities', 'uchicago-humanities-departments', 'doaj-humanities', 'stanford-humanities-departments', 'yale-humanities-departments', 'columbia-humanities-departments', 'cleveland-museum-open-access', 'internet-archive-metadata', 'project-gutenberg', 'humanities-centers-public-pages', 'library-of-congress'

SELECT *
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'uchicago-humanities-departments', 'doaj-humanities', 'stanford-humanities-departments', 'yale-humanities-departments', 'columbia-humanities-departments', 'cleveland-museum-open-access', 'internet-archive-metadata', 'project-gutenberg', 'humanities-centers-public-pages', 'library-of-congress');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"language" OR "public" OR "humanities" OR "university" OR "departments" OR "centers"'
ORDER BY rank ASC
LIMIT 25;
