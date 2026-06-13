# KB Analytical Tables

Generated at: 2026-06-13T16:45:34.843Z

| Table | Rows | CSV |
| --- | ---: | --- |
| works | 1283 | `data/knowledge-base/processed/works.csv` |
| objects | 507 | `data/knowledge-base/processed/objects.csv` |
| pages | 34 | `data/knowledge-base/processed/pages.csv` |
| departments | 5 | `data/knowledge-base/processed/departments.csv` |
| source_documents | 1845 | `data/knowledge-base/processed/source_documents.csv` |
| rights | 1845 | `data/knowledge-base/processed/rights.csv` |

## SQLite

- Path: `data/knowledge-base/processed/knowledge-base.sqlite`
- Created: true
- FTS created: true
- FTS tables: source_documents_fts, pages_fts

Note: Parquet output still requires a Parquet writer dependency such as pyarrow or DuckDB. CSV plus SQLite are the current local analytical layer.
