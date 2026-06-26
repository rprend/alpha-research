# Joint-Action Qwen 3B Local Feasibility Probe

This records local no-spend attempts to run the bounded Qwen 3B joint-action smoke before using paid GPU compute.

## Environment

- Memory: 24.0 GiB
- CPU count: 10
- Torch: 2.8.0
- MPS available: true
- uv: 0.10.9

## Attempts

| Attempt | Outcome | Stage reached | Failure class |
| --- | --- | --- | --- |
| auto_device_map_1step | failed | Qwen 2.5 3B loaded with disk/meta offload; SFT dataset tokenized; first backward pass started. | local_offload_training_incompatible |
| no_offload_mps_1step | stopped_after_timeout | Qwen 2.5 3B loaded without meta/disk offload warning; SFT dataset tokenized; first backward pass ran for about 5 minutes without completing one step. | local_training_too_slow_for_bounded_smoke |

## Conclusion

The local Mac can load Qwen 3B and start SFT, but auto offload breaks backward and no-offload MPS does not complete a single bounded step in a reasonable smoke window.

Next step: Refresh Prime auth or add HF credits, then execute the existing budget-gated remote GPU smoke plan.

## Budget

- OpenAI calls: 0
- OpenAI cost: $0
- External compute cost: $0
- Actual total spend remains $5.878323650000014
- Remaining budget: $94.12167634999999
