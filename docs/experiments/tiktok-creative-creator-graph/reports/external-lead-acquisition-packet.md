# External Lead Acquisition Packet

Generated: 2026-06-13T07:48:25.827Z

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by `import-external-lead-list.mjs`. The default packet is sized to request at least the 50,000-lead discovery target before downstream quality filtering.

## Current Gap

- Target useful creators: 50000
- Current useful creators: 7595
- Useful gap: 42405
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
| external_packet_0001 | filmmaker | 250 | tiktok_hashtag_export | filmmaker | https://www.tiktok.com/tag/filmmaker |
| external_packet_0002 | filmmaker | 250 | tiktok_hashtag_export | behindthescenes | https://www.tiktok.com/tag/behindthescenes |
| external_packet_0003 | sketch_comedian | 250 | tiktok_hashtag_export | apartment | https://www.tiktok.com/tag/apartment |
| external_packet_0004 | filmmaker | 250 | tiktok_hashtag_export | chilis | https://www.tiktok.com/tag/chilis |
| external_packet_0005 | filmmaker | 250 | tiktok_hashtag_export | chilistripledipper | https://www.tiktok.com/tag/chilistripledipper |
| external_packet_0006 | sketch_comedian | 250 | tiktok_hashtag_export | doctor | https://www.tiktok.com/tag/doctor |
| external_packet_0007 | sketch_comedian | 250 | tiktok_hashtag_export | lgbt | https://www.tiktok.com/tag/lgbt |
| external_packet_0008 | filmmaker | 250 | tiktok_hashtag_export | lukadoncic | https://www.tiktok.com/tag/lukadoncic |
| external_packet_0009 | filmmaker | 250 | tiktok_hashtag_export | mavericks | https://www.tiktok.com/tag/mavericks |
| external_packet_0010 | sketch_comedian | 250 | tiktok_hashtag_export | organization | https://www.tiktok.com/tag/organization |
| external_packet_0011 | sketch_comedian | 250 | tiktok_hashtag_export | parati | https://www.tiktok.com/tag/parati |
| external_packet_0012 | filmmaker | 250 | tiktok_hashtag_export | reto | https://www.tiktok.com/tag/reto |
| external_packet_0013 | filmmaker | 250 | tiktok_hashtag_export | satisfying | https://www.tiktok.com/tag/satisfying |
| external_packet_0014 | sketch_comedian | 250 | tiktok_hashtag_export | shelterstories | https://www.tiktok.com/tag/shelterstories |
| external_packet_0015 | filmmaker | 250 | tiktok_hashtag_export | shortfilm | https://www.tiktok.com/tag/shortfilm |
| external_packet_0016 | filmmaker | 250 | cross_platform_search | site:linktr.ee "tiktok.com/@" "filmmaker" | https://www.tiktok.com/search/user?q=site%3Alinktr.ee%20tiktok.com%2F%40%20filmmaker |
| external_packet_0017 | sketch_comedian | 250 | cross_platform_search | site:linktr.ee "tiktok.com/@" "sketch comedian" | https://www.tiktok.com/search/user?q=site%3Alinktr.ee%20tiktok.com%2F%40%20sketch%20comedian |
| external_packet_0018 | filmmaker | 250 | cross_platform_search | site:youtube.com "tiktok.com/@" "filmmaker" | https://www.tiktok.com/search/user?q=site%3Ayoutube.com%20tiktok.com%2F%40%20filmmaker |
| external_packet_0019 | cinematographer | 250 | tiktok_hashtag_export | basketball | https://www.tiktok.com/tag/basketball |
| external_packet_0020 | cinematographer | 250 | tiktok_hashtag_export | capcut | https://www.tiktok.com/tag/capcut |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
