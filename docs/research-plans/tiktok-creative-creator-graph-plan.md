# TikTok Creative Creator Graph Plan

## Objective

Build a focused dataset of roughly 50,000 useful TikTok-visible creative accounts. The dataset should prioritize creators whose public work teaches something about short-form creative execution: taste, formats, visual language, comedy, editing, acting, production, storytelling, and creator-to-creator discovery.

This is not an influencer marketing database. Audience size is secondary. The core value is finding creators worth studying and using their graph to find more creators like them.

## Target Population

Include:

- Filmmakers and short-film creators
- Directors
- Cinematographers and DPs
- Editors
- VFX and animation creators
- Sketch comedians
- Standup comedians
- Improv performers
- Actors making original character or sketch work
- Video essay and film education creators
- Behind-the-scenes production creators
- Creative technologists working in video, AI video, animation, or production workflows

Exclude by default:

- Pure repost accounts
- Clip accounts
- Meme aggregators
- Fan edit accounts, unless the craft is exceptional
- Brand, studio, or agency accounts unless creator-led
- Generic lifestyle influencers
- TikTok Shop sellers with no relevant creative work
- Reaction accounts with no original point of view

## Success Criteria

The dataset is useful when it can support:

- A reviewed corpus of about 50,000 accounts with strong category and usefulness scores
- A higher-confidence subset of 5,000-15,000 excellent accounts
- A benchmark set of 500-2,000 accounts that define creative quality by category
- Graph traversal from one strong creator to adjacent creators, collaborators, formats, hashtags, sounds, and cross-platform identities
- Repeatable refreshes that discover emerging accounts without redoing the whole project

## High-Level Funnel

```text
1k-3k handpicked seed accounts
  -> 25k-75k discovered candidates
  -> 50k scored useful accounts
  -> 5k-15k excellent accounts
  -> 500-2k benchmark accounts
```

## Phase 1: Seed Set

Build an initial seed set of 1,000-3,000 clean accounts. Seed quality matters because graph expansion from bad seeds quickly fills the dataset with junk.

Primary sources:

- TikTok search for category keywords
- TikTok hashtag pages
- Google and Bing indexed TikTok profiles
- Film school, festival, and comedy club lists
- YouTube creators with TikTok links
- Instagram creators with TikTok links
- IMDb, personal sites, Linktree, Beacons, and Carrd pages
- Press articles, creator lists, and community directories

Initial keyword set:

```text
filmmaker
short film
shortfilm
director
cinematographer
dp
film student
screenwriter
movie director
sketch comedy
comedian
standup comedian
improv
character comedy
actor
video editor
vfx artist
animation
behind the scenes
bts film
commercial director
music video director
```

Seed QA:

- Manually review at least 300-500 seeds.
- Mark each reviewed seed as keep, reject, maybe, or benchmark.
- Capture why the account is useful: filmmaking signal, comedy signal, editing signal, collaboration signal, or cross-platform evidence.
- Do not expand from accounts marked reject or maybe until a later review pass.

Deliverables:

- `seed_accounts` table or CSV
- Seed source provenance
- Initial reviewed benchmark set
- Seed QA notes

## Phase 2: Public Profile And Video Enrichment

For every seed account, collect public metadata and recent public video metadata.

Account fields:

```text
handle
display_name
bio
profile_url
avatar_url
follower_count
following_count
likes_count
verified
bio_links
last_seen_at
last_post_at
status
```

Recent video fields:

```text
video_url
caption
posted_at
view_count
like_count
comment_count
share_count
hashtags
mentions
sound_id
sound_title
duet_or_stitch_reference
```

Preferred acquisition surfaces:

- TikTok public web pages
- Search engine indexed pages
- Apify-style TikTok profile, hashtag, and search scrapers
- Paid creator databases only where they accelerate discovery or verification

Avoid as a primary approach:

- Mobile app emulation
- Login-gated scraping
- Full follower/following graph extraction
- Full video downloads

Deliverables:

- Enriched profile table
- Recent video table
- Source and timestamp provenance for every field
- Failure reason for private, deleted, unavailable, or blocked accounts

## Phase 3: Graph Expansion

Use each good creator as a doorway into adjacent creators and creative communities. This is the main discovery engine.

Expansion signals:

