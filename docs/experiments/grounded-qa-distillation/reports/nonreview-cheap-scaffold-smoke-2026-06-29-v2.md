# Non-Review Cheap Scaffold Smoke

Generated: 2026-06-29T18:07:00.431Z

Status: `nonreview_scaffold_positive_but_below_structured_group`

This zero-spend smoke trains a deterministic evidence-overlap sufficiency and citation scaffold on the D437 non-review oracle packet before any GPU launch.

## Calibration

- Train examples: 113
- Validation examples: 60
- Train contract correctness: 62.8%
- Validation contract correctness: 65.0%
- Validation answer-type accuracy: 91.7%
- Selected params: `{"threshold":0.2,"citation_mode":"score_gap","risk_penalty":0,"direct_weight":0,"numeric_bonus":0.02,"section_weight":0,"hint_weight":0.45}`

## Fresh Eval

- Eval examples: 64
- Predictions: 38 grounded answers, 26 abstentions
- Targets: 40 grounded answers, 24 abstentions
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer-type accuracy: 93.8%
- Citation-set exact: 62.5%
- Overall contract correct: 57.8%

## Baselines

- Abstention prior: 37.5%
- Prior structured-group non-review baseline: 73.4%
- Prior four-source non-review oracle: 89.1%
- Delta vs structured-group: -15.6%
- Gap to oracle: 31.3%

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as current best scaffold: no
- Reason: The zero-spend scaffold does not beat the prior structured-group non-review baseline; use it as a floor and design the next run to improve answer construction/citation selection.
- Next step: Audit fresh-eval misses to decide whether the next intervention should be a constrained citation selector, stronger local model, or Prime smoke.
