# TikTok Creative Creator Graph Phase Plan

Date: 2026-06-12

## Objective

Build a focused dataset of roughly 50,000 active TikTok creator accounts that are useful for learning creative craft, with priority on filmmakers, comedians, editors, writers, visual storytellers, creator-educators, and adjacent accounts that demonstrate repeatable creative technique.

The dataset is not an audience leaderboard. Follower count is secondary. The target account has something to show: visible work, process, sketches, edits, breakdowns, experiments, or recurring creative output that another creator can learn from.

## Working Definition

An account is in scope when it satisfies most of these conditions:

- Active or recently active, with evidence of posting or maintaining a meaningful creative presence.
- Has public videos or profile evidence showing creative work, craft, process, or instruction.
- Belongs to one or more target categories: filmmaker, comedian, writer, editor, visual artist, animator, performer, creative director, production educator, creator-tools educator, or adjacent creative operator.
- Produces enough signal to classify without relying only on bio keywords.
- Is useful as a node for graph expansion: follows, mentions, duets, stitches, collaborations, shared hashtags, or cross-platform identity.

An account is out of scope when it is mainly passive consumption, repost aggregation, generic influencer content, spam, brand-only marketing, adult/unsafe content, or a celebrity/audience account with little observable creative craft.

## Size Estimate

The realistic useful universe is likely much larger than 10,000 and smaller than the full long-tail creator population. A practical first target is 50,000 useful accounts.

Expected composition:

- 5,000 excellent accounts: high-signal creators with strong craft, process, or original work.
- 20,000 solid accounts: useful creators with clear creative output and enough metadata to classify.
- 25,000 exploratory accounts: active and plausibly useful, worth keeping for graph expansion, review, or category coverage.

The plan should be optimized for recall first, then quality. We should expect to inspect or score several hundred thousand candidate accounts to keep 50,000 useful ones.

## Data Sources

TikTok does not provide a broad public API for this use case. The dataset should therefore use a multi-source acquisition strategy:

- Search result providers for profile and video discovery from keyword, hashtag, and query seeds.
- Scraping vendors where legally and contractually acceptable, especially for hashtag, profile, post, comment, and related-video collection.
- Public web search indexes for profile discovery outside TikTok's app surfaces.
- Creator directories, festival lists, comedy lineups, film-school showcases, production newsletters, podcasts, Substacks, YouTube channels, Instagram bios, Linktree pages, and portfolio sites.
- TikTok-native graph signals from captions, mentions, hashtags, stitches, duets, sounds, collaborations, and recurring community terms.
- Human review decisions to train and calibrate scoring.

Do not depend on laptop app emulation as the primary path. Emulation is useful only for spot checks and debugging search behavior. The production path should use provider APIs, browser-accessible public pages, vendor exports, and structured imports that can be rerun and audited.

## Data Model

The core records should stay simple and auditable:

- `creator_accounts`: canonical account-level profile records.
- `creator_videos`: sampled video evidence with captions, timestamps, metrics where available, hashtags, sounds, and URLs.
- `creator_edges`: graph edges such as mentions, duets, stitches, collaborations, shared hashtags, source co-occurrence, and identity links.
- `creator_sources`: acquisition provenance for every account and video.
- `creator_classifications`: category, confidence, and rationale.
- `creator_scores`: usefulness score, quality tier, evidence count, and expansion priority.
- `creator_identities`: cross-platform identity resolution and duplicate grouping.
- `review_decisions`: human accepted/rejected/benchmark labels.
- `release_package`: exportable useful creators, benchmark creators, review queue, rejected creators, manifest, data card, and hash verification.

Every retained creator should be traceable back to raw source evidence and a scoring/classification explanation.

## Phase 0: Scope And Compliance

Goal: lock the target, rules, and operational boundaries before collecting at scale.

Work:

