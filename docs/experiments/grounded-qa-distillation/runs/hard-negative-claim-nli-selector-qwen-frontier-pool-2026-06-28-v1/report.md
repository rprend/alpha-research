# Hard-Negative Claim NLI Selector

Generated: 2026-06-28T10:18:40.816Z

Status: `hard_negative_selector_partial_signal`

This run makes no OpenAI calls and launches no external compute. It constructs hard non-final contrasts from existing judged Qwen frontier-pool pairs and evaluates final-window pairs only as forbidden diagnostics.

| Policy | Non-final val | Existing val | Final pairwise | Final selection |
| --- | ---: | ---: | ---: | ---: |
| Baseline pairwise | 90.5% | 79.2% | 57.4% | 50.0% |
| Hard-negative weighted | 90.5% | 66.7% | 54.1% | 50.0% |
| Train-tuned risk penalized | 90.5% | 79.2% | 57.4% | 50.0% |

Selected policy: `baseline_pairwise_selector`

Selected final diagnostic selection: 4/8 supported (50.0%).

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: yes
- Reason: Hard-negative and train-tuned risk penalties do not improve final selection over the unweighted selector.
- Next step: Buy a small targeted GPT-4o adjudication batch for final-like non-final switch candidates before another GPU generator run.
