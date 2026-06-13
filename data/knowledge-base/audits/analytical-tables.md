# KB Analytical Tables

Generated at: 2026-06-13T16:41:52.437Z

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

Note: Parquet output still requires a Parquet writer dependency such as pyarrow or DuckDB. CSV plus SQLite are the current local analytical layer.
