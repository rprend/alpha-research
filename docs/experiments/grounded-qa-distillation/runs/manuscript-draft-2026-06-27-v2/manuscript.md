# Amortized Grounded QA over Evolving Domain Knowledge Bases

_Draft skeleton generated from current artifacts; not submission-ready until the Qwen 3B joint-action result is complete_

## Submission Status

This draft is **not submission-ready**. The current readiness gate is `not_paper_ready` with 13/12 requirements passing. The missing blockers are `qwen3b_joint_action_smoke_result`.

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

As a concrete private/domain-KB upgrade path, versioned-private-kb-prototype-git-docs-2026-06-26-v1 builds 30 deterministic examples from repository-local git document snapshots, including stale-snapshot abstentions. versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1 shows the stale-snapshot failure mode directly: naive citation-copy over-answers stale train-snapshot questions, while a snapshot-aware prefix retriever handles the deterministic slice. versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1 adds a small write-back memory diagnostic over the same snapshots. versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1 keeps the boundary explicit: the original prototype is a deterministic snapshot diagnostic with template questions and prefix leakage. versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2 then probes the natural-question upgrade path with one ledgered question-authoring call while preserving deterministic answers and citations. versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2 evaluates that natural-question packet: naive citation-copy still fails stale train-snapshot abstentions, while the lexical snapshot guard reaches 96.7% overall correctness with one stable-question retrieval miss.

Evidence: `trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1`, `versioned-private-kb-prototype-git-docs-2026-06-26-v1`, `versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, `versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, `versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2`, `versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2`

## Post-Training Data Construction

Status: `draftable`

The data construction pipeline creates positive and negative supervision from compact evidence packs. Accepted examples include grounded answers with inline citations and abstentions when evidence is insufficient. Rejected examples capture unsupported answers and overclaims.

The planned Qwen 3B joint-action packet combines SFT rows and preference pairs so the student learns both answer formatting and support-sensitive action selection. The generated runner validates the dataset, performs bounded SFT/DPO, evaluates the saved adapter, and writes judge-ready predictions.

unsupported-answer-repairability-audit-final-window-2026-06-27-v1 supports the joint-action design on the final window: among 19 unsupported direct repaired answers, only 1 looks citation-repairable, while 12 require answer repair/regeneration and 6 should abstain.

The amortization accounting is explicit rather than implicit: amortization-break-even-qwen3b-2026-06-26-v1 estimates $4.467165 of planned GPU plus judge spend and $11.051026 total tracked spend after the smoke, still under the $100 cap. This is an economics precondition only; the trained model must still pass support, coverage, and citation-grounding gates.

distillation-loss-accounting-2026-06-27-v1 makes the preservation target explicit: Qwen 3B must preserve answer support, citation support/recall, abstention boundaries, update robustness, coverage, and amortized cost. Existing cheap controls preserve only pieces of that contract, so the final result should be reported as a preservation/loss tradeoff rather than a single headline score.

qwen3b-outcome-decision-policy-2026-06-27-v1 pre-registers the post-smoke interpretation: a negative result is reported before model escalation, a minimum-positive result is only partial amortization, and a strong-positive result still requires judge, provenance, cost, and novelty caveats.

Evidence: `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`, `joint-action-launch-plan-prime-qwen3b-smoke-v1`

## Experiments

Status: `partial_results_available`

The current complete empirical result is a scaffold result, not a trained-student result. Direct mini-model repair reaches 71.8% judged correctness on the transfer windows; a balanced zero-call risk gate reaches 79.9%; adding a deterministic claim-entailment guard reaches 83.2% while answering fewer examples.

A leakage-safe cross-window selector tunes only on examples 241-320 and evaluates on the untouched 321-389 final window. It selects threshold 0.55, answers 50/69 examples, and reaches 66.0% answer support and 75.4% overall judged correctness. This is the best current deployable 70%-coverage scaffold, but it remains an overlay on direct-mini outputs rather than a trained repair/regeneration model.

These results show that support-aware data and guards can improve citation-grounded correctness, but they also expose the coverage tradeoff that a trained student is meant to address.

The unsupported-answer repairability audit further narrows the failure mode: Keep the Qwen joint-action packet focused on answer repair/regeneration plus abstention; citation repair alone explains only a minority of unsupported final-window direct answers.

The cost table separates online call count from offline data/model construction. Existing zero-call local controls are cheaper but not good enough; therefore the amortization claim is conditioned on the missing Qwen 3B judged result, not on citation syntax or local inference alone.

The distillation-loss table records why: local_qwen05b_sft_answer_repeat2 preserves zero-call inference and citation format but loses answer support, while claim_entailment_guard preserves support by losing coverage.