- Define exact in-scope categories and exclusion rules.
- Confirm terms, privacy, and vendor restrictions for each collection method.
- Decide which fields are allowed in the release package and which stay internal.
- Establish safety filters for minors, sensitive content, adult content, and harassment risk.
- Define retention policy for raw video/profile snapshots.

Exit criteria:

- Category rubric is written.
- Source policy is written.
- Release fields are approved.
- The first readiness gate exists and fails until minimum evidence thresholds are met.

## Phase 1: Seed Corpus

Goal: create the first high-quality creator seed set that represents the taste and category boundaries.

Work:

- Manually assemble 300 to 1,000 known-good creators across filmmakers, comedians, editors, writers, and creative educators.
- Include known negatives and borderline cases.
- Pull seed accounts from festivals, creator communities, short-film accounts, comedy venues, filmmaker TikToks, editing educators, and cross-platform creator lists.
- Add 20 to 50 discovery queries per category.
- Normalize all seeds into the raw import format.

Exit criteria:

- At least 300 accepted seeds.
- At least 100 reject or borderline examples.
- Every priority category has seed coverage.
- The pipeline can score and export the seed corpus reproducibly.

## Phase 2: Acquisition Infrastructure

Goal: make collection repeatable, provider-agnostic, and auditable.

Work:

- Maintain provider adapter configs for each source.
- Generate acquisition task batches from queries, hashtags, profile URLs, and graph expansion candidates.
- Support dry-run mode for task planning and live mode for provider execution.
- Import provider results into raw JSONL without losing provenance.
- Track source yield so future batches favor high-performing queries and providers.

Exit criteria:

- Acquisition tasks can be generated as JSONL and CSV.
- Provider result imports are idempotent.
- Source yield report ranks queries and sources by useful-account rate.
- Failed provider runs are visible in reports rather than silently ignored.

## Phase 3: Classification And Scoring

Goal: separate useful creative accounts from generic accounts at scale.

Work:

- Score accounts using bio text, captions, hashtags, video evidence, category matches, collaboration signals, and recency.
- Classify accounts into primary and secondary creative categories.
- Penalize spam, aggregator, brand-only, celebrity-only, inactive, and low-evidence accounts.
- Produce review queues ordered by uncertainty and potential value.
- Keep benchmark creators separate so scoring drift can be detected.

Exit criteria:

- Every account has a score, category, evidence list, and source trail.
- Review queue is generated.
- Benchmark set is exported.
- Readiness gate reports useful, excellent, review, source, and edge counts.

## Phase 4: Graph Expansion

Goal: find creators we did not know to search for.

Work:

- Expand from accepted creators through mentions, collaborators, duets, stitches, repeated sounds, hashtags, and co-occurring communities.
- Expand from high-yield source clusters rather than only account popularity.
- Generate second-hop and third-hop acquisition tasks with dedupe.
- Prefer expansion paths that produce creative peers, not fan or audience accounts.
- Track which expansion edge led to each candidate.

Exit criteria:

- Expansion queue is generated and ranked.
- Each expansion candidate has a reason and parent/source account.
- Graph edges are dense enough to support community discovery.
- Source yield shows which expansion paths are productive.

## Phase 5: Human Review Loop

Goal: convert taste into durable labels and improve precision without reviewing everything.

Work:

- Review the highest-value uncertain accounts first.
- Label accounts as accepted, rejected, benchmark, duplicate, or needs more evidence.
- Capture a short reason for each decision.
- Feed decisions back into scores and release eligibility.
- Audit categories with weak precision.

Exit criteria:

- At least 500 reviewed decisions before claiming production quality.
- Accepted and rejected examples exist for every major category.
- Reviewed score output differs from raw score output.
- Readiness gate includes review coverage.

## Phase 6: Identity Resolution

Goal: avoid duplicate creator records and connect accounts across platforms where useful.

Work:

- Detect duplicates by handle, normalized display name, profile URL, linked sites, Linktree, Instagram, YouTube, website, and repeated bio strings.
- Group accounts into creator identities.
- Preserve platform account records under a canonical identity.
- Put uncertain collisions into a duplicate-risk queue.

