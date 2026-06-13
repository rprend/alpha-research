-- DuckDB sketch for this question once KB Parquet tables exist.
-- The source registry is JSON today; later phases should expose it as source_registry.parquet.

-- Relevant source IDs: 'yale-humanities-departments', 'harvard-humanities-departments', 'columbia-humanities-departments', 'princeton-humanities-departments', 'stanford-humanities-departments', 'uchicago-humanities-departments', 'humanities-centers-public-pages', 'openalex-humanities', 'project-gutenberg', 'cleveland-museum-open-access', 'dh-conference-programs', 'library-of-congress'

SELECT *
FROM source_documents
WHERE source_id IN ('yale-humanities-departments', 'harvard-humanities-departments', 'columbia-humanities-departments', 'princeton-humanities-departments', 'stanford-humanities-departments', 'uchicago-humanities-departments', 'humanities-centers-public-pages', 'openalex-humanities', 'project-gutenberg', 'cleveland-museum-open-access', 'dh-conference-programs', 'library-of-congress');
