# Qwen Coverage-Gap Scaffold Packet

Generated: 2026-06-28T05:11:08.787Z

Status: `ready_for_launch_packet_merge`

## Qwen-Only Coverage Gap

| Qwen oracle missed answerable rows | Yes/no | Numeric | List | Multi-evidence |
| ---: | ---: | ---: | ---: | ---: |
| 9 | 3 | 4 | 5 | 4 |

## Packet Counts

| Split | SFT | DPO | Yes/no SFT | Numeric SFT | List SFT | Multi-evidence SFT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 147 | 257 | 20 | 42 | 42 | 49 |
| Validation | 142 | 239 | 7 | 53 | 48 | 49 |

## Decision

The Qwen-only coverage gaps have leakage-safe train and validation analogs with both SFT and DPO supervision.

Next step: Merge this scaffold-distillation packet into a bounded Qwen 7B v13 launch packet, run packet-quality validation, then do Prime/budget preflight before any GPU creation.

No OpenAI calls or GPU jobs were made.
