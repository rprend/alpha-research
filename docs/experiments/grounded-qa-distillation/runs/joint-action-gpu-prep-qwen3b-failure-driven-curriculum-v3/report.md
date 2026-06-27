# Qwen 3B Failure-Driven Curriculum Packet

Run id: `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`

Source packet: `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`

Failure audit: `support-failure-analysis-qwen3b-smoke-citation-repair-2026-06-27-v1`

## Purpose

The first trained Qwen 3B smoke failed on support despite good JSON validity. This packet targets the observed no-citation, too-short, invalid-citation, and counterfactual-answering failure modes before any larger model escalation.

## Policy Changes

- Harden system prompts to require evidence-sufficiency decision before answering.
- Reject bare yes/no, empty, citation-only, and no-citation grounded answers.
- Add synthetic DPO hard negatives from training rows only: cited/reference answer or abstention is chosen over no-citation/too-short/spurious answers.
- Keep final eval prompts unchanged and never use final-window judge labels as training examples.

## Counts

| Split | Source rows | New rows |
| --- | ---: | ---: |
| SFT train | 244 | 244 |
| SFT validation | 59 | 59 |
| DPO train | 118 | 362 |
| DPO validation | 21 | 80 |
| Eval prompts | 69 | 69 |

## Synthetic Hard Negatives

| DPO train added | DPO validation added | Train no-citation answer negatives | Train spurious abstention negatives |
| ---: | ---: | ---: | ---: |
| 244 | 59 | 208 | 36 |

## Leakage Guard

- Eval example ids unchanged: yes
- Eval references unchanged: yes
- Eval system prompt hardened: yes
- Final-window failure labels used for training: no

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
