# Amortized Grounded QA over Evolving Domain Knowledge Bases

_Draft skeleton generated from current artifacts; not submission-ready until the Qwen 3B joint-action result is complete_

## Submission Status

This draft is **not submission-ready**. The current readiness gate is `not_paper_ready` with 10/12 requirements passing. The missing blockers are `qwen3b_joint_action_smoke_result` and `grounded_correctness_eval_for_student`.

## Abstract

We study amortized grounded question answering over a domain knowledge base that changes over time. The task is to replace expensive multi-step retrieval-and-generation behavior with cheaper post-trained students or scaffolds while preserving citation-grounded correctness, abstention behavior, and auditable claim support.

Current evidence supports a conservative scaffold result on a dated public QASPER/arXiv proxy: support-aware gating and deterministic claim checks improve judged correctness over direct mini-model repair at a coverage cost. The final trained Qwen 3B joint-action student result is not yet available, so this abstract must be finalized only after that run and grounded judge complete.

## Introduction

Status: `draftable`

Many domain QA systems can answer questions only by repeatedly retrieving evidence, asking a strong model to reason over it, and post-checking citations. That behavior is expensive when the same domain is queried repeatedly. The central question is whether the expensive behavior can be amortized into post-training data for a smaller model or a cheap scaffold without losing the correctness guarantee that every answer claim is supported by cited evidence.

This paper frames the problem more narrowly than generic RAG or generic citation generation. The input contains a question, a compact retrieved evidence pack, and document metadata including dates. The output must include an answer or abstention, inline evidence citations, and a claim table suitable for verification.

The current draft should claim a public dated-domain proxy, not a private enterprise KB proof. A private-KB claim remains future work unless a private/versioned corpus is added.

Evidence: `README framing`, `D101`, `drag-like-rag-distillation-comparison-2026-06-26-v1`

## Task and Evolving-KB Protocol

Status: `draftable_with_caveat`

The first knowledge base is QASPER, a collection of NLP research papers with questions, answers, and evidence spans. The final holdout contains 389 examples over 77 papers.

The temporal protocol uses a trusted arXiv API snapshot for the final public proxy: 77/77 future-holdout papers have trusted dates spanning 2020-02 to 2020-04.

This is an evolving-domain benchmark proxy. The claim is not that the benchmark itself is private, but that the protocol isolates temporally later evidence packs and records date provenance.

As a concrete private/domain-KB upgrade path, versioned-private-kb-prototype-git-docs-2026-06-26-v1 builds 30 deterministic examples from repository-local git document snapshots, including stale-snapshot abstentions. versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1 shows the stale-snapshot failure mode directly: naive citation-copy over-answers stale train-snapshot questions, while a snapshot-aware prefix retriever handles the deterministic slice. versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1 adds a small write-back memory diagnostic over the same snapshots. versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1 keeps the boundary explicit: the prototype is a deterministic snapshot diagnostic with template questions and prefix leakage, not a natural versioned-KB benchmark.

