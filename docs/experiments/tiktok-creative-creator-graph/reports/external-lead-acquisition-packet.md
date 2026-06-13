# External Lead Acquisition Packet

Generated: 2026-06-13T14:58:37.687Z

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by `import-external-lead-list.mjs`. The default packet is sized to request at least the 50,000-lead discovery target before downstream quality filtering.

## Current Gap

- Target useful creators: 50000
- Current useful creators: 18814
- Useful gap: 31186
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
| external_packet_0003 | filmmaker | 250 | category_gap_search | site:tiktok.com/@ "filmmaker" | https://www.tiktok.com/search/user?q=filmmaker |
| external_packet_0004 | filmmaker | 250 | tiktok_hashtag_export | filmmaker | https://www.tiktok.com/tag/filmmaker |
| external_packet_0005 | sketch_comedian | 250 | category_gap_search | site:tiktok.com/@ "comedy sketch" | https://www.tiktok.com/search/user?q=comedy%20sketch |
| external_packet_0006 | sketch_comedian | 250 | category_gap_search | site:tiktok.com/@ "sketch" | https://www.tiktok.com/search/user?q=sketch |
| external_packet_0007 | standup_comedian | 250 | category_gap_search | site:tiktok.com/@ "stand-up" | https://www.tiktok.com/search/user?q=stand-up |
| external_packet_0008 | standup_comedian | 250 | category_gap_search | site:tiktok.com/@ "standup" | https://www.tiktok.com/search/user?q=standup |
| external_packet_0009 | cinematographer | 250 | category_gap_search | site:tiktok.com/@ "dop" | https://www.tiktok.com/search/user?q=dop |
| external_packet_0010 | behind_the_scenes_creator | 250 | search_index | site:tiktok.com/@ "behind the scenes" film | https://www.tiktok.com/search/user?q=behind%20the%20scenes%20film |
| external_packet_0011 | filmmaker | 250 | tiktok_hashtag_export | shortfilm | https://www.tiktok.com/tag/shortfilm |
| external_packet_0012 | director | 250 | category_gap_search | site:tiktok.com/@ "directed by" | https://www.tiktok.com/search/user?q=directed%20by |
| external_packet_0013 | vfx_animation | 250 | category_gap_search | site:tiktok.com/@ "animation" | https://www.tiktok.com/search/user?q=animation |
| external_packet_0014 | vfx_animation | 250 | category_gap_search | site:tiktok.com/@ "vfx" | https://www.tiktok.com/search/user?q=vfx |
| external_packet_0015 | editor | 250 | category_gap_search | site:tiktok.com/@ "editing" | https://www.tiktok.com/search/user?q=editing |
| external_packet_0016 | standup_comedian | 250 | cross_platform_search | site:linktr.ee "tiktok.com/@" "comedian" | https://www.tiktok.com/search/user?q=site%3Alinktr.ee%20tiktok.com%2F%40%20comedian |
| external_packet_0017 | filmmaker | 250 | search_index | site:tiktok.com/@ filmmaker | https://www.tiktok.com/search/user?q=filmmaker |
| external_packet_0018 | sketch_comedian | 250 | tiktok_hashtag_export | sketchcomedy | https://www.tiktok.com/tag/sketchcomedy |
| external_packet_0019 | sketch_comedian | 250 | search_index | site:tiktok.com/@ "sketch comedy" | https://www.tiktok.com/search/user?q=sketch%20comedy |
| external_packet_0020 | vfx_animation | 250 | tiktok_hashtag_export | vfxartist | https://www.tiktok.com/tag/vfxartist |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
