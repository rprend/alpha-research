# Non-Review Citation Selector Smoke

Generated: 2026-06-29T18:17:03.986Z

Status: `nonreview_citation_selector_matches_or_beats_d439`

This zero-spend smoke trains a deterministic citation selector on D437 train rows, selects on validation rows, and evaluates on the fresh non-review split.

## Calibration

- Train examples: 113
- Validation examples: 60
- Train contract correctness: 65.5%
- Validation contract correctness: 63.3%
- Validation citation-set exact: 70.0%
- Selected params: `{"threshold":0.32,"citation_mode":"top1","overlap_weight":1,"hint_weight":0.45,"rank_weight":0.06,"section_weight":0,"numeric_weight":0.08,"risky_penalty":0,"direct_bonus":0.08}`

## Fresh Eval

- Eval examples: 64
- Predictions: 37 grounded, 27 abstain
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer-type accuracy: 92.2%
- Citation-set exact: 70.3%
- Overall contract correct: 64.1%

## Baselines

- D439 cheap scaffold: 57.8%
- Prior structured-group non-review baseline: 73.4%
- Prior four-source non-review oracle: 89.1%
- Delta vs D439: 6.3%
- Delta vs structured-group: -9.4%
- Gap to oracle: 25.0%

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as current best scaffold: no
- Reason: The selector remains below the structured-group baseline; citation selection still needs a stronger verifier or a different model class before Prime spend.
- Next step: Stop shallow lexical citation selectors and move to a stronger learned verifier or bounded model run with explicit acceptance criteria.
