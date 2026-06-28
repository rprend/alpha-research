# Coverage-Constrained Listwise Selector Audit

Generated: 2026-06-28T21:15:38.367Z

Status: `coverage_constrained_selector_not_integrated`

This run makes no API calls and launches no compute.

## Selection Rule

- Validation answer-rate floor: 70.0%
- Validation answer-rate ceiling: 82.0%
- Validation answer-support floor: 70.0%
- Final labels used for selection: no

## Selected Policy

- Policy: `pen_0_abs_0_margin_0_min_1p4`
- Validation answered: 60/75
- Validation answer support: 73.3%
- Validation overall judged correct: 70.7%

## Final Reporting

| Policy | Answered | Supported answers | Answer support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| Calibrated hybrid | 49 | 35 | 71.4% | 79.7% |
| Selected constrained listwise | 51 | 33 | 64.7% | 73.9% |

## Decision

- Replace calibrated hybrid now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The constrained selector preserves calibrated-hybrid answer coverage but does not preserve answer support or overall judged correctness.
- Next step: Mine or label non-final examples where high-scoring direct answers are unsupported despite clearing surface citation and coverage features.
