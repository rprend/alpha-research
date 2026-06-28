# Qwen Non-Final Frontier Launch Packet

Generated: 2026-06-28T07:58:10.494Z

Status: `ready_for_bounded_gpu_candidate_generation_after_preflight`

This packet materialization made no OpenAI calls and launched no GPU jobs.

## Purpose

Generate non-final Qwen-style candidates for verifier/ranker supervision. The packet trains on early source papers and evaluates on a held-out non-final window with no paper overlap.

## Counts

| Dataset | Rows |
| --- | ---: |
| SFT train | 469 |
| SFT validation | 4 |
| DPO train | 1269 |
| DPO validation | 9 |
| Eval prompts | 80 |

## Launch Gate

GPU launch is not automatic.
- Run the generated packet dataset validator.
- Run grounded-QA repository validator.
- Run bash syntax checks for copied launch scripts.
- Check total budget, Prime auth, wallet, active pods, and live GPU availability.
- Run bounded smoke with MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, and REPORT_TO=none.
- After predictions exist, citation-repair and judge the non-final Qwen candidates before merging into support-ranker supervision.
