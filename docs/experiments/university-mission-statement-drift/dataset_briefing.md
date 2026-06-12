# University Mission Statement Drift Dataset Briefing

## What This Dataset Contains

This dataset supports the first `What Changed?` essay track for the Cultural Observatory research program. It collects current public university about/mission pages and a first layer of Internet Archive Wayback snapshots, then extracts term-family counts and representative snippets.

The article thesis under test:

> University self-description may have shifted from truth, civic, and liberal-education language toward innovation, impact, global leadership, inclusion, and economic language.

## Current Files

- `config/institutions.json`: current public page source list
- `config/wayback-targets.json`: Wayback snapshot target list
- `config/term-families.json`: editorial term families
- `data/raw/current-pages/2026-06-12/`: current HTML snapshots and manifest
- `data/raw/wayback-snapshots/2026-06-12/`: archived HTML snapshots and manifest
- `data/processed/pages.json`: processed current and historical page records
- `data/processed/page-term-counts.csv`: term counts by page, source layer, year, and family
- `data/processed/term-counts.csv`: current-page term counts
- `data/processed/term-family-by-year.csv`: longitudinal aggregate table
- `reports/report.html`: article artifact
- `reports/result.json`: structured result payload
- `reports/work.md`: work log
- `reports/public-draft.md`: public-facing draft scaffold

## Term Families

- `truth_knowledge`
- `civic_public`
- `innovation_impact`
- `global_leadership`
- `excellence_prestige`
- `inclusion_belonging`
- `career_economy`

## Known Limitations

- The historical layer currently uses exact current URLs in Wayback, so older captures are sparse.
- Archived HTML may include template/navigation text and needs hand audit.
- Term counts are directional evidence, not finished interpretation.
- Institution pages differ by genre: about pages, mission pages, center pages, and strategic pages should be separated in larger runs.
- Columbia and Michigan central pages blocked direct automated collection in earlier attempts; future collection should use alternate official pages or manual archive targets.

## Starter Questions

- Which term families dominate current university self-description?
- Which term families appear in archived snapshots but change by 2026?
- Which institutions need better historical source targets?
- What snippets should be manually reviewed before publishing?
- Which additional source layers should be added first: catalogs, strategic plans, speeches, or archived mission pages?
