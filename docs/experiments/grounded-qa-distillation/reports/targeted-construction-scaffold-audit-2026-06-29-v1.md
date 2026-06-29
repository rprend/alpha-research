# Targeted Construction Scaffold Audit

Generated: 2026-06-29T16:32:23.127Z

Status: `targeted_construction_scaffold_train_only_signal`

## Selected Policy

- Policy: `answerThreshold-0p18__citationThreshold-0p14__maxCitations-1__topKMin-1`
- Train-heldout repairs: 2/26 (7.7%)
- Fresh-validation repairs: 0/16 (0.0%)
- Full-packet contract gate: 176/315 (55.9%)
- Fresh-validation full-packet gate: 44/75
- Teacher-only full-packet baseline: 164/315 (52.1%)
- Teacher-only fresh-validation baseline: 44/75

## Decision

- Promote scaffold as policy: no
- Keep as candidate source: no
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected policy repairs 2/26 train-heldout construction rows and 0/16 fresh-validation construction rows; full-packet gate is 176/315.
- Next step: Reject this local construction scaffold and use a small paid teacher repair packet for construction rows.
