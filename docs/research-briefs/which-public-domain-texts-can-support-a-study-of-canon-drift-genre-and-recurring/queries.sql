-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'project-gutenberg', 'internet-archive-metadata', 'openalex-humanities', 'expanded-university-humanities-departments', 'doaj-humanities', 'wikidata-cultural-entities', 'crossref-humanities', 'met-collection-api', 'stanford-humanities-departments', 'cleveland-museum-open-access', 'journal-new-literary-history', 'museum-language-drift'

SELECT *
FROM source_documents
WHERE source_id IN ('project-gutenberg', 'internet-archive-metadata', 'openalex-humanities', 'expanded-university-humanities-departments', 'doaj-humanities', 'wikidata-cultural-entities', 'crossref-humanities', 'met-collection-api', 'stanford-humanities-departments', 'cleveland-museum-open-access', 'journal-new-literary-history', 'museum-language-drift');

-- Source-class coverage for this question route.
SELECT sd.source_id, COUNT(*) AS docs
FROM source_documents sd
WHERE sd.source_id IN ('project-gutenberg', 'internet-archive-metadata', 'openalex-humanities', 'expanded-university-humanities-departments', 'doaj-humanities', 'wikidata-cultural-entities', 'crossref-humanities', 'met-collection-api', 'stanford-humanities-departments', 'cleveland-museum-open-access', 'journal-new-literary-history', 'museum-language-drift')
GROUP BY sd.source_id
ORDER BY docs DESC;

-- Preferred source classes: 'public-domain-texts', 'open-text-metadata'

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"public" OR "domain" OR "texts" OR "can" OR "support" OR "study" OR "canon" OR "drift"'
ORDER BY rank ASC
LIMIT 25;
