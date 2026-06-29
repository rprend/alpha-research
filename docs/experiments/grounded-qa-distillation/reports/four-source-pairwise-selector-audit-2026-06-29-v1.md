# Four-Source Pairwise Selector Audit

Generated: 2026-06-29T16:59:44.655Z

Status: `pairwise_selector_does_not_extract_oracle_headroom`

## Selected Policy

- Policy: `family-always_source__source-structured_group`
- Train-heldout contract: 49/80 (61.3%)
- Fresh-validation contract: 47/75 (62.7%)

## Source Comparison

- Structured group: 47/75 (62.7%)
- Teacher: 44/75 (58.7%)
- Four-source oracle: 62/75 (82.7%)

## Decision

- Promote pairwise selector: no
- Keep pairwise features: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected pairwise policy scored 47/75; best single source scored 47/75; oracle scored 62/75.
- Next step: Stop zero-cost selector variants and use a small targeted paid repair/adjudication packet for selector misses and no-source-correct rows.
