# Qwen Label Support Ranker

Generated: 2026-06-28T08:32:57.670Z

Status: `qwen_label_ranker_not_reliable`

This run makes no OpenAI calls and launches no compute. It trains from existing leakage-safe labels and keeps final-window Qwen frontier rows diagnostic-only.

| Split | Rows/pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pointwise | 161 | 106 | 65.8% |
| Qwen non-final validation pointwise | 12 | 7 | 58.3% |
| Existing validation pairwise | 24 | 15 | 62.5% |
| Final diagnostic pairwise | 61 | 24 | 39.3% |
| Final diagnostic selection | 8 | 4 | 50.0% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Reason: The Qwen-label ranker still does not clear all held-out validation and final diagnostic thresholds.
- Next step: Inspect misses and either add more non-final Qwen support labels or train a stronger verifier before another generator run.
