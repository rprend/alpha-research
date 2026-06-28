# Generation-Gap Failure-Driven Packet

Status: `ready_for_local_dataset_validation`

This packet makes no OpenAI calls and launches no Prime job.

## Source Signal

D329 shape status: `model_predictions_fail_shape_gate`

Overall shape: 0.500
Answerable supported shape: 0.286
Abstention shape: 1.000

## Rows

| Split | Source | Current | Added |
| --- | ---: | ---: | ---: |
| SFT train | 240 | 240 | 0 |
| SFT validation | 75 | 75 | 0 |
| DPO train | 397 | 951 | 554 |
| DPO validation | 124 | 297 | 173 |
| Eval prompts | 10 | 10 | 0 |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: Run the copied dataset validator and a packet-quality audit. Launch a bounded Prime smoke only if the packet validates and remains under the $100 spend cap.
- Reason: This packet changes the learning objective, but the current action is zero-cost materialization and validation, not GPU training.
