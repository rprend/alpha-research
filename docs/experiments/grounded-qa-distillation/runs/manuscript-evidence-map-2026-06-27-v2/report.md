# Manuscript Evidence Map

Generated: 2026-06-27T03:28:16.677Z

Status: `not_paper_ready` (11/13 readiness requirements passing)

## What Can Be Claimed Now

- Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.
- Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.
- A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases; a disagreement taxonomy shows remaining disagreements are mostly abstention-boundary reversals.
- The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.
- The planned Qwen 3B smoke and judge have explicit break-even accounting under the $100 cap, conditioned on the missing quality gate.
- The final claim acceptance matrix is executable and currently blocks the trained-student claim until Qwen predictions, paid judging, provenance, Pareto update, and readiness gates pass.
- Compact faithful-context QA is a close baseline family; current artifacts position against it but do not replace a true OCC-RAG-like baseline on the same update-heldout splits.
- Citation-grounding metrics and compact QA memories are close neighbors; current artifacts position against them but do not replace a true citation-grounding or compact-memory baseline on the final update-heldout window.
- Citation-RAG decomposition/ranking, academic citation prediction, and generate-then-verify systems are close neighbors; current artifacts position against them but do not replace a same-window retrieval-side or verifier-side baseline.
- A same-window lexical faithfulness-ranking filter is now measured as a zero-call retrieval-side control; it does not improve final-window support-oracle correctness at the train-selected threshold.
- An unsupported-answer repairability audit shows final-window direct failures mostly require answer repair/regeneration or abstention, not citation repair alone.

## Claims To Avoid

- A smaller trained model has been shown to preserve citation-grounded correctness.
- Joint-action SFT/DPO beats the existing scaffolds.
- The work is ready as a NeurIPS submission.
- The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.
- The git-doc prototype is a natural versioned-KB benchmark rather than a deterministic snapshot diagnostic.
- The project is the first compact faithful-context-QA model, citation-grounding metric, compact-memory amortization method, citation-RAG decomposition/ranking method, academic citation prediction benchmark, generate-then-verify RAG method, or enterprise agentic RAG system.

## Main Current Result

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | 71.8% | 64.1% | 117 |
| Balanced zero-call risk gate | 79.9% | 70.0% | 90 |
| Risk gate + deterministic claim-entailment guard | 83.2% | 74.1% | 85 |

## Required Final Result

- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Current pipeline status: `waiting_for_qwen3b_predictions`
- Local control substitution status: `local_controls_rejected_as_final_qwen_smoke`
- Estimated total after GPU smoke and judge: $10.3636

The Qwen 3B result and its grounded-correctness judge are still missing. The manuscript must not claim a trained-student win until those artifacts exist.

## Manuscript Outline Status

| Section | Status | Evidence |
| --- | --- | --- |
| Introduction | draftable | Problem framing from README<br>D101 novelty narrowing<br>novelty-watchlist-2026-06-27-v2<br>citation-faithfulness-neighbor-comparison-2026-06-27-v1 |
| Dataset and Evolving-KB Protocol | draftable_with_public_proxy_caveat | trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1<br>versioned-private-kb-prototype-git-docs-2026-06-26-v1<br>versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1<br>versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1<br>versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1<br>versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2<br>versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2<br>extended_temporal_future_holdout-manifest.json |
| Post-Training Data Construction | draftable | teacher/repaired label exports<br>post-training-policy-ablation-2026-06-26-v1<br>coverage-constrained-support-frontier-2026-06-26-v1<br>distillation-loss-accounting-2026-06-27-v1<br>joint-action-packet-quality-audit-curriculum-2026-06-27-v1<br>unsupported-answer-repairability-audit-final-window-2026-06-27-v1<br>support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1<br>joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 |
| Baselines and Ablations | draftable | drag-like-rag-distillation-comparison-2026-06-26-v1<br>longcite-style-citation-sft-comparison-2026-06-26-v1<br>faithful-context-qa-comparison-2026-06-27-v1<br>citation-grounding-memory-comparison-2026-06-27-v1<br>citation-faithfulness-neighbor-comparison-2026-06-27-v1<br>faithfulness-ranking-control-final-window-2026-06-27-v1<br>writeback-kb-amortization-scoped-exclusion-2026-06-26-v1<br>versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1<br>risk-gate-transfer-synthesis-240-389-v1<br>claim-entailment-guard-validation-240-389-v1<br>amortization-break-even-qwen3b-2026-06-26-v1 |
| Final Trained Student Result | blocked_until_qwen3b_smoke_and_judge | final-claim-acceptance-matrix-2026-06-27-v1<br>docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl<br>openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1 |
| Limitations and Threat Model | draftable | public arXiv proxy, not private KB<br>abstention-boundary-reliability-audit-2026-06-26-v1<br>judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2<br>coverage/support tradeoff<br>remote GPU auth blocker |

## Budget

- Actual total spend: $5.896386
- External compute spend: $0.000000
- Remaining: $94.103614

This evidence map makes no OpenAI calls, launches no GPU jobs, and records no spend.
