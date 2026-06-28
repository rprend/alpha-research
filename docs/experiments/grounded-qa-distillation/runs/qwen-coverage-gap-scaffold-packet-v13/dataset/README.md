# Qwen Coverage-Gap Scaffold Packet

Run: `qwen-coverage-gap-scaffold-packet-v13`

This packet is deterministic and local. It targets the final-window rows where the current Qwen-only judged oracle lacks a supported answer. Final-window rows are diagnostic prompts only and are not used as training labels.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | 147 | 257 |
| Validation | 142 | 239 |
| Qwen-miss eval prompts | 9 | n/a |
