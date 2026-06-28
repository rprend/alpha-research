# Joint-Action Curriculum Packet

Run id: `joint-action-gpu-prep-qwen7b-repair-regeneration-focused-curriculum-v8`

Source packet: `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`

## Why This Packet Exists

Final-window unsupported direct answers are mostly answer repair/regeneration or abstention cases, not citation-only repair. Oversample those action rows before the bounded Qwen 3B smoke.

## Repairability Signal

| Unsupported direct answers | Citation-repair candidates | Answer repair/regeneration needed | Should abstain |
| ---: | ---: | ---: | ---: |
| 37 | 1 | 16 | 20 |

## Row Counts

| Split | Source rows | Curriculum rows |
| --- | ---: | ---: |
| SFT train | 185 | 303 |
| SFT validation | 59 | 59 |
| DPO train | 59 | 177 |
| DPO validation | 21 | 21 |
| Eval prompts | 69 | 69 |

## Train Label Mix

| Label | Source SFT | Curriculum SFT | Source DPO | Curriculum DPO |
| --- | ---: | ---: | ---: | ---: |
| Supported answer | 126 | 126 | n/a | n/a |
| Repair/regenerate | 41 | 123 | 41 | 123 |
| Abstain | 18 | 54 | 18 | 54 |

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
