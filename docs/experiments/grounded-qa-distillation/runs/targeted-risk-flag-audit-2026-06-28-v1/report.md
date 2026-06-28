# Targeted Risk Flag Audit

This audit treats the targeted hard-negative signal as a reporting-only risk flag over the mixed final selector.

| Threshold | Flagged | Miss flags | False positives | Miss recall | False-positive rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 36 | 4/5 | 32/44 | 80.0% | 72.7% |
| 0.1 | 23 | 1/5 | 22/44 | 20.0% | 50.0% |
| 0.25 | 6 | 0/5 | 6/44 | 0.0% | 13.6% |
| 0.5 | 0 | 0/5 | 0/44 | 0.0% | 0.0% |
| 1 | 0 | 0/5 | 0/44 | 0.0% | 0.0% |
| 2 | 0 | 0/5 | 0/44 | 0.0% | 0.0% |

## Decision

The best reporting threshold flags 0/5 baseline misses with 0/44 false positives; final labels were reporting-only, so it is not deployable.

Next step: Do not use the targeted signal as a deployable flag; stronger semantic support labels are needed before further verifier work.
