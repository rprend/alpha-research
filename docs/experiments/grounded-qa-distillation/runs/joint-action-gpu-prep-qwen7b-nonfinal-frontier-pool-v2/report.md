# Qwen Non-Final Frontier Pool Launch Packet

Generated: 2026-06-28T09:05:06.099Z

Status: `ready_for_bounded_gpu_frontier_pool_after_preflight`

This packet makes no OpenAI calls and launches no compute.

| Eval prompts | Samples per prompt | Projected predictions | Estimated GPU cost | Projected total |
| ---: | ---: | ---: | ---: | ---: |
| 80 | 3 | 240 | $5.00 | $17.68 |

## Decision

Launch now: `false`

The next paid run should produce multiple non-final candidates per input, then citation-repair and judge them before verifier training.
