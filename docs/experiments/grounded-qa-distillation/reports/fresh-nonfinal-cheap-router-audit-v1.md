# Fresh Nonfinal Cheap Router Audit

Generated: 2026-06-29T16:07:22.115Z

Status: `cheap_pool_has_unselected_oracle_headroom`

## Selected Policy

- Policy: `family-always_learned__source-learned`
- Train-heldout contract: 28/80 (35.0%)
- Fresh-validation contract: 32/75 (42.7%)
- Fresh selected pattern/learned: 0/75

## Source Comparison

- Pattern: 25/75 (33.3%)
- Learned: 32/75 (42.7%)
- Cheap-source oracle: 42/75 (56.0%)
- Learned-only correct: 17
- Pattern-only correct: 10

## Decision

- Keep cheap router as policy: no
- Keep as diagnostic: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected router scored 32/75; best single cheap source scored 32/75; cheap-source oracle scored 42/75.
- Next step: Do not use the cheap router as policy. Use this disagreement audit to design a small teacher-label or selector-supervision packet; current train-heldout selection cannot extract the cheap-source oracle headroom.
