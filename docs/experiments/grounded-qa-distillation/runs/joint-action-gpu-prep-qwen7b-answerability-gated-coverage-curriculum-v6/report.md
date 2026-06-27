# Qwen 3B Failure-Driven Curriculum Packet

Run id: `joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6`

Source packet: `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`

Failure audit: `support-failure-analysis-qwen7b-v5-coverage-smoke-citation-repair-2026-06-27-v1`

## Purpose

The first trained Qwen 3B smoke failed on support despite good JSON validity. This packet targets the observed no-citation, too-short, invalid-citation, and counterfactual-answering failure modes before any larger model escalation.

## Policy Changes

- Harden system prompts to require evidence-sufficiency decision before answering.
- Reject bare yes/no, empty, citation-only, and no-citation grounded answers.
- Add synthetic DPO hard negatives from training rows only: cited/reference answer or abstention is chosen over no-citation/too-short/spurious answers.
- Add support-aware DPO hard negatives from train/validation rows only: choose concise directly cited answers or abstention over overclaiming answers that add unsupported context, task, model, or comparison claims.
- Tighten the system prompt against dataset sizes, main-focus statements, baseline/comparison claims, task descriptions, model names, and annotation/context details unless directly supported by cited evidence.
- Add answerability-gated coverage DPO positives from train/validation rows only: choose the directly cited target answer over a conservative abstention only when deterministic evidence-sufficiency checks pass.
- Keep abstention pressure for indirect, partial, comparative-without-stated-comparison, and counterfactual-looking evidence packs.
- Keep final eval prompts unchanged and never use final-window judge labels as training examples.

## Counts

| Split | Source rows | New rows |
| --- | ---: | ---: |
| SFT train | 244 | 244 |
| SFT validation | 59 | 59 |
| DPO train | 362 | 671 |
| DPO validation | 80 | 158 |
| Eval prompts | 69 | 69 |

## Synthetic Hard Negatives

| DPO train added | DPO validation added | Train no-citation negatives | Train spurious abstention negatives | Train overclaim negatives | Train insufficient-evidence negatives | Train blanket answer-over-abstain | Train gated answer-over-abstain | Train answerable rows rejected by gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 553 | 137 | 208 | 36 | 208 | 36 | 0 | 65 | 143 |

## Leakage Guard

- Eval example ids unchanged: yes
- Eval references unchanged: yes
- Eval system prompt hardened: yes
- Final-window failure labels used for training: no

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
