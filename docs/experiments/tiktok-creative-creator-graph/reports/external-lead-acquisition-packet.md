# External Lead Acquisition Packet

Generated: 2026-06-13T02:28:37.845Z

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by `import-external-lead-list.mjs`.

## Current Gap

- Target useful creators: 50000
- Current useful creators: 7
- Useful gap: 49993
- Assignment rows: 120
- Requested leads in this packet: 30000
- Category rows: 11
- Uncovered labels: director, editor, standup_comedian, actor_performer, film_educator, behind_the_scenes_creator

## Required Completed Lead Columns

`handle`, `profile_url`, `display_name`, `bio`, `target_label`, `source_name`, `source_url`, `source_query`, `follower_count`, `likes_count`, `video_count`, `verified`

## Acceptance Rubric

Accept public TikTok profiles with original creative work and visible craft, process, or finished creative output. Reject repost/clip/fan pages, generic lifestyle influencers, brand-only accounts, spam, and profiles where the creator has nothing useful to learn from.

## Operator Workflow

1. Work rows from `data/raw/external-leads/acquisition-packet.csv`.
2. For each row, start with `primary_source_url` and `source_urls`, then expand with `source_query` and `query_hints` on TikTok, search engines, YouTube, Vimeo, Linktree/Beacons, festival pages, comedy club lineups, creator portfolios, and public lists.
3. Save completed leads as `data/raw/external-leads/completed/<completed_file_name>` using the required columns.
4. Run the row's `import_command`.
5. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs`.

## First Assignments

| Assignment | Label | Leads | Surface | Query | Start URL |
| --- | --- | ---: | --- | --- | --- |
| external_packet_0001 | filmmaker | 250 | search_index | filmmaker short film editing breakdown | https://www.tiktok.com/search/user?q=filmmaker%20short%20film%20editing%20breakdown |
| external_packet_0002 | cinematographer | 250 | search_index | cinematographer lighting breakdown | https://www.tiktok.com/search/user?q=cinematographer%20lighting%20breakdown |
| external_packet_0003 | sketch_comedian | 250 | search_index | sketch comedian character comedy | https://www.tiktok.com/search/user?q=sketch%20comedian%20character%20comedy |
| external_packet_0004 | vfx_animation | 250 | search_index | vfx artist animation blender | https://www.tiktok.com/search/user?q=vfx%20artist%20animation%20blender |
| external_packet_0005 | vfx_animation | 250 | tiktok_hashtag_export | animation | https://www.tiktok.com/tag/animation |
| external_packet_0006 | cinematographer | 250 | tiktok_hashtag_export | cinematography | https://www.tiktok.com/tag/cinematography |
| external_packet_0007 | filmmaker | 250 | tiktok_hashtag_export | filmmaker | https://www.tiktok.com/tag/filmmaker |
| external_packet_0008 | filmmaker | 250 | tiktok_hashtag_export | shortfilm | https://www.tiktok.com/tag/shortfilm |
| external_packet_0009 | sketch_comedian | 250 | tiktok_hashtag_export | sketchcomedy | https://www.tiktok.com/tag/sketchcomedy |
| external_packet_0010 | vfx_animation | 250 | tiktok_hashtag_export | blender | https://www.tiktok.com/tag/blender |
| external_packet_0011 | cinematographer | 250 | tiktok_hashtag_export | lighting | https://www.tiktok.com/tag/lighting |
| external_packet_0012 | vfx_animation | 250 | cross_platform_search | site:beacons.ai "tiktok.com/@" "vfx animation" | https://www.tiktok.com/search/user?q=site%3Abeacons.ai%20tiktok.com%2F%40%20vfx%20animation |
| external_packet_0013 | filmmaker | 250 | cross_platform_search | site:vimeo.com "tiktok.com/@" "filmmaker" | https://www.tiktok.com/search/user?q=site%3Avimeo.com%20tiktok.com%2F%40%20filmmaker |
| external_packet_0014 | sketch_comedian | 250 | cross_platform_search | site:youtube.com "tiktok.com/@" "sketch comedian" | https://www.tiktok.com/search/user?q=site%3Ayoutube.com%20tiktok.com%2F%40%20sketch%20comedian |
| external_packet_0015 | vfx_animation | 250 | tiktok_hashtag_export | vfx | https://www.tiktok.com/tag/vfx |
| external_packet_0016 | editor | 250 | category_gap_search | site:tiktok.com/@ "editing" | https://www.tiktok.com/search/user?q=editing |
| external_packet_0017 | editor | 250 | category_gap_search | site:tiktok.com/@ "editor" | https://www.tiktok.com/search/user?q=editor |
| external_packet_0018 | editor | 250 | search_index | site:tiktok.com/@ "video editor" | https://www.tiktok.com/search/user?q=video%20editor |
| external_packet_0019 | vfx_animation | 250 | tiktok_hashtag_export | vfxartist | https://www.tiktok.com/tag/vfxartist |
| external_packet_0020 | actor_performer | 250 | tiktok_hashtag_export | actor | https://www.tiktok.com/tag/actor |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
