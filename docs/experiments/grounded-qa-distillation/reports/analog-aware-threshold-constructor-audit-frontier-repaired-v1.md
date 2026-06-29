# Analog-Aware Threshold Constructor Audit

Generated: 2026-06-29T15:40:48.973Z

Status: `analog_threshold_no_validation_headroom_gain`

This run makes no OpenAI calls and launches no Prime compute.

## Calibration

- Train-heldout contract correct: 28/63 (44.4%)
- Train-heldout over-answered abstentions: 1
- Train-heldout citation errors: 0
- Selected params: {"answer_threshold":2.7,"citation_fraction":0.45,"max_citations":2,"analog_min":0.42,"analog_discount":0}

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | 47 / 70 | 67.1% |
| D420 constructor standalone | 40 / 70 | 57.1% |
| Analog-aware constructor standalone | 38 / 70 | 54.3% |
| D420 combined oracle | 60 / 70 | 85.7% |
| Analog-aware combined oracle | 58 / 70 | 82.9% |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as policy: no
- Keep as candidate generator: no
- Reason: Analog-aware thresholding does not improve both train-heldout (28 vs 19) and new validation headroom (0 vs 2).
- Next step: Reject this analog-threshold repair and create a fresh heldout packet or stronger constructor features before any paid run.
