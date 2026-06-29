# Four-Source Router Audit

Generated: 2026-06-29T16:49:23.911Z

Status: `four_source_pool_has_unselected_oracle_headroom`

## Selected Policy

- Policy: `family-always_source__source-structured_group`
- Train-heldout contract: 49/80 (61.3%)
- Fresh-validation contract: 47/75 (62.7%)

## Source Comparison

- Pattern: 25/75 (33.3%)
- Learned: 32/75 (42.7%)
- Teacher: 44/75 (58.7%)
- Structured group: 47/75 (62.7%)
- Four-source oracle: 62/75 (82.7%)

## Decision

- Promote router as policy: no
- Keep structured group source: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected router scored 47/75; best single source scored 47/75; four-source oracle scored 62/75.
- Next step: Improve selector supervision or create targeted teacher repairs before paid GPU training.
