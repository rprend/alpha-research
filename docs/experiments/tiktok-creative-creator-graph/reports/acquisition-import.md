# Acquisition Import

Generated: 2026-06-12T22:06:48.333Z

- Input rows: 238
- Normalized rows: 238
- Skipped rows: 0
- Output accounts: 235
- Output path: `docs/experiments/tiktok-creative-creator-graph/data/raw/imports/acquisition-import-2026-06-12-88ead51127c9.jsonl`
- Import waves tracked: 7
- Mapped lineage rows: 232
- Unmapped lineage rows: 6

## Source Files

- 2026-06-12T22-06-00-391Z-editorial-list-import.jsonl: 211
- editorial-list-seeds-2026-06-12.jsonl: 21
- smoke-provider-results.jsonl: 3
- smoke-search-results.jsonl: 3

## Lineage

- Scale waves: none
- Executions: 2026-06-12T22-06-00-391Z=211
- Batches: feedspot_comedy_tiktok_2026=99, feedspot_movie_tiktok_2026=96, feedspot_horror_tiktok_2026=16, editorial_izea_filmmakers_2026_06_12=8, editorial_shutterstock_filmmakers_2026_06_12=8, editorial_shesources_women_film_2026_06_12=5
- Providers: editorial_list_public_web=211, editorial_web=21

## Wave

- Wave id: import-2026-06-12T22-06-48-334Z
- Source file count: 4
- Scale waves: none
- Executions: 2026-06-12T22-06-00-391Z
- Batches: feedspot_comedy_tiktok_2026|feedspot_movie_tiktok_2026|feedspot_horror_tiktok_2026|editorial_izea_filmmakers_2026_06_12|editorial_shutterstock_filmmakers_2026_06_12|editorial_shesources_women_film_2026_06_12
- Lineage providers: editorial_list_public_web|editorial_web
- Target labels: sketch_comedian=50, standup_comedian=49, filmmaker=100, film_educator=22, cinematographer=3, vfx_animation=2, behind_the_scenes_creator=3, editor=1, screenwriter=1, director=1, unclassified=6
- Surfaces: acquisition_export=232, provider_video_export=3, search_result_export=3
