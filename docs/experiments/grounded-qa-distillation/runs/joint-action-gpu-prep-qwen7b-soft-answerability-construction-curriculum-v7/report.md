# Failure-Driven Grounded QA Curriculum Packet

Run id: `joint-action-gpu-prep-qwen7b-soft-answerability-construction-curriculum-v7`

Source packet: `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`

Failure audit: `support-failure-analysis-qwen7b-v6-answerability-gated-smoke-citation-repair-2026-06-27-v1`

## Purpose

This packet targets the observed no-citation, too-short, invalid-citation, overclaiming, counterfactual-answering, and over-abstention failure modes before any larger model escalation.

## Policy Changes

- Harden system prompts to require evidence-sufficiency decision before answering.
- Reject bare yes/no, empty, citation-only, and no-citation grounded answers.
- Add synthetic DPO hard negatives from training rows only: cited/reference answer or abstention is chosen over no-citation/too-short/spurious answers.
- Add support-aware DPO hard negatives from train/validation rows only: choose concise directly cited answers or abstention over overclaiming answers that add unsupported context, task, model, or comparison claims.
- Tighten the system prompt against dataset sizes, main-focus statements, baseline/comparison claims, task descriptions, model names, and annotation/context details unless directly supported by cited evidence.
- Append deterministic local answerability hints to every train/validation/eval prompt using only the question and compact evidence pack.
- Add soft-answerability construction DPO positives from train/validation rows only: choose the cited target answer over conservative abstention when a softer question-evidence relevance scorer finds direct or medium evidence.
- Keep support-aware overclaim and insufficient-evidence hard negatives so coverage pressure is paired with span-grounding pressure.
- Keep final eval prompts unchanged and never use final-window judge labels as training examples.

## Counts

| Split | Source rows | New rows |
| --- | ---: | ---: |
| SFT train | 244 | 244 |
| SFT validation | 59 | 59 |
| DPO train | 362 | 797 |
| DPO validation | 80 | 188 |
| Eval prompts | 69 | 69 |

## Synthetic Hard Negatives And Construction Preferences

| DPO train added | DPO validation added | No-citation negatives | Spurious abstention negatives | Overclaim negatives | Insufficient-evidence negatives | Blanket answer-over-abstain | Gated answer-over-abstain | Soft answer-over-abstain | Rejected by hard gate | Rejected by soft scorer |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 679 | 167 | 208 | 36 | 208 | 36 | 0 | 0 | 191 | 0 | 17 |

## Leakage Guard

- Eval example ids unchanged: yes
- Eval references unchanged: yes
- Eval system prompt hardened: yes
- Final-window failure labels used for training: no

This packet makes no OpenAI calls, launches no GPU jobs, and records no spend.
