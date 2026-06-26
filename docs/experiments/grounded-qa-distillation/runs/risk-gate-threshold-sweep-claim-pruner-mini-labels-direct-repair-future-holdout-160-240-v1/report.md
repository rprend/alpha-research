# Risk-Gate Threshold Sweep

Gate run: `risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1`

This replay makes no LLM calls. It inherits direct-judge labels for kept source predictions and gate-judge labels for abstentions that are already covered by the source threshold `0.7`.

| Threshold | Answered | Abstained | Gate fired | Answer support | Abstention support | Overall correct | Unsupported answers | Unsupported abstentions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.20 | 64 | 16 | 0 | 67.2% | 100.0% | 73.8% | 21 | 0 |
| 0.25 | 64 | 16 | 0 | 67.2% | 100.0% | 73.8% | 21 | 0 |
| 0.30 | 63 | 17 | 1 | 68.3% | 100.0% | 75.0% | 20 | 0 |
| 0.35 | 63 | 17 | 1 | 68.3% | 100.0% | 75.0% | 20 | 0 |
| 0.40 | 62 | 18 | 2 | 69.4% | 100.0% | 76.3% | 19 | 0 |
| 0.45 | 61 | 19 | 3 | 70.5% | 100.0% | 77.5% | 18 | 0 |
| 0.50 | 60 | 20 | 4 | 70.0% | 100.0% | 77.5% | 18 | 0 |
| 0.55 | 57 | 23 | 7 | 71.9% | 100.0% | 80.0% | 16 | 0 |
| 0.60 | 54 | 26 | 10 | 72.2% | 96.2% | 80.0% | 15 | 1 |
| 0.65 | 48 | 32 | 16 | 77.1% | 96.9% | 85.0% | 11 | 1 |
| 0.70 | 42 | 38 | 22 | 81.0% | 94.7% | 87.5% | 8 | 2 |

Recommended threshold: `0.65`, with 48 answered examples and 85.0% inherited judged correctness.