Exit criteria:

- Identity membership file exists.
- Identity evidence file exists.
- Duplicate-risk queue exists.
- Release package can export both account-level and identity-level views.

## Phase 7: Scale To 50,000

Goal: run acquisition and review loops until the useful creator target is reached.

Work:

- Generate roughly 200 acquisition/import batches at 250 retained candidates per batch, adjusting batch size based on yield.
- Prioritize batches by previous source yield, category gaps, and graph expansion value.
- Keep quotas per category so filmmakers or comedians do not crowd out smaller useful groups.
- Review enough samples per batch to estimate precision.
- Re-run scoring, identity resolution, release build, and verification after each major import wave.

Exit criteria:

- 50,000 useful creators.
- 5,000 excellent creators.
- 500 reviewed decisions minimum, with category-balanced coverage.
- Release verification passes.
- Data card documents limitations and collection provenance.

## Phase 8: Release Package

Goal: produce a usable internal dataset with clear provenance and checks.

Work:

- Export useful creators, benchmark creators, rejected creators, review queue, and all scored creators.
- Generate manifest with file hashes and counts.
- Generate data card with intended use, limitations, fields, quality gates, and refresh policy.
- Verify release files against manifest hashes.
- Build publication handoff for control-plane registration when the dataset is production-sized.

Exit criteria:

- Release package exists.
- Manifest hashes verify.
- Readiness report is green for all production gates.
- Handoff artifact is available for downstream ingestion.

## Phase 9: Refresh And Maintenance

Goal: keep the graph current without recollecting everything.

Work:

- Refresh excellent and benchmark creators weekly.
- Refresh useful creators monthly.
- Refresh exploratory and rejected-borderline accounts quarterly.
- Re-run duplicate detection after each refresh.
- Track dead accounts, renamed handles, deleted videos, category drift, and new graph edges.

Exit criteria:

- Refresh task schedule exists.
- Refresh outputs are imported through the same raw result path.
- Release versioning distinguishes initial discovery from refresh updates.
- Drift reports identify categories or sources that have degraded.

## Operational Workflow

Default local workflow:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/check-readiness.mjs
node docs/experiments/tiktok-creative-creator-graph/scripts/verify-release-package.mjs
```

Provider dry run:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --dry-run --max-tasks=5
```

Live provider run should use stored environment secrets, never pasted chat secrets:

```bash
set -a; source ~/.codex/secrets.env; set +a
node docs/experiments/tiktok-creative-creator-graph/scripts/run-acquisition-batch.mjs --provider=apify --max-tasks=25
```

Repository validation before shipping changes:

```bash
pnpm build
pnpm test
pnpm run qa:dashboard
```

Deploy after repository changes when deployment is available:

```bash
pnpm run cf:deploy
```

## Quality Gates

Production readiness should require:

- At least 50,000 useful creators.
- At least 5,000 excellent creators.
- At least 500 human review decisions.
- At least 10,000 graph edges.
- At least 50 source-yield rows.
- At least 95 percent release hash verification.
- No missing manifest files.
- No release files without provenance.
- No high-risk duplicate clusters unresolved in the release export.

## What Not To Do

- Do not build around TikTok app emulation as the primary acquisition method.
- Do not optimize for follower count.
- Do not keep accounts only because they are popular.
- Do not release raw scraped data without source, policy, and retention review.
- Do not merge provider outputs without provenance.
- Do not claim the 50,000-account goal is complete from seed or smoke data.

## Current Status

The experiment currently has the local pipeline, acquisition planning, provider dry-run support, result importer, review loop, source-yield reporting, identity resolution, release package, verification gate, scale plan, and refresh plan.

The implementation is still below production data volume. Current smoke data is suitable for validating the machinery, not for claiming dataset completion. The remaining work is production acquisition, larger human review coverage, and repeated release verification until the 50,000 useful creator target is met.
