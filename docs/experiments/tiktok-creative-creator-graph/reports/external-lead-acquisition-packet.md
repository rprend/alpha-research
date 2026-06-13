# External Lead Acquisition Packet

Generated: 2026-06-13T15:58:16.388Z

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by `import-external-lead-list.mjs`. The default packet is sized to request at least the 50,000-lead discovery target before downstream quality filtering.

## Current Gap

- Target useful creators: 50000
- Current useful creators: 51404
- Useful gap: 21646
- Assignment rows: 200
- Requested leads in this packet: 50000
- Category rows: 11
- Uncovered labels: none

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
| external_packet_0001 | behind_the_scenes_creator | 250 | category_gap_search | site:tiktok.com/@ "behind the scenes creator" | https://www.tiktok.com/search/user?q=behind%20the%20scenes%20creator |
| external_packet_0002 | behind_the_scenes_creator | 250 | category_gap_search | site:tiktok.com/@ "bts" | https://www.tiktok.com/search/user?q=bts |
| external_packet_0003 | filmmaker | 250 | category_gap_search | site:tiktok.com/@ "shortfilm" | https://www.tiktok.com/search/user?q=shortfilm |
| external_packet_0004 | filmmaker | 250 | cross_platform_search | site:instagram.com "tiktok.com/@" "filmmaker" | https://www.tiktok.com/search/user?q=site%3Ainstagram.com%20tiktok.com%2F%40%20filmmaker |
| external_packet_0005 | standup_comedian | 250 | category_gap_search | site:tiktok.com/@ "stand-up" | https://www.tiktok.com/search/user?q=stand-up |
| external_packet_0006 | standup_comedian | 250 | category_gap_search | site:tiktok.com/@ "standup" | https://www.tiktok.com/search/user?q=standup |
| external_packet_0007 | director | 250 | category_gap_search | site:tiktok.com/@ "directed by" | https://www.tiktok.com/search/user?q=directed%20by |
| external_packet_0008 | filmmaker | 250 | tiktok_hashtag_export | shortfilm | https://www.tiktok.com/tag/shortfilm |
| external_packet_0009 | cinematographer | 250 | category_gap_search | site:tiktok.com/@ "dop" | https://www.tiktok.com/search/user?q=dop |
| external_packet_0010 | behind_the_scenes_creator | 250 | search_index | site:tiktok.com/@ "behind the scenes" film | https://www.tiktok.com/search/user?q=behind%20the%20scenes%20film |
| external_packet_0011 | editor | 250 | category_gap_search | site:tiktok.com/@ "editor" | https://www.tiktok.com/search/user?q=editor |
| external_packet_0012 | director | 250 | cross_platform_search | site:beacons.ai "tiktok.com/@" "director" | https://www.tiktok.com/search/user?q=site%3Abeacons.ai%20tiktok.com%2F%40%20director |
| external_packet_0013 | filmmaker | 250 | search_index | site:tiktok.com/@ filmmaker | https://www.tiktok.com/search/user?q=filmmaker |
| external_packet_0014 | standup_comedian | 250 | tiktok_hashtag_export | standupcomedy | https://www.tiktok.com/tag/standupcomedy |
| external_packet_0015 | cinematographer | 250 | search_index | site:tiktok.com/@ cinematographer | https://www.tiktok.com/search/user?q=cinematographer |
| external_packet_0016 | sketch_comedian | 250 | cross_platform_search | site:youtube.com "tiktok.com/@" "sketch comedy" | https://www.tiktok.com/search/user?q=site%3Ayoutube.com%20tiktok.com%2F%40%20sketch%20comedy |
| external_packet_0017 | editor | 250 | tiktok_hashtag_export | cinematography | https://www.tiktok.com/tag/cinematography |
| external_packet_0018 | sketch_comedian | 250 | tiktok_hashtag_export | sketchcomedy | https://www.tiktok.com/tag/sketchcomedy |
| external_packet_0019 | sketch_comedian | 250 | search_index | site:tiktok.com/@ "sketch comedy" | https://www.tiktok.com/search/user?q=sketch%20comedy |
| external_packet_0020 | film_educator | 250 | category_gap_search | site:tiktok.com/@ "tutorial" | https://www.tiktok.com/search/user?q=tutorial |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
