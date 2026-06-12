# Cleveland Collection Shape Post Evidence Audit

Generated at: 2026-06-12T20:33:47.326Z
Status: pass
Checks passed: 15/15

| Check | Status | Evidence |
| --- | --- | --- |
| sample-records | pass | 5000 sampled records |
| total-available | pass | 68743 total API records |
| sample-share | pass | 7.3% sample share |
| top-department | pass | Medieval Art: 1313 |
| top-creation-century | pass | 10th century: 911 |
| top-acquisition-decade | pass | 1940s: 1275 |
| image-availability | pass | has image=4360; no image=640 |
| audit-flagged-rows | pass | 1230 flagged rows |
| audit-accession-mismatches | pass | 229 accession-year mismatches |
| audit-no-image | pass | 640 rows without image |
| audit-no-provenance | pass | 582 rows without provenance entries |
| chart-departments.svg | pass | /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/cleveland-museum-collection-shape/reports/charts/departments.svg; 3434 bytes |
| chart-creation-centuries.svg | pass | /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/cleveland-museum-collection-shape/reports/charts/creation-centuries.svg; 12718 bytes |
| chart-acquisition-decades.svg | pass | /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/cleveland-museum-collection-shape/reports/charts/acquisition-decades.svg; 3240 bytes |
| chart-image-availability.svg | pass | /Users/ryanprendergast/Documents/Zenobia Pay/alpha-research/docs/experiments/cleveland-museum-collection-shape/reports/charts/image-availability.svg; 1143 bytes |

## Next Moves

- Keep the post framed as a bounded 5,000-record Cleveland sample.
- Do not strengthen acquisition-decade language without manual review of mismatch rows.
- Fetch the full Cleveland API corpus before treating the charts as full-collection charts.
