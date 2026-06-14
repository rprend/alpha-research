-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities'

SELECT *
FROM source_documents
WHERE source_id IN ('expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities');

-- Source-class coverage for this question route.
SELECT sd.source_id, COUNT(*) AS docs
FROM source_documents sd
WHERE sd.source_id IN ('expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities')
GROUP BY sd.source_id
ORDER BY docs DESC;

-- Preferred source classes: 'university-department-web'

-- Date coverage by matched source.
SELECT source_id,
       COUNT(*) AS docs,
       MIN(NULLIF(CAST(publication_year AS INTEGER), 0)) AS min_publication_year,
       MAX(NULLIF(CAST(publication_year AS INTEGER), 0)) AS max_publication_year,
       SUM(CASE WHEN publication_year IS NOT NULL AND publication_year != '' THEN 1 ELSE 0 END) AS docs_with_publication_year
FROM source_documents
WHERE source_id IN ('expanded-university-humanities-departments', 'stanford-humanities-departments', 'yale-humanities-departments', 'uchicago-humanities-departments', 'columbia-humanities-departments', 'humanities-centers-public-pages', 'harvard-humanities-departments', 'princeton-humanities-departments', 'dh-conference-programs', 'doaj-humanities', 'openalex-humanities', 'crossref-humanities')
GROUP BY source_id
ORDER BY docs_with_publication_year DESC, docs DESC;

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"humanities" OR "departments" OR "visible" OR "faculty" OR "events" OR "news" OR "public" OR "language"'
ORDER BY rank ASC
LIMIT 25;
