-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'met-collection-api', 'cleveland-museum-open-access', 'smithsonian-open-access', 'library-of-congress', 'internet-archive-metadata', 'wikidata-cultural-entities', 'project-gutenberg', 'expanded-university-humanities-departments', 'journal-new-literary-history', 'journal-pmla', 'museum-language-drift', 'stanford-humanities-departments'

SELECT *
FROM source_documents
WHERE source_id IN ('met-collection-api', 'cleveland-museum-open-access', 'smithsonian-open-access', 'library-of-congress', 'internet-archive-metadata', 'wikidata-cultural-entities', 'project-gutenberg', 'expanded-university-humanities-departments', 'journal-new-literary-history', 'journal-pmla', 'museum-language-drift', 'stanford-humanities-departments');

-- Source-class coverage for this question route.
SELECT sd.source_id, COUNT(*) AS docs
FROM source_documents sd
WHERE sd.source_id IN ('met-collection-api', 'cleveland-museum-open-access', 'smithsonian-open-access', 'library-of-congress', 'internet-archive-metadata', 'wikidata-cultural-entities', 'project-gutenberg', 'expanded-university-humanities-departments', 'journal-new-literary-history', 'journal-pmla', 'museum-language-drift', 'stanford-humanities-departments')
GROUP BY sd.source_id
ORDER BY docs DESC;

-- Preferred source classes: 'cultural-collections'

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"museum" OR "collections" OR "describe" OR "acquisition" OR "classification" OR "public" OR "domain" OR "image"'
ORDER BY rank ASC
LIMIT 25;
