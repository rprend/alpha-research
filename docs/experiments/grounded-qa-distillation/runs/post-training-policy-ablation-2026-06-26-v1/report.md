# Post-Training Data Policy Ablation

Generated: 2026-06-26T20:14:05.663Z

Status: `historical_judged_ablation_not_final_qwen3b_result`

## Aggregate Policy Families

| Family | Windows | Examples | Answer rate | Answer support | Abstention support | Overall judged correctness | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| direct_compact_rag_student_with_citation_repair | 5 | 389 | 77.6% | 66.2% | 100.0% | 73.8% | Strongest coverage baseline; it answers many rows but leaves too many unsupported answers for the target paper claim. |
| claim_pruned_rubric_labels | 2 | 160 | 73.8% | 62.7% | 100.0% | 72.5% | Does not clearly beat direct compact-RAG labels on the judged 0-160 slice; claim pruning alone is insufficient. |
| claim_pruner_mini_labels | 2 | 160 | 75.6% | 70.2% | 100.0% | 77.5% | Improves the second 80-row block, but available evidence is too narrow to support the final paper claim by itself. |
| support_risk_gated_labels | 3 | 229 | 57.6% | 74.2% | 94.8% | 83.0% | Best existing support/correctness aggregate, but gains are coupled to lower answer coverage and must be compared against Qwen3B joint-action training. |
| local_span_or_tiny_sft_scaffolds | 2 | 138 | 66.7% | 13.0% | 95.7% | 40.6% | Confirms tiny/local distillation can learn surface citation behavior but not reliable support; this motivates using a stronger Qwen3B joint-action student. |

## Source Windows

| Family | Window | Judge run | Present | Examples | Answer support | Overall judged correctness |
| --- | --- | --- | --- | ---: | ---: | ---: |
| direct_compact_rag_student_with_citation_repair | 0-80 | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1` | yes | 80 | 65.1% | 72.5% |
| direct_compact_rag_student_with_citation_repair | 80-160 | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1` | yes | 80 | 70.7% | 78.8% |
| direct_compact_rag_student_with_citation_repair | 160-240 | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1` | yes | 80 | 67.2% | 73.8% |
| direct_compact_rag_student_with_citation_repair | 240-320 | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1` | yes | 80 | 64.1% | 71.3% |
| direct_compact_rag_student_with_citation_repair | 320-389 | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1` | yes | 69 | 64.2% | 72.5% |
| claim_pruned_rubric_labels | 0-80 | `openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-0-80-v1` | yes | 80 | 63.9% | 72.5% |
| claim_pruned_rubric_labels | 80-160 | `openai-judge-gpt4o-citation-contract-repair-claim-pruned-rubric-extended-future-holdout-80-160-v1` | yes | 80 | 61.4% | 72.5% |
| claim_pruner_mini_labels | 0-80 | `openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1` | yes | 80 | 68.3% | 75.0% |
| claim_pruner_mini_labels | 80-160 | `openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1` | yes | 80 | 72.4% | 80.0% |
| support_risk_gated_labels | 160-240 | `openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` | yes | 80 | 83.3% | 88.8% |
| support_risk_gated_labels | 240-320 | `openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1` | yes | 80 | 69.6% | 80.0% |
| support_risk_gated_labels | 320-389 | `openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1` | yes | 69 | 70.5% | 79.7% |
| local_span_or_tiny_sft_scaffolds | 321-389_span | `openai-judge-gpt4o-temporal-span-scaffold-mini-negative-161-320-to-321-389-v1` | yes | 69 | 19.2% | 39.1% |
| local_span_or_tiny_sft_scaffolds | 321-389_qwen05b | `openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1` | yes | 69 | 5.0% | 42.0% |

## Conclusions

- Direct compact-RAG/citation-repair labels are a necessary baseline but do not preserve enough support.
- Claim pruning alone is not a robust paper-worthy data-construction answer.
- Support-risk gated labels are the strongest existing direction, but they trade away answer coverage.
- Tiny/local SFT anchors are too weak to serve as the final smaller-model result despite good citation formatting.
- The Qwen3B joint-action run should prioritize support-risk contrast and answer/abstain joint supervision, then report coverage alongside support.

## Qwen3B Implication

- Required design: Use joint-action SFT/DPO examples that encode answer synthesis, citation placement, abstention, and support-risk contrast rather than generic citation-only SFT.
- Acceptance metric: The trained Qwen3B student must improve support/correctness over direct compact-RAG labels without collapsing answer coverage to the zero-call gate floor.

Still missing:
- Qwen3B joint-action smoke predictions.
- Prediction integrity gate ready_for_paid_judge.
- Paid grounded-correctness judge on the final future window.
- Pareto table update including Qwen3B.

## Budget

No new OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $5.8931.
