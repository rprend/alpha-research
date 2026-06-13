# KB Analytical Tables

Generated at: 2026-06-13T16:25:38.537Z

| Table | Rows | CSV |
| --- | ---: | --- |
| works | 699 | `data/knowledge-base/processed/works.csv` |
| objects | 54 | `data/knowledge-base/processed/objects.csv` |
| pages | 33 | `data/knowledge-base/processed/pages.csv` |
| departments | 4 | `data/knowledge-base/processed/departments.csv` |
| source_documents | 816 | `data/knowledge-base/processed/source_documents.csv` |
| rights | 816 | `data/knowledge-base/processed/rights.csv` |

## SQLite

- Path: `data/knowledge-base/processed/knowledge-base.sqlite`
- Created: true
- FTS created: true

Note: Parquet output still requires a Parquet writer dependency such as pyarrow or DuckDB. CSV plus SQLite are the current local analytical layer.