final-claim-acceptance-matrix-2026-06-27-v1 is the fail-closed final-claim matrix. It currently reports final_claim_blocked with blockers: grounded_correctness_judge, answer_support_preserved, temporal_update_validity, amortized_cost_accounted, paper_readiness_gate_green.

Evidence: `risk-gate-transfer-synthesis-240-389-v1`, `candidate-selector-cross-window-240-320-to-321-389-v1`, `claim-entailment-guard-validation-240-389-v1`

## Related Work Positioning

Status: `draftable`

novelty-delta-matrix-2026-06-27-v1 turns the June 2026 watchlist into a claim-level boundary: 7 broad claim families are rejected as non-novel, and the only surviving claim is conditional on the missing Qwen 3B trained-student result and paid grounded-correctness judge.

DRAG-like RAG distillation is the closest generic RAG-to-small-model family, but the comparison must be made on support, abstention, citation validity, and temporal splits rather than answer utility alone.

LongCite-style citation SFT motivates citation-format baselines, but the current artifacts show that citation syntax is not support: one local student reaches 97.5% inline citation compliance with only 5.0% answer support.

OCC-RAG: Optimal Cognitive Core for Faithful Question Answering is a close final-system baseline family because it targets compact faithful context QA with citations and abstention. faithful-context-qa-comparison-2026-06-27-v1 records the boundary: a true comparison must run an OCC-RAG-like model on the same compact evidence packs and update-heldout KB windows, then judge answer support, abstention support, citation recall, coverage, and cost.

citation-grounding-memory-comparison-2026-06-27-v1 positions citation-enforced fiscal RAG, legal citation-grounding metrics, and FD-RAG compact QA memories as close neighbors. The manuscript must separate citation existence, relevance/support, and temporal validity from inline syntax, and it must scope compact-memory/federated RAG as a competing memory-side amortization path.

citation-faithfulness-neighbor-comparison-2026-06-27-v1 positions citation-RAG query decomposition, academic citation prediction, faithfulness-aware context ranking, and generate-then-verify QA as neighboring retrieval/verification strategies. The same-window lexical faithfulness-ranking control faithfulness-ranking-control-final-window-2026-06-27-v1 makes 0 final-window suppressions at the train-selected threshold and changes support-oracle correctness by 0 rows, so simple lexical ranking does not replace trained repair/regeneration. The manuscript must not claim those retrieval/verification strategies as contributions; after the Qwen smoke, any generate-then-verify comparison must report its online verification cost separately.

Write-back memory is a close competing amortization family. On the versioned git-doc diagnostic, train-only write-back reaches 60.0% overall correctness but cannot answer eval updates, train write-back plus live snapshot reaches 100.0%, and a leaky eval-written memory answers 100.0% of stale-snapshot queries incorrectly. A full natural-benchmark WriteBack baseline remains scoped out until dated/private snapshots prevent final-window leakage into retrieval.

Evidence: `drag-like-rag-distillation-comparison-2026-06-26-v1`, `novelty-delta-matrix-2026-06-27-v1`, `longcite-style-citation-sft-comparison-2026-06-26-v1`, `faithful-context-qa-comparison-2026-06-27-v1`, `citation-grounding-memory-comparison-2026-06-27-v1`, `citation-faithfulness-neighbor-comparison-2026-06-27-v1`, `writeback-kb-amortization-scoped-exclusion-2026-06-26-v1`, `versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1`

## Limitations

Status: `draftable`

The current benchmark is a public dated arXiv/QASPER proxy rather than a private enterprise KB. The git-doc extension is not yet a full natural benchmark: versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1 finds 100.0% template question wording and 100.0% quoted-prefix leakage in the deterministic prototype. The v2 natural-question probe reduces those to 0.0% and 3.3% at a cost of $0.001607, but it is still question-authoring evidence rather than trained-student evidence. The support judge is model-based: a blind second-pass check reaches 76.2% exact agreement on deliberately hard rows, and judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2 finds 23.8% disagreements, mostly abstention-boundary reversals. judge-reliability-claim-gate-2026-06-27-v1 turns this into 10 priority adjudication rows, including 6 P0 abstention-boundary rows, and keeps human-validated correctness claims disallowed. The strongest completed results improve correctness by suppressing risky answers, so answer coverage and abstention-boundary disagreements remain central metrics.

The final trained-student claim is blocked until remote GPU execution produces Qwen 3B predictions, the grounded-correctness judge evaluates them, and final-claim-acceptance-matrix-2026-06-27-v1 turns green.

Evidence: `public arXiv proxy, not private KB`, `abstention-boundary-reliability-audit-2026-06-26-v1`, `judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2`, `judge-reliability-claim-gate-2026-06-27-v1`, `coverage/support tradeoff`, `remote GPU auth blocker`

