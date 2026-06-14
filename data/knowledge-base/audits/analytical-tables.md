# KB Analytical Tables

Generated at: 2026-06-14T18:03:49.715Z

| Table | Rows | CSV |
| --- | ---: | --- |
| works | 1283 | `data/knowledge-base/processed/works.csv` / `data/knowledge-base/processed/works.parquet` |
| objects | 507 | `data/knowledge-base/processed/objects.csv` / `data/knowledge-base/processed/objects.parquet` |
| pages | 34 | `data/knowledge-base/processed/pages.csv` / `data/knowledge-base/processed/pages.parquet` |
| departments | 5 | `data/knowledge-base/processed/departments.csv` / `data/knowledge-base/processed/departments.parquet` |
| authors | 0 | `data/knowledge-base/processed/authors.csv` / `data/knowledge-base/processed/authors.parquet` |
| institutions | 14 | `data/knowledge-base/processed/institutions.csv` / `data/knowledge-base/processed/institutions.parquet` |
| venues | 333 | `data/knowledge-base/processed/venues.csv` / `data/knowledge-base/processed/venues.parquet` |
| collections | 25 | `data/knowledge-base/processed/collections.csv` / `data/knowledge-base/processed/collections.parquet` |
| citations | 0 | `data/knowledge-base/processed/citations.csv` / `data/knowledge-base/processed/citations.parquet` |
| topics | 541 | `data/knowledge-base/processed/topics.csv` / `data/knowledge-base/processed/topics.parquet` |
| source_documents | 1845 | `data/knowledge-base/processed/source_documents.csv` / `data/knowledge-base/processed/source_documents.parquet` |
| rights | 1845 | `data/knowledge-base/processed/rights.csv` / `data/knowledge-base/processed/rights.parquet` |

## SQLite

- Path: `data/knowledge-base/processed/knowledge-base.sqlite`
- Created: true
- FTS created: true
- FTS tables: source_documents_fts, pages_fts

## Parquet

- Created: true
- Writer: `scripts/kb-jsonl-to-parquet.py`
- Empty schema-valid tables pending dedicated ingests: authors, citations.
