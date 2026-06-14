-- SQLite queries over the local humanities KB.

-- Relevant source IDs: 'openalex-humanities', 'crossref-humanities', 'journal-digital-humanities-quarterly', 'doaj-humanities', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'dh-conference-programs', 'wikidata-cultural-entities', 'mla-convention-programs', 'library-of-congress'

SELECT *
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'journal-digital-humanities-quarterly', 'doaj-humanities', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'dh-conference-programs', 'wikidata-cultural-entities', 'mla-convention-programs', 'library-of-congress');

-- Source-class coverage for this question route.
SELECT sd.source_id, COUNT(*) AS docs
FROM source_documents sd
WHERE sd.source_id IN ('openalex-humanities', 'crossref-humanities', 'journal-digital-humanities-quarterly', 'doaj-humanities', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'dh-conference-programs', 'wikidata-cultural-entities', 'mla-convention-programs', 'library-of-congress')
GROUP BY sd.source_id
ORDER BY docs DESC;

-- Preferred source classes: 'scholarly-metadata', 'journals-and-reviews'

-- Date coverage by matched source.
SELECT source_id,
       COUNT(*) AS docs,
       MIN(NULLIF(CAST(publication_year AS INTEGER), 0)) AS min_publication_year,
       MAX(NULLIF(CAST(publication_year AS INTEGER), 0)) AS max_publication_year,
       SUM(CASE WHEN publication_year IS NOT NULL AND publication_year != '' THEN 1 ELSE 0 END) AS docs_with_publication_year
FROM source_documents
WHERE source_id IN ('openalex-humanities', 'crossref-humanities', 'journal-digital-humanities-quarterly', 'doaj-humanities', 'public-books', 'journal-critical-inquiry', 'journal-new-literary-history', 'journal-pmla', 'dh-conference-programs', 'wikidata-cultural-entities', 'mla-convention-programs', 'library-of-congress')
GROUP BY source_id
ORDER BY docs_with_publication_year DESC, docs DESC;

SELECT local_id, source_id, source_url, title, type, venue, department,
       snippet(source_documents_fts, -1, '[', ']', '...', 18) AS snippet,
       bm25(source_documents_fts) AS rank
FROM source_documents_fts
WHERE source_documents_fts MATCH '"citations" OR "authorship" OR "digital" OR "humanities" OR "journals"'
ORDER BY rank ASC
LIMIT 25;

-- Candidate person identity clusters for this question.
SELECT canonical_person_id, canonical_name, source_count, record_count, source_ids, institution_hints, confidence, notes
FROM canonical_people
WHERE (canonical_name LIKE '%citations%' ESCAPE '\' OR source_author_ids LIKE '%citations%' ESCAPE '\' OR institution_hints LIKE '%citations%' ESCAPE '\') OR (canonical_name LIKE '%authorship%' ESCAPE '\' OR source_author_ids LIKE '%authorship%' ESCAPE '\' OR institution_hints LIKE '%authorship%' ESCAPE '\') OR (canonical_name LIKE '%digital%' ESCAPE '\' OR source_author_ids LIKE '%digital%' ESCAPE '\' OR institution_hints LIKE '%digital%' ESCAPE '\') OR (canonical_name LIKE '%humanities%' ESCAPE '\' OR source_author_ids LIKE '%humanities%' ESCAPE '\' OR institution_hints LIKE '%humanities%' ESCAPE '\') OR (canonical_name LIKE '%journals%' ESCAPE '\' OR source_author_ids LIKE '%journals%' ESCAPE '\' OR institution_hints LIKE '%journals%' ESCAPE '\')
ORDER BY source_count DESC, record_count DESC, canonical_name ASC
LIMIT 25;

-- Candidate cited/reference work clusters for this question.
SELECT canonical_reference_id, reference_label, reference_type, source_count, citation_count, source_ids, confidence, notes
FROM work_references
WHERE (reference_label LIKE '%citations%' ESCAPE '\' OR reference_key LIKE '%citations%' ESCAPE '\' OR source_work_ids LIKE '%citations%' ESCAPE '\') OR (reference_label LIKE '%authorship%' ESCAPE '\' OR reference_key LIKE '%authorship%' ESCAPE '\' OR source_work_ids LIKE '%authorship%' ESCAPE '\') OR (reference_label LIKE '%digital%' ESCAPE '\' OR reference_key LIKE '%digital%' ESCAPE '\' OR source_work_ids LIKE '%digital%' ESCAPE '\') OR (reference_label LIKE '%humanities%' ESCAPE '\' OR reference_key LIKE '%humanities%' ESCAPE '\' OR source_work_ids LIKE '%humanities%' ESCAPE '\') OR (reference_label LIKE '%journals%' ESCAPE '\' OR reference_key LIKE '%journals%' ESCAPE '\' OR source_work_ids LIKE '%journals%' ESCAPE '\')
ORDER BY citation_count DESC, source_count DESC, reference_label ASC
LIMIT 25;
