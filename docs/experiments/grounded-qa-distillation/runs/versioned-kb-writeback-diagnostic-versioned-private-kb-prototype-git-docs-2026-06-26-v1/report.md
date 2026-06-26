# Versioned KB WriteBack Diagnostic

Generated: 2026-06-26T22:16:01.457Z

Status: `writeback_diagnostic_complete`

## Systems

| System | Leaky | Answer rate | Overall correct | Answer support | Abstention correct | Inline citation |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| leak_safe_train_writeback_only | no | 33.3% | 60.0% | 60.0% | 100.0% | 100.0% |
| leak_safe_train_writeback_plus_live_snapshot | no | 60.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| leaky_eval_writeback_upper_bound | yes | 100.0% | 46.7% | 46.7% | 0.0% | 100.0% |

## Eval-Update Slice

| System | Correct on eval updates |
| --- | ---: |
| leak_safe_train_writeback_only | 0.0% |
| leak_safe_train_writeback_plus_live_snapshot | 100.0% |
| leaky_eval_writeback_upper_bound | 66.7% |

Interpretation: Write-back memory is a valid competing amortization family only when records are created from prior snapshots. Train-only memory helps stable facts but cannot replace live retrieval for new updates; eval-written memory leaks future facts and over-answers stale train-snapshot queries.

This diagnostic makes no OpenAI calls, launches no GPU jobs, and records no spend.
