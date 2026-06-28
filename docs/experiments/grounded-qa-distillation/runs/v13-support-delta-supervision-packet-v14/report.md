# V13 Support-Delta Supervision Packet

Generated: 2026-06-28T06:24:13.811Z

Status: `ready_for_launch_packet_merge_after_validator`

This packet makes no OpenAI calls and launches no compute.

## Diagnostic Signal

| Diagnostic rows | Positives | Hard negatives | Targeted gap failures | Final labels used for training |
| ---: | ---: | ---: | ---: | --- |
| 39 | 17 | 14 | 8 | no |

## Packet Counts

| Split | SFT | DPO | Yes/no SFT | Numeric SFT | List SFT | Multi-evidence SFT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 160 | 592 | 20 | 42 | 42 | 49 |
| Validation | 155 | 574 | 7 | 53 | 48 | 49 |

## Decision

The packet has leakage-safe train/validation analog coverage, strong DPO density, and enough v13 hard-negative signal to justify a launch-packet merge.

Next step: Merge this v14 supervision packet into a bounded Qwen 7B launch packet only after adding validator coverage and running Prime/budget preflight.
