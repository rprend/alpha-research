# Qwen Coverage-Gap Scaffold Launch Packet

Generated: 2026-06-28T05:16:27.790Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | 534 |
| SFT validation | 358 |
| DPO train | 1145 |
| DPO validation | 670 |
| Eval prompts | 69 |

Scaffold rows added: 147 SFT train, 257 DPO train.

## Launch Gate

GPU launch is not automatic. Required next steps:
- Run the generated packet dataset validator.
- Run grounded-QA repository validator.
- Run bash syntax checks for copied launch scripts.
- Check total budget, Prime auth, wallet, active pods, and live GPU availability.

This packet materialization made no OpenAI calls and launched no GPU jobs.