Evidence: `trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1`, `versioned-private-kb-prototype-git-docs-2026-06-26-v1`, `versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, `versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1`

## Post-Training Data Construction

Status: `draftable`

The data construction pipeline creates positive and negative supervision from compact evidence packs. Accepted examples include grounded answers with inline citations and abstentions when evidence is insufficient. Rejected examples capture unsupported answers and overclaims.

The planned Qwen 3B joint-action packet combines SFT rows and preference pairs so the student learns both answer formatting and support-sensitive action selection. The generated runner validates the dataset, performs bounded SFT/DPO, evaluates the saved adapter, and writes judge-ready predictions.

Evidence: `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`, `joint-action-launch-plan-prime-qwen3b-smoke-v1`

## Experiments

Status: `partial_results_available`

The current complete empirical result is a scaffold result, not a trained-student result. Direct mini-model repair reaches 71.8% judged correctness on the transfer windows; a balanced zero-call risk gate reaches 79.9%; adding a deterministic claim-entailment guard reaches 83.2% while answering fewer examples.

These results show that support-aware data and guards can improve citation-grounded correctness, but they also expose the coverage tradeoff that a trained student is meant to address.

Evidence: `risk-gate-transfer-synthesis-240-389-v1`, `claim-entailment-guard-validation-240-389-v1`

## Related Work Positioning

Status: `draftable`

DRAG-like RAG distillation is the closest generic RAG-to-small-model family, but the comparison must be made on support, abstention, citation validity, and temporal splits rather than answer utility alone.

LongCite-style citation SFT motivates citation-format baselines, but the current artifacts show that citation syntax is not support: one local student reaches 97.5% inline citation compliance with only 5.0% answer support.

Write-back memory is a close competing amortization family. On the versioned git-doc diagnostic, train-only write-back reaches 60.0% overall correctness but cannot answer eval updates, train write-back plus live snapshot reaches 100.0%, and a leaky eval-written memory answers 100.0% of stale-snapshot queries incorrectly. A full natural-benchmark WriteBack baseline remains scoped out until dated/private snapshots prevent final-window leakage into retrieval.

Evidence: `drag-like-rag-distillation-comparison-2026-06-26-v1`, `longcite-style-citation-sft-comparison-2026-06-26-v1`, `writeback-kb-amortization-scoped-exclusion-2026-06-26-v1`, `versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1`

## Limitations

Status: `draftable`

The current benchmark is a public dated arXiv/QASPER proxy rather than a private enterprise KB. The git-doc extension is also not a natural benchmark: versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1 finds 100.0% template question wording and 100.0% quoted-prefix leakage. The support judge is model-based: a blind second-pass check reaches 76.2% exact agreement on deliberately hard rows, but the questionable-abstention bucket is unstable at 0.0% exact agreement. The strongest completed results improve correctness by suppressing risky answers, so answer coverage and abstention-boundary disagreements remain central metrics.

The final trained-student claim is blocked until remote GPU execution produces Qwen 3B predictions and the grounded-correctness judge evaluates them.

Evidence: `public arXiv proxy, not private KB`, `abstention-boundary-reliability-audit-2026-06-26-v1`, `coverage/support tradeoff`, `remote GPU auth blocker`

## Result Tables

### Current support-aware scaffold results on dated future windows

Status: `complete`

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | 71.8% | 64.1% | 117 |
| Balanced zero-call risk gate | 79.9% | 70.0% | 90 |
| Risk gate + deterministic claim-entailment guard | 83.2% | 74.1% | 85 |

### Related-work pressure points

Status: `complete`

| Baseline / gap | Metric | Note |
| --- | ---: | --- |
| DRAG-like direct mini RAG | 72.5% | Generic RAG student baseline |
| DRAG-like risk-gated scaffold | 79.7% | Improves support by suppressing answers |
| Citation syntax/support gap | 92.5% | Citation syntax can be far above support |

### Required trained-student result

Status: `blocked`

| Item | Value |
| --- | --- |
| Base model | Qwen/Qwen2.5-3B-Instruct |
| Pipeline status | waiting_for_qwen3b_predictions |
| Estimated total after smoke + judge | $10.3455 |

## Submission Blockers

- `run_qwen3b_smoke` (blocked_by_remote_auth_or_credits): RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_joint_action_smoke.sh
- `run_post_smoke_pipeline_default` (waiting_for_predictions): node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100
- `run_paid_judge` (waiting_for_integrity_and_dry_judge): node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true
- `refresh_novelty_audit_before_submission` (required_before_completion): Refresh web/paper search at final submission time and update novelty-watchlist artifacts.

## Claims Allowed Now

- Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.
- Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.
- A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases, but abstention-boundary cases remain unstable.
- The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.

## Claims To Avoid Until Qwen 3B Completes

- A smaller trained model has been shown to preserve citation-grounded correctness.
- Joint-action SFT/DPO beats the existing scaffolds.
- The work is ready as a NeurIPS submission.
- The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.
- The git-doc prototype is a natural versioned-KB benchmark rather than a deterministic snapshot diagnostic.
