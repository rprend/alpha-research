-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'stanford-humanities-departments', 'openalex-humanities', 'crossref-humanities', 'project-gutenberg', 'expanded-university-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'doaj-humanities', 'journal-digital-humanities-quarterly', 'public-books', 'met-collection-api'

SELECT *
FROM source_documents
WHERE source_id IN ('stanford-humanities-departments', 'openalex-humanities', 'crossref-humanities', 'project-gutenberg', 'expanded-university-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'doaj-humanities', 'journal-digital-humanities-quarterly', 'public-books', 'met-collection-api');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"humanities" OR "departments" OR "visible" OR "faculty" OR "events" OR "news" OR "public" OR "language"'
ORDER BY rank ASC
LIMIT 25;
