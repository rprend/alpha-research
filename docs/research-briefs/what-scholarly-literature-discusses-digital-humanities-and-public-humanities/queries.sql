-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'openalex-humanities', 'crossref-humanities', 'doaj-humanities', 'journal-digital-humanities-quarterly', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'wikidata-cultural-entities', 'dh-conference-programs', 'met-collection-api', 'cleveland-museum-open-access'

SELECT *
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'doaj-humanities', 'journal-digital-humanities-quarterly', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'wikidata-cultural-entities', 'dh-conference-programs', 'met-collection-api', 'cleveland-museum-open-access');

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"scholarly" OR "literature" OR "discusses" OR "digital" OR "humanities" OR "public"'
ORDER BY rank ASC
LIMIT 25;
