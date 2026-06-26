# Manuscript Evidence Map

Generated: 2026-06-26T20:43:29.316Z

Status: `not_paper_ready` (10/12 readiness requirements passing)

## What Can Be Claimed Now

- Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.
- Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.
- A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases, but abstention-boundary cases remain unstable.
- The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.

## Claims To Avoid

- A smaller trained model has been shown to preserve citation-grounded correctness.
- Joint-action SFT/DPO beats the existing scaffolds.
- The work is ready as a NeurIPS submission.
- The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.

## Main Current Result

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | 71.8% | 64.1% | 117 |
| Balanced zero-call risk gate | 79.9% | 70.0% | 90 |
| Risk gate + deterministic claim-entailment guard | 83.2% | 74.1% | 85 |

## Required Final Result

- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Current pipeline status: `waiting_for_qwen3b_predictions`
- Estimated total after GPU smoke and judge: $10.3455

The Qwen 3B result and its grounded-correctness judge are still missing. The manuscript must not claim a trained-student win until those artifacts exist.

## Manuscript Outline Status

| Section | Status | Evidence |
| --- | --- | --- |
| Introduction | draftable | Problem framing from README<br>D101 novelty narrowing<br>novelty-watchlist-2026-06-26-v1 |
| Dataset and Evolving-KB Protocol | draftable_with_public_proxy_caveat | trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1<br>extended_temporal_future_holdout-manifest.json |
| Post-Training Data Construction | draftable | teacher/repaired label exports<br>post-training-policy-ablation-2026-06-26-v1<br>coverage-constrained-support-frontier-2026-06-26-v1<br>joint-action-packet-quality-audit-2026-06-26-v1<br>support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1<br>joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 |
| Baselines and Ablations | draftable | drag-like-rag-distillation-comparison-2026-06-26-v1<br>longcite-style-citation-sft-comparison-2026-06-26-v1<br>writeback-kb-amortization-scoped-exclusion-2026-06-26-v1<br>risk-gate-transfer-synthesis-240-389-v1<br>claim-entailment-guard-validation-240-389-v1 |
| Final Trained Student Result | blocked_until_qwen3b_smoke_and_judge | docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl<br>openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1 |
| Limitations and Threat Model | draftable | public arXiv proxy, not private KB<br>abstention-boundary-reliability-audit-2026-06-26-v1<br>coverage/support tradeoff<br>remote GPU auth blocker |

## Budget

- Actual total spend: $5.893100
- External compute spend: $0.000000
- Remaining: $94.106900

This evidence map makes no OpenAI calls, launches no GPU jobs, and records no spend.
