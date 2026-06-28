# Final Selector Ceiling Audit

This audit reads existing final-window selection artifacts and asks whether misses are recoverable by better selection from already-present supported candidates.

## Summary

- Status: cheap_frontier_selector_bottleneck_confirmed
- Best deployable policy: time_aware_source_prefix_recency_4x
- Best deployable selected support: 89.8%
- Best deployable oracle support ceiling: 100.0%
- Main failure mode: cheap_qwen_frontier_selector_fails_to_capture_present_supported_candidates
- Launch GPU now: no
- Buy OpenAI labels now: no
- Train support verifier next: yes

## Policy Metrics

| Policy | Selected on final | Examples | Selected support | Oracle support ceiling | Ceiling capture | Recoverable misses |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| constrained_pool_pairwise | no | 8 | 37.5% | 100.0% | 37.5% | 5 |
| boundary_only | no | 8 | 62.5% | 100.0% | 62.5% | 3 |
| filtered_boundary_hybrid | no | 8 | 50.0% | 100.0% | 50.0% | 4 |
| overexpansion_aware | yes | 8 | 62.5% | 100.0% | 62.5% | 3 |
| calibrated_overexpansion_hybrid | no | 8 | 50.0% | 100.0% | 50.0% | 4 |
| time_aware_source_prefix_recency_4x | no | 49 | 89.8% | 100.0% | 89.8% | 5 |

## Decision

The cheap Qwen-frontier pool already contains supported answers in every final diagnostic example, but its best selector only chooses supported answers in 5/8 cases; generator-only spend is not the next bottleneck.

Next step: Build a verifier target that directly judges claim/evidence support for candidate answers, then test it as a selector before any new generator GPU run.
