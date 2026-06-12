# Cleveland Collection Publication Handoff

Generated at: 2026-06-12T21:30:52.631Z
Publish state: ready-for-copyedit
Readiness status: ready-for-editorial-review

## Final Draft

- Draft: `docs/experiments/cleveland-museum-collection-shape/reports/publication-draft.md`
- Structured findings: `docs/experiments/cleveland-museum-collection-shape/reports/result.json`
- Readiness: `docs/experiments/cleveland-museum-collection-shape/reports/readiness.json`
- Audit packet: `docs/experiments/cleveland-museum-collection-shape/reports/audit-packet.md`
- Processed records: `docs/experiments/cleveland-museum-collection-shape/data/processed/artworks.csv`

## Corpus Note

The current essay uses 68,742 sampled Cleveland Museum of Art API records from 68,743 total available records (100.0%). It covers 20 departments, 67 creation-century rows, and 12 acquisition-decade rows.

## Chart Captions

### Departments

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/departments.svg`
- Caption: Top departments in the 68,742-record Cleveland sample. Department counts show dataset shape, not cultural importance.

### Creation Centuries

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/creation-centuries.svg`
- Caption: Creation-century buckets from normalized earliest creation dates; blunt time buckets hide date uncertainty.

### Acquisition Decades

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/acquisition-decades.svg`
- Caption: Accession-number decade proxy; 7,739 mismatches against explicit accession_date in audit.

### Image Availability

- Path: `docs/experiments/cleveland-museum-collection-shape/reports/charts/image-availability.svg`
- Caption: Visual availability in sample; 41,444 has image, 27,298 no image.

## Audit Notes

- Review rows: 78
- Flagged rows: 47,636
- Accession-year proxy mismatches: 7,739
- Missing explicit accession-year rows: 348
- No-image rows: 27,298
- No-provenance-entry rows: 37,779

## Public Claim Checklist

- [ ] Say this is a bounded 68,742-record sample, not the full Cleveland collection.
- [ ] Mention 68,743 total API records were available at collection time.
- [ ] Do not generalize from Cleveland to museums as a whole.
- [ ] Treat accession decade as a proxy and disclose 7,739 accession-year mismatches.
- [ ] Caption charts as sample charts, not complete collection charts.
- [ ] Include audit caveats: 47,636 flagged rows, 27,298 no-image rows, and 37,779 rows with no provenance entries.

## Copyedit Notes

- Lead with the methodological observation: an open API changes the unit of attention from object to collection table.
- Use the Cleveland sample as a first essay, not as a proxy for museum collections generally.
- Keep acquisition-decade language tentative unless the audit rows are manually reviewed.
- Use one to three charts in the post; the chart set is deliberately larger than the likely published figure set.
