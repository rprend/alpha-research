# Final Claim Acceptance Matrix

Generated: 2026-06-27T03:59:25.077Z

Status: `final_claim_blocked`

| Requirement | Status | Claim Dimension |
| --- | --- | --- |
| trained_student_predictions | fail | A trained Qwen 3B joint-action student must produce final-window predictions. |
| grounded_correctness_judge | fail | The trained student must have paid grounded-correctness judgments. |
| answer_support_preserved | fail | Answer support must beat the direct baseline and be reported against the 70% coverage frontier. |
| coverage_not_collapsed | fail | Answer rate must stay at or above 70% before claiming support-preserving distillation. |
| citation_support_not_syntax | fail | Citation existence, support/relevance, and temporal/update validity must be separated from inline citation syntax. |
| temporal_update_validity | fail | The result must be on the final dated/update-heldout window and must not use stale/final-window leakage. |
| amortized_cost_accounted | fail | Total OpenAI plus external compute spend must stay under $100, and Qwen break-even must be recomputed with actual spend. |
| remote_reproducibility | fail | Remote backend, environment, smoke manifest, and provenance must be recorded before judging. |
| judge_reliability_claim_bounded | pass | Judge disagreement and abstention-boundary instability must be caveated unless human/stronger adjudication closes it. |
| novelty_claims_narrowed | pass | The final claim must avoid generic RAG distillation, citation SFT, dynamic QA, online agentic RAG, compact faithful-context QA, citation grounding, retrieval-side faithfulness, and memory/index amortization. |
| citation_faithfulness_neighbors_positioned | pass | The final claim must position QDRAG/Faithful in Steps, CiteRAG, faithfulness-aware context ranking, and generate-then-verify as neighboring retrieval/verification strategies rather than the paper contribution. |
| paper_readiness_gate_green | fail | The paper-readiness gate must be green before any NeurIPS-ready claim. |

## Blocking Failures

- trained_student_predictions: A trained Qwen 3B joint-action student must produce final-window predictions.
- grounded_correctness_judge: The trained student must have paid grounded-correctness judgments.
- answer_support_preserved: Answer support must beat the direct baseline and be reported against the 70% coverage frontier.
- coverage_not_collapsed: Answer rate must stay at or above 70% before claiming support-preserving distillation.
- citation_support_not_syntax: Citation existence, support/relevance, and temporal/update validity must be separated from inline citation syntax.
- temporal_update_validity: The result must be on the final dated/update-heldout window and must not use stale/final-window leakage.
- amortized_cost_accounted: Total OpenAI plus external compute spend must stay under $100, and Qwen break-even must be recomputed with actual spend.
- remote_reproducibility: Remote backend, environment, smoke manifest, and provenance must be recorded before judging.
- paper_readiness_gate_green: The paper-readiness gate must be green before any NeurIPS-ready claim.

## Allowed Claim Now

The project has a fail-closed acceptance matrix and scoped related-work positioning, but it cannot claim support-preserving amortized distillation until the trained Qwen 3B smoke, paid judge, provenance, Pareto, and final readiness gates pass.

## Prohibited Claims Now

- A trained smaller model preserves citation-grounded correctness.
- Citation syntax is sufficient evidence of grounding.
- The project beats compact faithful-context QA, citation-grounding metrics, or compact-memory RAG baselines.
- The current result is NeurIPS-ready.

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
