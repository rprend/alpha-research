# KB Analytical Tables

Generated at: 2026-06-14T20:22:38.334Z

| Table | Rows | CSV |
| --- | ---: | --- |
| works | 2913 | `data/knowledge-base/processed/works.csv` / `data/knowledge-base/processed/works.parquet` |
| objects | 1012 | `data/knowledge-base/processed/objects.csv` / `data/knowledge-base/processed/objects.parquet` |
| pages | 515 | `data/knowledge-base/processed/pages.csv` / `data/knowledge-base/processed/pages.parquet` |
| departments | 52 | `data/knowledge-base/processed/departments.csv` / `data/knowledge-base/processed/departments.parquet` |
| authors | 1779 | `data/knowledge-base/processed/authors.csv` / `data/knowledge-base/processed/authors.parquet` |
| canonical_people | 1713 | `data/knowledge-base/processed/canonical_people.csv` / `data/knowledge-base/processed/canonical_people.parquet` |
| institutions | 17 | `data/knowledge-base/processed/institutions.csv` / `data/knowledge-base/processed/institutions.parquet` |
| venues | 2271 | `data/knowledge-base/processed/venues.csv` / `data/knowledge-base/processed/venues.parquet` |
| collections | 40 | `data/knowledge-base/processed/collections.csv` / `data/knowledge-base/processed/collections.parquet` |
| citations | 34859 | `data/knowledge-base/processed/citations.csv` / `data/knowledge-base/processed/citations.parquet` |
| work_references | 25204 | `data/knowledge-base/processed/work_references.csv` / `data/knowledge-base/processed/work_references.parquet` |
| topics | 1062 | `data/knowledge-base/processed/topics.csv` / `data/knowledge-base/processed/topics.parquet` |
| source_documents | 6462 | `data/knowledge-base/processed/source_documents.csv` / `data/knowledge-base/processed/source_documents.parquet` |
| rights | 6462 | `data/knowledge-base/processed/rights.csv` / `data/knowledge-base/processed/rights.parquet` |

## SQLite

- Path: `data/knowledge-base/processed/knowledge-base.sqlite`
- Created: true
- FTS created: true
- FTS tables: source_documents_fts, pages_fts
- FTS rows with local text content: source_documents_fts=406, pages_fts=206

## Parquet

- Created: true
- Writer: `scripts/kb-jsonl-to-parquet.py`
- No empty analytical tables.
