# Joint-Action Curriculum Packet

Run id: `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`

Source packet: `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`

## Why This Packet Exists

Final-window unsupported direct answers are mostly answer repair/regeneration or abstention cases, not citation-only repair. Oversample those action rows before the bounded Qwen 3B smoke.

## Repairability Signal

| Unsupported direct answers | Citation-repair candidates | Answer repair/regeneration needed | Should abstain |
| ---: | ---: | ---: | ---: |
| 19 | 1 | 12 | 6 |

## Row Counts

| Split | Source rows | Curriculum rows |
| --- | ---: | ---: |
| SFT train | 185 | 244 |
| SFT validation | 59 | 59 |
| DPO train | 59 | 118 |
| DPO validation | 21 | 21 |
| Eval prompts | 69 | 69 |

## Train Label Mix

| Label | Source SFT | Curriculum SFT | Source DPO | Curriculum DPO |
| --- | ---: | ---: | ---: | ---: |
| Supported answer | 126 | 126 | n/a | n/a |
| Repair/regenerate | 41 | 82 | 41 | 82 |
| Abstain | 18 | 36 | 18 | 36 |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
