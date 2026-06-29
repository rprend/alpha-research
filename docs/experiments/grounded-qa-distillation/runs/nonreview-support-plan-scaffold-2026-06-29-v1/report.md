# Non-Review Support-Plan Scaffold

Generated: 2026-06-29T19:29:12.388Z

Status: `support_plan_scaffold_below_router`

This zero-spend run constructs train/validation support-plan rows and evaluates a local support planner on the fresh non-review split.

## Result

- Contract correct: 35/64
- Answer type correct: 63/64
- Citation-set exact: 36/64
- Multi-citation exact: 3/14
- Mean predicted citations on multi targets: 2.29

## Baselines

- D448 router: 42/64
- Structured-group baseline: 47/64
- Four-source oracle: 57/64

## Decision

- Promote as current best scaffold: no
- Keep as candidate source: no
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Support-plan scaffold scores 35/64; multi-citation exact is 3/14.
- Next step: Do not rent GPU from this result; inspect whether support-plan features fail on wrong singletons or multi-citation partials, then add targeted pairwise support-plan contrasts.
