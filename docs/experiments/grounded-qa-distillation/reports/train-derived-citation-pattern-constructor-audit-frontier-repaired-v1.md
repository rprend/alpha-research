# Train-Derived Citation-Pattern Constructor Audit

Generated: 2026-06-29T09:46:45.457Z

Status: `train_derived_constructor_weak_transfer_with_small_headroom`

This run makes no OpenAI calls and launches no Prime compute. Token weights are learned from train-tune rows and thresholds are selected on train-heldout rows.

## Calibration

- Train-tune contract correct: 151/160 (94.4%)
- Train-heldout contract correct: 19/63 (30.2%)
- Selected params: {"answer_threshold":2.1,"citation_fraction":0.45,"max_citations":4,"intent_weight":1.1}

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | 47 / 70 | 67.1% |
| D417 two-head selector | 47 / 70 | 67.1% |
| Train-derived constructor standalone | 40 / 70 | 57.1% |
| Augmented pool oracle | 58 / 70 | 82.9% |
| Augmented + train-derived oracle | 60 / 70 | 85.7% |
| D419 validation-informed oracle | 70 / 70 | 100.0% |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as policy: no
- Keep as candidate generator: no
- Reason: The train-derived constructor adds 2 new correct validation candidates, moving oracle headroom from 58/70 to 60/70, but train-heldout transfer is only 19/63.
- Next step: Do not launch a router or paid run from this weak transfer result; first mine more train-derived pattern features or create a fresh heldout packet to test whether the D419 family generalizes.
