-- DuckDB sketch for this question once KB Parquet tables exist.
-- The source registry is JSON today; later phases should expose it as source_registry.parquet.

-- Relevant source IDs: 'yale-humanities-departments', 'openalex-humanities', 'project-gutenberg', 'harvard-humanities-departments', 'doaj-humanities', 'humanities-literature-radar', 'museum-language-drift', 'cleveland-museum-open-access', 'stanford-humanities-departments', 'princeton-humanities-departments', 'humanities-centers-public-pages', 'library-of-congress'

SELECT *
FROM source_documents
WHERE source_id IN ('yale-humanities-departments', 'openalex-humanities', 'project-gutenberg', 'harvard-humanities-departments', 'doaj-humanities', 'humanities-literature-radar', 'museum-language-drift', 'cleveland-museum-open-access', 'stanford-humanities-departments', 'princeton-humanities-departments', 'humanities-centers-public-pages', 'library-of-congress');
