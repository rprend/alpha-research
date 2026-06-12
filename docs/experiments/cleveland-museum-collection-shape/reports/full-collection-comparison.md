# Cleveland Full-Collection Comparison

Generated at: 2026-06-12T21:32:24.289Z
Status: artifact-ready
Corpus tier: full-source-corpus

## Coverage

- Prior sample records: 5000
- Full corpus records: 68742
- API total available: 68743
- Missing from API total after pagination: 1
- Raw API requests: 70
- Raw manifest: `data/raw/api/2026-06-12/manifest.json`

## Material Differences

- Department leader changed from Medieval Art (1313) in the sample to Prints (21155) in the full corpus.
- Creation-century leader changed from 10th century (911) to 20th century (24306).
- Image availability changed from 87.2% in the sample to 60.3% in the full corpus.
- Accession proxy mismatch rows increased from 229 in the sample audit to 7739 in the full-corpus audit, so acquisition-decade claims still require caution.

## Readiness Evidence

- Full-pagination raw manifest exists with 68,742 fetched records from 68,743 reported API records.
- Processed full-corpus artwork table exists.
- Sample-vs-full comparison report exists.
- Chart package rebuilt from full corpus.
- Audit packet rebuilt from full corpus.
- Post evidence audit passes against full-corpus claims.

## Next Actions

- Keep public claims scoped to the Cleveland Museum of Art API corpus.
- Use explicit acquisition dates rather than accession-number proxies for stronger acquisition-history claims.
- Compare against another open museum API before cross-institution collection-shape claims.
