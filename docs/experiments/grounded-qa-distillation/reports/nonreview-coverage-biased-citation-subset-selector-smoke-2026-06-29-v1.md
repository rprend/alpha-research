# Non-Review Citation Subset Selector Smoke

Generated: 2026-06-29T19:03:10.312Z

Status: `nonreview_subset_selector_below_d440`

This zero-spend smoke trains local logistic subset and answerability models on D437 train rows, selects thresholds on validation rows, and evaluates fresh non-review rows.

## Calibration

- Subset train examples: 1769
- Subset positive rate: 3.2%
- Answerability train examples: 113
- Validation contract correctness: 63.3%
- Validation citation-set exact: 65.0%
- Selected params: `{"answer_threshold":0.7,"subset_threshold":0.1,"count_penalty":0}`

## Fresh Eval

- Eval examples: 64
- Predictions: 36 grounded, 28 abstain
- Mean citations when grounded: 1.00
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer-type accuracy: 93.8%
- Citation-set exact: 68.8%
- Overall contract correct: 62.5%

## Baselines

- D440 citation selector: 64.1%
- D441 learned verifier: 60.9%
- Prior structured-group non-review baseline: 73.4%
- Prior four-source non-review oracle: 89.1%
- Delta vs D440: -1.6%
- Delta vs structured-group: -10.9%
- Gap to oracle: 26.6%

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as current best scaffold: no
- Reason: The subset selector remains below the structured-group baseline; exact citation-set composition is still unresolved.
- Next step: Use a bounded stronger model or paid verifier-label packet focused on multi-citation evidence composition before more student training.
