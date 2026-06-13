# TikTok Creative Creator Graph Source Policy

Date: 2026-06-13

## Purpose

This policy defines which sources, fields, safety filters, and retention rules are allowed for the TikTok Creative Creator Graph. The dataset is for creative discovery, review, graph expansion, and learning-value analysis. It is not an influencer marketing audience database and should not be optimized around follower count.

## Allowed Source Classes

Allowed without additional credentials:

- Public editorial pages from TikTok Newsroom or other public pages that directly name creator accounts.
- Public creator directories, festival lists, award lists, venue lineups, school/showcase pages, and editorial recommendations when their terms allow manual research or candidate discovery.
- Public web search snippets and result URLs used for candidate triage, with provider terms confirmed before production claims.
- Cross-platform public profile pages such as portfolios, YouTube descriptions, Linktree-style profile pages, newsletters, podcasts, and creator websites when used only to discover public TikTok handles.
- Human-reviewed CSV lead files assembled from public sources and imported through `import-external-lead-list.mjs`.

Allowed only after explicit provider/terms review:

- Scraping vendor exports.
- Search provider exports beyond lightweight discovery triage.
- TikTok public profile or video exports from tools that collect at scale.
- Any third-party dataset whose license is unclear, missing, or incompatible with redistribution.

Disallowed:

- TikTok app emulation as the primary production acquisition method.
- Private, login-only, paid, leaked, or access-controlled account data.
- Contact enrichment databases, email/phone scrapes, or personal-address data.
- Attempts to infer sensitive attributes.
- Raw comments, DMs, or non-public interaction data.

## Release Field Policy

Release packages may include:

- `identity_id`
- `creator_id`
- `handle`
- `display_name`
- `profile_url`
- `primary_label`
- `secondary_labels`
- `reviewed_status`
- rubric scores such as `overall_usefulness`, `creative_signal`, `category_fit`, `originality`, `graph_value`, and `repost_risk`
- public-count fields when already present in source exports, such as follower or like counts
- `last_post_at`
- sampled `video_count`
- public external profile links found in creator bios
- source type and source query
- review decision
- duplicate-risk flags
- canonical identity flag

Release packages must not include:

- email addresses, phone numbers, physical addresses, or other direct contact details
- raw video files
- raw comments
- private or login-only data
- source HTML snapshots
- inferred sensitive attributes
- internal provider credentials, request payload secrets, or account tokens

## Safety And Exclusion Filters

Accounts should be excluded or held for manual review when they appear to be:

- minors or primarily minor-focused accounts
- adult, sexualized, or escort content
- harassment, hate, doxxing, or unsafe content
- repost, fan, clipping, compilation, or aggregation accounts
- brand-only, studio-only, agency-only, or platform-owned accounts
- generic lifestyle/influencer accounts without visible creative craft
- celebrity/audience accounts without observable creative process
- spam, bot, giveaway, or engagement-farming accounts

When a row contains mixed signals, keep it in review rather than releasing it as useful.

## Retention Rules

- Keep normalized account, source, score, classification, identity, review, and release artifacts in the repository for reproducibility.
- Keep raw acquisition JSONL/CSV only when it contains normalized public candidate metadata and source provenance.
- Do not persist raw HTML pages, raw video binaries, cookies, session data, app-emulation artifacts, or provider secrets in the repository.
- Strip direct contact details from candidate text before release.
- Treat source rows with unclear terms as candidate expansion only until a source/terms review clears them for production claims.
- Refresh public account state through the same import and provenance pipeline; do not edit release exports by hand.

## Required Provenance

Every retained candidate must have enough provenance to reconstruct why it entered the graph:

- source type
- source name or provider
- source URL when available
- source query or page context
- acquisition surface
- provider execution id or batch id
- target label at intake

Rows without source provenance can be used for local debugging only and must not be promoted into release exports.

## Production Readiness

Production readiness requires this policy to exist, the release package to verify, readiness gates to pass, and the final data card to document limitations. The dataset must not be registered as production-complete until the useful, excellent, and human-review targets pass.