## Result Tables

### Current support-aware scaffold results on dated future windows

Status: `complete`

| System | Overall judged correctness | Answer support | Answered |
| --- | ---: | ---: | ---: |
| Direct mini + citation repair | 71.8% | 64.1% | 117 |
| Cross-window candidate selector | 75.4% | 66.0% | 50 |
| Balanced zero-call risk gate | 79.9% | 70.0% | 90 |
| Risk gate + deterministic claim-entailment guard | 83.2% | 74.1% | 85 |
| Unsupported direct answers needing repair/regeneration | n/a | n/a | 12 |

### Related-work pressure points

Status: `complete`

| Baseline / gap | Metric | Note |
| --- | ---: | --- |
| DRAG-like direct mini RAG | 72.5% | Generic RAG student baseline |
| DRAG-like risk-gated scaffold | 79.7% | Improves support by suppressing answers |
| Lexical faithfulness ranking filter | 64.2% | 0 row support-oracle delta on final window |
| Citation syntax/support gap | 92.5% | Citation syntax can be far above support |

### Required trained-student result

Status: `blocked`

| Item | Value |
| --- | --- |
| Base model | Qwen/Qwen2.5-3B-Instruct |
| Pipeline status | failed_integrity_not_ready |
| Planned offline investment | $4.4672 |
| Loss-accounting contract | distillation-loss-accounting-2026-06-27-v1 |
| Estimated total after smoke + judge | $11.0510 |

## Submission Blockers

- `run_qwen3b_smoke` (blocked_by_remote_auth_or_credits): RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
- `run_post_smoke_pipeline_default` (waiting_for_predictions): node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100
- `run_paid_judge` (waiting_for_integrity_and_dry_judge): node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true
- `refresh_novelty_audit_before_submission` (required_before_completion): Refresh web/paper search at final submission time and update novelty-watchlist artifacts.

## Claims Allowed Now

- Support-aware local scaffolds can improve judged correctness over direct mini repair on dated QASPER/arXiv future windows, at a clear coverage cost.
- Citation formatting alone is insufficient: high inline citation compliance can coexist with very low judged answer support.
- A blind second-pass judge agrees with the original support judge on many hard unsupported-answer and sanity-check cases; a disagreement taxonomy and claim gate show remaining disagreements are mostly abstention-boundary reversals and require priority adjudication before uncaveated correctness claims.
- The current protocol has a trusted dated public-KB proxy and explicit budget accounting, but not yet the final trained Qwen 3B student result.
- The planned Qwen 3B smoke and judge have explicit break-even accounting under the $100 cap, conditioned on the missing quality gate.
- The final claim acceptance matrix is executable and currently blocks the trained-student claim until Qwen predictions, paid judging, provenance, Pareto update, and readiness gates pass.
- The Qwen outcome decision policy is pre-registered: a negative Qwen result must be reported before model escalation, a minimum-positive result is only partial amortization, and a strong-positive result still keeps judge/provenance/novelty caveats.
- Compact faithful-context QA is a close baseline family; current artifacts position against it but do not replace a true OCC-RAG-like baseline on the same update-heldout splits.
- Citation-grounding metrics and compact QA memories are close neighbors; current artifacts position against them but do not replace a true citation-grounding or compact-memory baseline on the final update-heldout window.
- Citation-RAG decomposition/ranking, academic citation prediction, and generate-then-verify systems are close neighbors; current artifacts position against them but do not replace a same-window retrieval-side or verifier-side baseline.
- The novelty delta matrix rejects seven broad claim families and leaves only one conditional core claim: model/scaffold-side amortized grounded QA over update-heldout domain KB states, pending Qwen 3B and paid grounded judging.
- A same-window lexical faithfulness-ranking filter is now measured as a zero-call retrieval-side control; it does not improve final-window support-oracle correctness at the train-selected threshold.
- An unsupported-answer repairability audit shows final-window direct failures mostly require answer repair/regeneration or abstention, not citation repair alone.

## Claims To Avoid Until Qwen 3B Completes

- A smaller trained model has been shown to preserve citation-grounded correctness.
- Joint-action SFT/DPO beats the existing scaffolds.
- The work is ready as a NeurIPS submission.
- The evaluation proves behavior over private enterprise KBs rather than a public dated proxy.
- The git-doc prototype is a natural versioned-KB benchmark rather than a deterministic snapshot diagnostic.
- The project is the first compact faithful-context-QA model, citation-grounding metric, compact-memory amortization method, citation-RAG decomposition/ranking method, academic citation prediction benchmark, generate-then-verify RAG method, or enterprise agentic RAG system.
