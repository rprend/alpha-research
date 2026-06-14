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
WHERE source_documents_fts MATCH '"local" OR "evidence" OR "exists" OR "public" OR "humanities" OR "language" OR "departments"'
ORDER BY rank ASC
LIMIT 25;

-- Candidate person identity clusters for this question.
SELECT canonical_person_id, canonical_name, source_count, record_count, source_ids, institution_hints, confidence, notes
FROM canonical_people
WHERE (canonical_name LIKE '%local%' ESCAPE '\' OR source_author_ids LIKE '%local%' ESCAPE '\' OR institution_hints LIKE '%local%' ESCAPE '\') OR (canonical_name LIKE '%evidence%' ESCAPE '\' OR source_author_ids LIKE '%evidence%' ESCAPE '\' OR institution_hints LIKE '%evidence%' ESCAPE '\') OR (canonical_name LIKE '%exists%' ESCAPE '\' OR source_author_ids LIKE '%exists%' ESCAPE '\' OR institution_hints LIKE '%exists%' ESCAPE '\') OR (canonical_name LIKE '%public%' ESCAPE '\' OR source_author_ids LIKE '%public%' ESCAPE '\' OR institution_hints LIKE '%public%' ESCAPE '\') OR (canonical_name LIKE '%humanities%' ESCAPE '\' OR source_author_ids LIKE '%humanities%' ESCAPE '\' OR institution_hints LIKE '%humanities%' ESCAPE '\') OR (canonical_name LIKE '%language%' ESCAPE '\' OR source_author_ids LIKE '%language%' ESCAPE '\' OR institution_hints LIKE '%language%' ESCAPE '\') OR (canonical_name LIKE '%departments%' ESCAPE '\' OR source_author_ids LIKE '%departments%' ESCAPE '\' OR institution_hints LIKE '%departments%' ESCAPE '\')
ORDER BY source_count DESC, record_count DESC, canonical_name ASC
LIMIT 25;

-- Candidate cited/reference work clusters for this question.
SELECT canonical_reference_id, reference_label, reference_type, source_count, citation_count, source_ids, confidence, notes
FROM work_references
WHERE (reference_label LIKE '%local%' ESCAPE '\' OR reference_key LIKE '%local%' ESCAPE '\' OR source_work_ids LIKE '%local%' ESCAPE '\') OR (reference_label LIKE '%evidence%' ESCAPE '\' OR reference_key LIKE '%evidence%' ESCAPE '\' OR source_work_ids LIKE '%evidence%' ESCAPE '\') OR (reference_label LIKE '%exists%' ESCAPE '\' OR reference_key LIKE '%exists%' ESCAPE '\' OR source_work_ids LIKE '%exists%' ESCAPE '\') OR (reference_label LIKE '%public%' ESCAPE '\' OR reference_key LIKE '%public%' ESCAPE '\' OR source_work_ids LIKE '%public%' ESCAPE '\') OR (reference_label LIKE '%humanities%' ESCAPE '\' OR reference_key LIKE '%humanities%' ESCAPE '\' OR source_work_ids LIKE '%humanities%' ESCAPE '\') OR (reference_label LIKE '%language%' ESCAPE '\' OR reference_key LIKE '%language%' ESCAPE '\' OR source_work_ids LIKE '%language%' ESCAPE '\') OR (reference_label LIKE '%departments%' ESCAPE '\' OR reference_key LIKE '%departments%' ESCAPE '\' OR source_work_ids LIKE '%departments%' ESCAPE '\')
ORDER BY citation_count DESC, source_count DESC, reference_label ASC
LIMIT 25;
