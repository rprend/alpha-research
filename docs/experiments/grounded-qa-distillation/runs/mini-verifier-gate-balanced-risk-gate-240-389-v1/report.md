# Mini Verifier Gate Over Balanced Risk Gate

Scope: balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389

This synthesis makes no LLM calls. It uses the paid `gpt-4o-mini` judge runs as a cheap verifier signal over balanced risk-gate outputs, then evaluates the resulting keep/abstain gate against existing stronger `gpt-4o` judgments.

The source mini judge runs made 149 calls and cost $0.01805595.

| Window | Strong baseline correct | Mini judged correct | Mini/strong agreement | Mini-verifier correct vs strong | Combined guard correct vs strong | Mini suppressions | Mini suppressed unsupported | Mini harmful suppressions | Combined suppressions | Combined harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 241-320 | 64 / 80 (80.0%) | 97.5% | 82.5% | 66 / 80 (82.5%) | 68 / 80 (85.0%) | 2 | 2 | 0 | 4 | 0 |
| 321-389 | 55 / 69 (79.7%) | 95.7% | 84.1% | 57 / 69 (82.6%) | 57 / 69 (82.6%) | 2 | 2 | 0 | 4 | 1 |
| Aggregate | 119 / 149 (79.9%) | 96.6% | 83.2% | 123 / 149 (82.6%) | 125 / 149 (83.9%) | 4 | 4 | 0 | 8 | 1 |

## Interpretation

Using `gpt-4o-mini` as a per-query verifier is too optimistic for this support task, but its rare negative calls are useful: the mini-verifier-only gate suppresses four unsupported answers with no harmful suppressions. Unioning it with the deterministic numeric/comparative guard gives the best current support-first scaffold, though it still answers fewer examples and is not an amortized local model.
