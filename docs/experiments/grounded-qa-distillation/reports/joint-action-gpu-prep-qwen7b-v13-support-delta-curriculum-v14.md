# V13 Support-Delta Launch Packet

Generated: 2026-06-28T06:31:14.651Z

Status: `ready_for_bounded_gpu_smoke_after_preflight`

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | 547 |
| SFT validation | 371 |
| DPO train | 1480 |
| DPO validation | 1005 |
| Eval prompts | 69 |

Support-delta rows added: 160 SFT train, 592 DPO train.

## Launch Gate

GPU launch is not automatic. Required next steps:
- Run the generated packet dataset validator.
- Run grounded-QA repository validator.
- Run bash syntax checks for copied launch scripts.
- Check total budget, Prime auth, wallet, active pods, and live GPU availability.

This packet materialization made no OpenAI calls and launched no GPU jobs.
