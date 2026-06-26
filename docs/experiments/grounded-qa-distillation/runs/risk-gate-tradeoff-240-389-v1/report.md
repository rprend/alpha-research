# Risk-Gate Tradeoff Analysis

Scope: extended_temporal_future_holdout examples 241-389

This analysis makes no LLM calls. It classifies row-level changes using existing direct-repair and risk-gate `gpt-4o` judgments.

| Category | Rows |
| --- | ---: |
| Retained supported answers | 64 |
| Retained unsupported answers | 26 |
| Effective suppressions of unsupported answers | 15 |
| Ineffective suppressions of unsupported answers | 1 |
| Harmful suppressions of supported answers | 2 |
| Ambiguous suppressions of supported answers | 9 |
| Direct abstentions | 32 |

## Headroom

| Scenario | Correct / examples | Correct rate |
| --- | ---: | ---: |
| Current gate | 119 / 149 | 79.9% |
| Recover only harmful false-suppressed supported answers | 121 / 149 | 81.2% |
| Suppress retained unsupported answers | 145 / 149 | 97.3% |
| Do both | 147 / 149 | 98.7% |

The next system should prioritize suppressing retained unsupported answers; recovering supported answers has much less headroom unless paired with a stronger verifier.
