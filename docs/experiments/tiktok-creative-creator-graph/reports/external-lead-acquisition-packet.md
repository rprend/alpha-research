# External Lead Acquisition Packet

Generated: 2026-06-13T06:07:54.707Z

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by `import-external-lead-list.mjs`. The default packet is sized to request at least the 50,000-lead discovery target before downstream quality filtering.

## Current Gap

- Target useful creators: 50000
- Current useful creators: 363
- Useful gap: 49637
- Assignment rows: 200
- Requested leads in this packet: 50000
- Category rows: 11
- Uncovered labels: editor, film_educator, behind_the_scenes_creator

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
| external_packet_0002 | actor_performer | 250 | tiktok_hashtag_export | actor | https://www.tiktok.com/tag/actor |
| external_packet_0003 | editor | 250 | search_index | FeedSpot Top Children Book TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Children%20Book%20TikTok%20Influencers%202026 |
| external_packet_0004 | editor | 250 | search_index | FeedSpot Top Comedy TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Comedy%20TikTok%20Influencers%202026 |
| external_packet_0005 | editor | 250 | search_index | FeedSpot Top Gaming TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Gaming%20TikTok%20Influencers%202026 |
| external_packet_0006 | editor | 250 | search_index | FeedSpot Top Latin Music TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Latin%20Music%20TikTok%20Influencers%202026 |
| external_packet_0007 | editor | 250 | search_index | FeedSpot Top Lego TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Lego%20TikTok%20Influencers%202026 |
| external_packet_0008 | editor | 250 | search_index | FeedSpot Top Mobile Gaming TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Mobile%20Gaming%20TikTok%20Influencers%202026 |
| external_packet_0009 | editor | 250 | search_index | FeedSpot Top Pop Music TikTok Influencers 2026 | https://www.tiktok.com/search/user?q=FeedSpot%20Top%20Pop%20Music%20TikTok%20Influencers%202026 |
| external_packet_0010 | filmmaker | 250 | search_index | screenwriter|comedian | https://www.tiktok.com/search/user?q=screenwriter%7Ccomedian |
| external_packet_0011 | filmmaker | 250 | search_index | screenwriter|film producer | https://www.tiktok.com/search/user?q=screenwriter%7Cfilm%20producer |
| external_packet_0012 | actor_performer | 250 | search_index | actor|dancer | https://www.tiktok.com/search/user?q=actor%7Cdancer |
| external_packet_0013 | standup_comedian | 250 | search_index | comedian | https://www.tiktok.com/search/user?q=comedian |
| external_packet_0014 | standup_comedian | 250 | search_index | comedian|stand-up comedian | https://www.tiktok.com/search/user?q=comedian%7Cstand-up%20comedian |
| external_packet_0015 | director | 250 | search_index | film director | https://www.tiktok.com/search/user?q=film%20director |
| external_packet_0016 | standup_comedian | 250 | search_index | screenwriter|comedian|stand-up comedian | https://www.tiktok.com/search/user?q=screenwriter%7Ccomedian%7Cstand-up%20comedian |
| external_packet_0017 | director | 250 | search_index | screenwriter|film director | https://www.tiktok.com/search/user?q=screenwriter%7Cfilm%20director |
| external_packet_0018 | director | 250 | search_index | screenwriter|film director|film producer | https://www.tiktok.com/search/user?q=screenwriter%7Cfilm%20director%7Cfilm%20producer |
| external_packet_0019 | actor_performer | 250 | search_index | voice actor | https://www.tiktok.com/search/user?q=voice%20actor |
| external_packet_0020 | cinematographer | 250 | tiktok_hashtag_export | cinematography | https://www.tiktok.com/tag/cinematography |

Full assignment CSV: `data/raw/external-leads/acquisition-packet.csv`
Category target CSV: `data/raw/external-leads/category-targets.csv`
