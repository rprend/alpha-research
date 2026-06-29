# Non-Review Learned Citation Verifier Smoke

Generated: 2026-06-29T18:25:12.881Z

Status: `nonreview_learned_verifier_below_d440`

This zero-spend smoke trains local logistic evidence-support and answerability verifiers on D437 train rows, selects thresholds on validation rows, and evaluates fresh non-review rows.

## Calibration

- Evidence train examples: 422
- Evidence positive rate: 19.7%
- Answerability train examples: 113
- Answerability positive rate: 49.6%
- Validation contract correctness: 66.7%
- Validation citation-set exact: 66.7%
- Selected params: `{"answer_threshold":0.32,"citation_threshold":0.4,"citation_mode":"threshold_or_top1","max_citation_count":2}`

## Fresh Eval

- Eval examples: 64
- Predictions: 40 grounded, 24 abstain
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer-type accuracy: 100.0%
- Citation-set exact: 60.9%
- Overall contract correct: 60.9%

## Baselines

- D439 cheap scaffold: 57.8%
- D440 citation selector: 64.1%
- Prior structured-group non-review baseline: 73.4%
- Prior four-source non-review oracle: 89.1%
- Delta vs D440: -3.1%
- Delta vs structured-group: -12.5%
- Gap to oracle: 28.1%

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as current best scaffold: no
- Reason: The learned verifier remains below the structured-group baseline; do not spend on a student run solely from this signal.
- Next step: Move from local feature verifiers to a bounded stronger model or paid verifier-label packet with explicit cost and acceptance criteria.
