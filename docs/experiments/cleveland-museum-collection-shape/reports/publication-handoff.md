# Cleveland Collection Publication Handoff

Generated at: 2026-06-12T18:57:50.179Z
Publish state: ready-for-copyedit
Readiness status: ready-for-editorial-review

## Final Draft

- Draft: `docs/experiments/cleveland-museum-collection-shape/reports/publication-draft.md`
- Structured findings: `docs/experiments/cleveland-museum-collection-shape/reports/result.json`
- Readiness: `docs/experiments/cleveland-museum-collection-shape/reports/readiness.json`
- Audit packet: `docs/experiments/cleveland-museum-collection-shape/reports/audit-packet.md`
- Processed records: `docs/experiments/cleveland-museum-collection-shape/data/processed/artworks.csv`

## Corpus Note

The current essay uses 5,000 sampled Cleveland Museum of Art API records from 68,743 total available records (7.3%). It covers 19 departments, 56 creation-century rows, and 12 acquisition-decade rows.

## Chart Captions

### Departments

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/departments.svg`
- Caption: Top departments in the 5,000-record Cleveland sample. Department counts show dataset shape, not cultural importance.

### Creation Centuries

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/creation-centuries.svg`
- Caption: Creation-century buckets from normalized earliest creation dates; blunt time buckets hide date uncertainty.

### Acquisition Decades

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/acquisition-decades.svg`
- Caption: Accession-number decade proxy; 229 mismatches against explicit accession_date in audit.

### Image Availability

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/image-availability.svg`
- Caption: Visual availability in sample; 4,360 has image, 640 no image.

## Audit Notes

- Review rows: 54
- Flagged rows: 1,230
- Accession-year proxy mismatches: 229
- Missing explicit accession-year rows: 1
- No-image rows: 640
- No-provenance-entry rows: 582

## Public Claim Checklist

- [ ] Say this is a bounded 5,000-record sample, not the full Cleveland collection.
- [ ] Mention 68,743 total API records were available at collection time.
- [ ] Do not generalize from Cleveland to museums as a whole.
- [ ] Treat accession decade as a proxy and disclose 229 accession-year mismatches.
- [ ] Caption charts as sample charts, not complete collection charts.
- [ ] Include audit caveats: 1,230 flagged rows, 640 no-image rows, and 582 rows with no provenance entries.

## Copyedit Notes

- Lead with the methodological observation: an open API changes the unit of attention from object to collection table.
- Use the Cleveland sample as a first essay, not as a proxy for museum collections generally.
- Keep acquisition-decade language tentative unless the audit rows are manually reviewed.
- Use one to three charts in the post; the chart set is deliberately larger than the likely published figure set.