- Repeated hashtags
- Mentioned accounts
- Collaborators
- Duets and stitches
- Comments from other likely creators
- Shared sounds within niche clusters
- External links to Instagram, YouTube, Vimeo, IMDb, websites, Linktree, Beacons, Carrd, and booking pages
- Same-handle identities across platforms
- TikTok profiles linked from Instagram and YouTube bios

Graph edge types:

```text
creator -> hashtag
creator -> mentioned_creator
creator -> collaborator
creator -> sound
creator -> external_profile
creator -> source_query
creator -> discovery_seed
creator -> similar_creator
```

Expansion rounds:

```text
Round 0: curated seeds
Round 1: hashtags, mentions, collaborators, linked accounts
Round 2: adjacent creators from high-quality Round 1 accounts
Round 3: expand only from accounts scoring above threshold
```

Expansion rules:

- Expand from accounts with strong category fit and originality.
- Do not expand from repost accounts, aggregators, generic influencers, or weak matches.
- Limit low-signal hashtags that are too broad, such as `fyp`, `viral`, `funny`, and `comedy`, unless paired with stronger signals.
- Preserve discovery provenance so every account can be traced back to sources and graph paths.

Deliverables:

- Candidate creator graph
- Edge table with evidence URLs and confidence
- Expansion run logs
- Discovery source performance report

## Phase 4: Classification

Classify accounts by evidence from profiles, recent videos, captions, hashtags, linked pages, and graph context.

Primary labels:

```text
filmmaker
director
cinematographer
editor
vfx_animation
sketch_comedian
standup_comedian
actor_performer
film_educator
behind_the_scenes_creator
creative_technologist
unclear
reject
```

Secondary labels:

```text
narrative_short_form
commercial_brand_film
music_video
documentary
horror
comedy_sketch
character_work
visual_effects
editing_breakdowns
camera_lighting_education
film_criticism
production_diary
festival_indie_film
ai_video
animation
```

Classifier inputs:

- Bio text
- Display name
- Caption text
- Hashtags
- Mentions and collaborators
- Video-level public metadata
- External links
- Cross-platform profiles
- Graph neighborhood

Deliverables:

- Classification run table
- Model version and prompt/version metadata
- Per-account labels and confidence
- Rejection reasons
- Human-review queue for ambiguous accounts

## Phase 5: Usefulness Scoring

Rank accounts by how useful they are to learn from, not by audience size.

Core score dimensions:

- `category_fit`: how clearly the account belongs in one of the target categories
- `originality`: whether the work appears original rather than reposted or aggregated
- `creative_signal`: whether the account shows craft, voice, format, timing, editing, production, performance, or storytelling
- `recency`: whether the account has posted recently, default threshold 90-180 days
- `consistency`: whether there are enough relevant posts to understand the creator
- `depth`: whether the creator has multiple examples, not just one viral post
- `graph_value`: whether the account leads to more useful creators
- `cross_platform_evidence`: whether there is supporting evidence from YouTube, Instagram, Vimeo, IMDb, personal sites, booking pages, festivals, or clubs
- `repost_risk`: likelihood the account is mostly reposted, clipped, or aggregated material

Recommended overall weighting:

```text
creative_signal: 30%
category_fit: 20%
originality: 15%
graph_value: 15%
consistency: 10%
recency: 5%
cross_platform_evidence: 5%
```

Use follower count only as a weak secondary feature. A small account with strong original work and good graph value is more important than a large generic account.

Deliverables:

- Score table
- Top accounts by category
- Top graph-expansion accounts
- Rejection and low-confidence buckets
- Review-ready shortlist

## Phase 6: Human QA

Use human review to improve judgment where automated systems are weak.

Review priorities:

- Top 2,000 accounts per category
- High graph-value accounts with uncertain labels
- High creative-signal accounts with low audience
- Accounts the classifier wants to reject despite strong external evidence
- Random samples from every discovery source
- Borderline repost/aggregator cases

Human review decisions:

```text
keep
reject
maybe
wrong_category
repost_or_aggregator
brand_or_studio
excellent_benchmark
```

Review outputs should feed back into classifier and scoring evaluation.

Deliverables:

- Review decision table
- Benchmark creator set
- Classifier evaluation set
- Source quality report
- Updated score thresholds

## Phase 7: Refresh And Monitoring

The creator graph should be refreshed continuously.

Suggested cadence:

- Benchmark and high-value accounts: weekly
- Strong useful accounts: monthly
- Long-tail accounts: quarterly
- Rejected or inactive accounts: rarely
- Discovery hashtags and source queries: weekly/monthly depending on yield

Refresh checks:

- New posts
- Account deleted/private/unavailable
- Category drift
- New collaborators
- New external links
- New high-yield hashtags
- Emerging creators connected to benchmark accounts

Deliverables:

- Refresh jobs
- Drift report
- New-account discovery report
- Inactive/dead account report
- Emerging creator shortlist

## Data Model

### `creator_accounts`

```text
id
platform
handle
display_name
bio
profile_url
avatar_url
follower_count
following_count
likes_count
verified
location_inferred
language_inferred
last_seen_at
last_post_at
status
created_at
updated_at
```

### `creator_videos`

```text
id
creator_id
url
caption
posted_at
view_count
like_count
comment_count
share_count
hashtags
mentions
sound_id
sound_title
created_at
updated_at
```

### `creator_edges`

```text
id
source_creator_id
target_type
target_id
edge_type
evidence_url
confidence
created_at
```

### `creator_sources`

```text
id
creator_id
source_type
source_name
source_query
source_url
discovered_at
discovery_run_id
```

### `creator_scores`

```text
id
creator_id
category_fit
originality
creative_signal
recency
consistency
depth
graph_value
cross_platform_evidence
repost_risk
overall_usefulness
model_version
scored_at
```

### `creator_classifications`

```text
id
creator_id
primary_label
secondary_labels
confidence
evidence
model_version
classified_at
```

### `review_decisions`

```text
id
creator_id
reviewer
decision
notes
reviewed_at
```

## Recommended First Build

Use:

- TikTok and search-index discovery
- Apify or equivalent for public profile and video enrichment
- LLM classifier and scorer
- Postgres for storage
- A simple review dashboard
- Weekly refresh jobs

Do not build initially:

- Audience demographics
- Rate estimates
- Brand safety scoring
- Outreach automation
- Mobile app emulation
- Full video downloading
- Full follower/following graph scraping

## Milestones

### Milestone 1: Seed And First Classifier

Timebox: 1 week

Tasks:

- Build 1,000-3,000 clean seeds
- Enrich profiles and recent videos
- Create first classifier and scoring rubric
- Manually QA 300-500 accounts
- Produce first benchmark set

Exit criteria:

- At least 1,000 usable seeds
- At least 300 manually reviewed examples
- Classifier produces plausible category labels
- Scoring distinguishes useful creators from generic/repost accounts

### Milestone 2: First Graph Expansion

Timebox: 1-2 weeks

Tasks:

- Run graph expansion from reviewed seeds
- Collect hashtags, mentions, collaborators, sounds, and external profiles
- Reach 25,000-75,000 candidates
- Score and classify all candidates
- Filter to 15,000-30,000 useful accounts

Exit criteria:

- Expansion rounds produce better candidates than keyword search alone
- Repost and aggregator accounts are filtered effectively
- Source performance is measurable
- Review queue is prioritized by score and uncertainty

### Milestone 3: 50k Useful Dataset

Timebox: 2-4 weeks

Tasks:

- Continue expansion only from high-quality accounts
- Add cross-platform identity matching
- Improve scoring from human QA
- Reach roughly 50,000 useful accounts
- Build category-specific top lists

Exit criteria:

- 50,000 accounts meet usefulness threshold
- 5,000-15,000 accounts are marked excellent or high-confidence
- Benchmark set covers all major categories
- Every account has source provenance and at least one evidence path

### Milestone 4: Ongoing Refresh

Timebox: ongoing

Tasks:

- Refresh high-value accounts weekly
- Refresh useful accounts monthly
- Re-run discovery on high-yield hashtags and graph neighborhoods
- Track emerging creators
- Retire inactive, deleted, or low-quality accounts

Exit criteria:

- Weekly emerging creator report
- Monthly dataset quality report
- Refresh jobs do not require manual babysitting
- Human QA steadily improves classifier and scoring quality

## Key Evaluation Question

The system is working if graph expansion produces increasingly good creators. Round 2 and Round 3 candidates should be more useful than raw keyword-search candidates. If they are not, the expansion rules, seed quality, or scoring model need to be tightened before scaling.
