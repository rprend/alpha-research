-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'openalex-humanities', 'crossref-humanities', 'expanded-university-humanities-departments', 'doaj-humanities', 'stanford-humanities-departments', 'met-collection-api', 'cleveland-museum-open-access', 'project-gutenberg', 'internet-archive-metadata', 'humanities-centers-public-pages', 'journal-digital-humanities-quarterly', 'public-books'

SELECT *
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'expanded-university-humanities-departments', 'doaj-humanities', 'stanford-humanities-departments', 'met-collection-api', 'cleveland-museum-open-access', 'project-gutenberg', 'internet-archive-metadata', 'humanities-centers-public-pages', 'journal-digital-humanities-quarterly', 'public-books');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"elite" OR "university" OR "humanities" OR "departments" OR "describe" OR "public" OR "interdisciplinarity" OR "ethics"'
ORDER BY rank ASC
LIMIT 25;
