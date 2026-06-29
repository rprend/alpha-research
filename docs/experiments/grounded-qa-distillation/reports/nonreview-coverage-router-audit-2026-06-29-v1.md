# Non-Review Coverage Router Audit

Generated: 2026-06-29T19:12:40.179Z

Status: `coverage_router_beats_d440_but_below_structured_group`

This zero-spend router chooses between the D442 citation-subset selector and the claim-coverage group scaffold using only prediction-side citation count.

## Result

- Contract correct: 42/64
- Selected subset: 52
- Selected group: 12
- Group rescues: 4
- Group harms: 2
- Multi-citation exact: 3/14

## Context

- D442 subset selector: 40/64
- D440 citation selector: 41/64
- Structured-group baseline: 47/64
- Two-source oracle: 44/64

## Decision

- Promote as current best scaffold: no
- Keep as candidate source: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Coverage router scores 42/64, compared with D442 40/64, D440 41/64, and structured-group baseline 47/64.
- Next step: Add router to the local candidate pool and target the remaining gap with per-question-part support planning.
