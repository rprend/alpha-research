# External Lead Acquisition Packet

Generated: 2026-06-13T02:10:00.506Z

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
2. For each row, search the `source_query` and `query_hints` on TikTok, search engines, YouTube, Vimeo, Linktree/Beacons, festival pages, comedy club lineups, creator portfolios, and public lists.
3. Save completed leads as `data/raw/external-leads/completed/<completed_file_name>` using the required columns.
4. Run the row's `import_command`.
5. Run `node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs`.

## First Assignments

| Assignment | Label | Leads | Surface | Query |
| --- | --- | ---: | --- | --- |
| external_packet_0001 | filmmaker | 250 | search_index | filmmaker short film editing breakdown |
| external_packet_0002 | cinematographer | 250 | search_index | cinematographer lighting breakdown |
| external_packet_0003 | sketch_comedian | 250 | search_index | sketch comedian character comedy |
| external_packet_0004 | vfx_animation | 250 | search_index | vfx artist animation blender |
| external_packet_0005 | vfx_animation | 250 | tiktok_hashtag_export | animation |
| external_packet_0006 | cinematographer | 250 | tiktok_hashtag_export | cinematography |
| external_packet_0007 | filmmaker | 250 | tiktok_hashtag_export | filmmaker |
| external_packet_0008 | filmmaker | 250 | tiktok_hashtag_export | shortfilm |
| external_packet_0009 | sketch_comedian | 250 | tiktok_hashtag_export | sketchcomedy |
| external_packet_0010 | vfx_animation | 250 | tiktok_hashtag_export | blender |
| external_packet_0011 | cinematographer | 250 | tiktok_hashtag_export | lighting |
| external_packet_0012 | vfx_animation | 250 | cross_platform_search | site:beacons.ai "tiktok.com/@" "vfx animation" |
| external_packet_0013 | filmmaker | 250 | cross_platform_search | site:vimeo.com "tiktok.com/@" "filmmaker" |
| external_packet_0014 | sketch_comedian | 250 | cross_platform_search | site:youtube.com "tiktok.com/@" "sketch comedian" |
| external_packet_0015 | vfx_animation | 250 | tiktok_hashtag_export | vfx |
| external_packet_0016 | editor | 250 | category_gap_search | site:tiktok.com/@ "editing" |
| external_packet_0017 | editor | 250 | category_gap_search | site:tiktok.com/@ "editor" |
| external_packet_0018 | editor | 250 | search_index | site:tiktok.com/@ "video editor" |
| external_packet_0019 | vfx_animation | 250 | tiktok_hashtag_export | vfxartist |
| external_packet_0020 | actor_performer | 250 | tiktok_hashtag_export | actor |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
