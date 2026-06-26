# Joint-Action GPU Prep

## Setup

- Run id: `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`
- Support prep run: `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Hub model id: `rprendergast/grounded-qa-joint-action-qwen3b-lora-v1`
- Estimated GPU cost: $12.00
- OpenAI calls: 0

## Dataset

| Split | Rows |
| --- | ---: |
| SFT train | 185 |
| SFT validation | 59 |
| DPO train | 59 |
| DPO validation | 21 |
| Eval prompts | 69 |

This packet implements the D95 decision: the next student should learn a joint action policy rather than a scalar suppression threshold.
