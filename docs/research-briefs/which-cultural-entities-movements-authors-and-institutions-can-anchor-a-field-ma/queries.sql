-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'crossref-humanities', 'openalex-humanities', 'doaj-humanities', 'wikidata-cultural-entities', 'journal-new-literary-history', 'journal-pmla', 'journal-digital-humanities-quarterly', 'public-books', 'journal-critical-inquiry', 'project-gutenberg', 'internet-archive-metadata', 'dh-conference-programs'

SELECT *
FROM source_documents
WHERE source_id IN ('crossref-humanities', 'openalex-humanities', 'doaj-humanities', 'wikidata-cultural-entities', 'journal-new-literary-history', 'journal-pmla', 'journal-digital-humanities-quarterly', 'public-books', 'journal-critical-inquiry', 'project-gutenberg', 'internet-archive-metadata', 'dh-conference-programs');

-- Source-class coverage for this question route.
SELECT sd.source_id, COUNT(*) AS docs
FROM source_documents sd
WHERE sd.source_id IN ('crossref-humanities', 'openalex-humanities', 'doaj-humanities', 'wikidata-cultural-entities', 'journal-new-literary-history', 'journal-pmla', 'journal-digital-humanities-quarterly', 'public-books', 'journal-critical-inquiry', 'project-gutenberg', 'internet-archive-metadata', 'dh-conference-programs')
GROUP BY sd.source_id
ORDER BY docs DESC;

-- Preferred source classes: 'linked-open-data', 'scholarly-metadata', 'journals-and-reviews'

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"cultural" OR "entities" OR "movements" OR "authors" OR "institutions" OR "can" OR "anchor" OR "field"'
ORDER BY rank ASC
LIMIT 25;
