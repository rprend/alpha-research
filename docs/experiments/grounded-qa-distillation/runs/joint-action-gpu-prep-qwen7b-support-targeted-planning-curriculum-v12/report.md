# Support-Targeted Planning Launch Packet

Generated: 2026-06-28T03:38:42.791Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | 387 |
| SFT validation | 216 |
| DPO train | 888 |
| DPO validation | 431 |
| Eval prompts | 69 |

Planning rows added: 147 SFT train, 257 DPO train.

## Launch Gate

GPU launch is not automatic. Required next steps:
- Run packet dataset validator.
- Run grounded-QA repository validator.
- Run bash syntax checks for copied launch scripts.
- Check total budget, Prime auth, wallet, active pods, and live A6000 availability.

This packet materialization made no OpenAI calls and launched no GPU jobs.
