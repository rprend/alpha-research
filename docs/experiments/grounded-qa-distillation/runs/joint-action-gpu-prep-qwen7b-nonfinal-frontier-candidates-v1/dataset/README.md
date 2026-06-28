# Qwen Non-Final Frontier Candidate Packet

Run: `joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1`

This packet trains only on source rows 0-160 and evaluates on non-final source rows 240-320. It is intended to produce Qwen-style candidate answers that can be judged and used for verifier/ranker supervision without final-window leakage.

After predictions exist, citation-repair and judge the non-final Qwen candidates before merging them into support-ranker or verifier supervision.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | 469 | 1269 |
| Validation | 4 | 9 |
| Eval prompts | 80 | n/a |
