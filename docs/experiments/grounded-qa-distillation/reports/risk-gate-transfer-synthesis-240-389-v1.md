# Risk-Gate Transfer Synthesis

Scope: extended_temporal_future_holdout examples 241-389, excluding the threshold-selection window

This synthesis makes no LLM calls. It aggregates already-judged transfer windows after the threshold-selection window.

| Policy | Examples | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o overall correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 149 | 117 | 78.5% | 64.1% | 70.4% | 30.2% | 98.3% | 64.1% | 71.8% |
| Balanced claim-pruner-label risk gate | 149 | 90 | 60.4% | 65.4% | 56.2% | 24.7% | 100.0% | 70.0% | 79.9% |

## Deltas

- Answered examples: -27
- GPT-4o overall judged correctness: +8.1pp
- GPT-4o answer support: +5.9pp
- Answer token F1: -5.5pp
- Citation recall: -14.2pp

## Window Details

| Window | Policy | Answered | GPT-4o answer support | GPT-4o overall correct |
| --- | --- | ---: | ---: | ---: |
| 241-320 | Direct repair | 64 | 64.1% | 71.3% |
| 241-320 | Risk gate | 46 | 69.6% | 80.0% |
| 321-389 | Direct repair | 53 | 64.2% | 72.5% |
| 321-389 | Risk gate | 44 | 70.5% | 79.7% |
