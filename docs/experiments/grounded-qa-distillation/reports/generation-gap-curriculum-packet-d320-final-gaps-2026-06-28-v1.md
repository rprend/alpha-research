# Generation Gap Curriculum Packet

Status: `ready_for_generation_gap_preflight`

This run makes no OpenAI calls and launches no Prime job.

## D320 Gap Mix

| Final gap rows | Answerable | Abstention | Counterfactual abstention | Supported-abstention candidate present |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 7 | 3 | 2 | 10 |

## Packet Counts

| Split | SFT | DPO | Answerable | Abstention | Answer over abstain | Abstention over unsupported | Supported over wrong evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 240 | 397 | 157 | 83 | 157 | 83 | 157 |
| Validation | 75 | 124 | 49 | 26 | 49 | 26 | 49 |

## Decision

- Launch GPU now: no
- Buy OpenAI labels now: no
- Use packet for next bounded generator run: yes
- Keep final gap targets diagnostic-only: yes
- Next step: Run a small local/Prime preflight only after this packet passes dataset validation and has a fixed evaluation harness for the 10 D320 final gap prompts.
- Reason: D320 showed selector-only headroom is small and 10 final misses lack supported answer candidates. This packet targets candidate creation and abstention preservation without using final labels for training.
