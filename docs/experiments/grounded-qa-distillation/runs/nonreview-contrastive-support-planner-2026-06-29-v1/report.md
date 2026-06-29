# Non-Review Contrastive Support Planner

Generated: 2026-06-29T19:36:27.623Z

Status: `contrastive_support_planner_below_router`

This zero-spend run trains a pairwise required-vs-distractor evidence ranker from support-plan labels, calibrates on D437 SFT validation, and evaluates only on fresh non-review examples.

## Result

- Contract correct: 32/64
- Answer type correct: 61/64
- Citation-set exact: 35/64
- Multi-citation exact: 2/14
- Rescued router misses: 4
- Regressed router-correct rows: 14

## Baselines

- D448 router: 42/64
- D450 independent support-plan scaffold: 35/64
- Structured-group baseline: 47/64
- Four-source oracle: 57/64

## Decision

- Promote as current best scaffold: no
- Keep as candidate source: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Contrastive support planner scores 32/64; it rescues 4 router misses and regresses 14 router-correct rows.
- Next step: Keep only as an analysis candidate; if rescues are nonzero, mine the rescued rows into a guarded router feature, otherwise stop local support-planner variants and consider a capped adjudicated label packet.
