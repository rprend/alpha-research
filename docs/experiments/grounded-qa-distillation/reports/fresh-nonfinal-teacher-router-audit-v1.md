# Fresh Nonfinal Teacher Router Audit

Generated: 2026-06-29T16:15:52.151Z

Status: `teacher_pool_has_unselected_oracle_headroom`

## Selected Policy

- Policy: `family-max_predicted_correctness__min_margin-0p16__fallback-teacher`
- Train-heldout contract: 44/80 (55.0%)
- Fresh-validation contract: 44/75 (58.7%)
- Fresh selected pattern/learned/teacher: 0/0/75

## Source Comparison

- Pattern: 25/75 (33.3%)
- Learned: 32/75 (42.7%)
- Teacher: 44/75 (58.7%)
- Three-source oracle: 59/75 (78.7%)

## Selector Supervision Packet

- Rows: 315
- Train rows: 240
- Fresh-validation reporting rows: 75
- Train rows with any correct source: 155
- Fresh-validation rows with any correct source: 59
- Teacher-wrong/cheap-right train rows: 35
- Teacher-wrong/cheap-right fresh-validation rows: 15

## Decision

- Promote teacher router as policy: no
- Keep teacher as candidate source: yes
- Buy new OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected router scored 44/75; best single source scored 44/75; three-source oracle scored 59/75.
- Next step: Mine the three-source oracle failures and teacher disagreements into a targeted supervision packet before any new paid calls.
