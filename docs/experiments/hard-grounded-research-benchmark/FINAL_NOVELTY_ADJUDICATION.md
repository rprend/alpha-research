# Hard Grounded Research Final Novelty Adjudication

This generated artifact converts the June 2026 novelty refresh into source-by-source claim boundaries. It is an input to the final novelty audit, not a completion claim.

## Summary

- Adjudication ready: true
- Version: final-novelty-adjudication-v1
- Date checked: 2026-06-26
- Refreshed sources: 11
- Replacement candidate sources: 7
- Adjudication rows: 18
- High-overlap rows: 9
- Final novelty claim allowed: false
- Completion claim allowed: false

## Allowed Contribution Boundary

Hard Grounded Research contributes an HF-derived, script-reproducible benchmark suite for large-corpus research QA that combines multi-hop synthesis, stale/current conflicts, lifecycle changes, table-text reasoning, authority conflicts, insufficiency/abstention, citation-overreach, entity disambiguation, as-of-date temporal reasoning, and cross-document contradiction under common evidence contracts.

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_refreshed_sources_adjudicated | true | 11/11 refreshed sources adjudicated |
| all_replacement_sources_carried_forward | true | 7/7 replacement-candidate rows carried forward |
| high_overlap_sources_force_claim_narrowing | true | 9 high-overlap rows require cite/narrow/compare action |
| completion_claim_still_blocked | true | final_allowed=false; prohibited_claims=1 |

## Source Adjudications

| Source | Overlap scope | Disposition | Claim action | URL |
| --- | --- | --- | --- | --- |
| conflictrag-2025 | high | cite_and_narrow | Do not claim novelty for conflict detection or conflict resolution; cite as adjacent contradiction/conflict RAG work. | https://arxiv.org/abs/2605.17301 |
| inter-context-conflicts-2025 | high | cite_and_narrow | Treat conflicting-evidence RAG as prior work and reserve novelty for explicit research-QA evidence contracts across multiple failure categories. | https://arxiv.org/abs/2504.13079 |
| citerag-2026 | medium | cite_and_narrow | Separate academic citation prediction from conclusion-support-overreach scoring; cite for citation-related overlap. | https://arxiv.org/abs/2601.14949 |
| sufficient-context-2025 | medium | cite_and_narrow | Do not claim abstention or context sufficiency as novel; claim only the combined insufficiency/citation-overreach/research-QA packaging. | https://arxiv.org/abs/2411.06037 |
| mudabench-2026 | high | cite_and_narrow | Cite multi-document analytical QA as close prior work; narrow novelty to hard-grounded failure taxonomy and HF-derived provenance. | https://arxiv.org/abs/2604.22239 |
| globalqa-2025 | medium | cite_background | Use as large-scale/global QA background and avoid broad large-corpus QA novelty claims. | https://arxiv.org/abs/2510.26205 |
| ragchecker-2024 | medium | cite_background | Cite diagnostic RAG evaluation; keep this benchmark claim focused on dataset/task construction rather than metric novelty. | https://arxiv.org/abs/2408.08067 |
| ragbench-2024 | medium | cite_background | Cite explainable RAG benchmarking as background and avoid generic RAG benchmark novelty claims. | https://arxiv.org/abs/2407.11005 |
| lit-ragbench-2026 | high | must_cite_and_narrow | Do not claim table-text RAG or abstention benchmark novelty; position table-text as one category within the unified hard-grounded suite. | https://arxiv.org/abs/2603.06198 |
| forcebench-2026 | high | must_cite_and_narrow | Do not claim evidence-force or citation-worthiness novelty; claim conclusion-support-overreach only as part of the cross-category research-QA benchmark. | https://arxiv.org/abs/2605.28044 |
| t2-ragbench-2026 | high | must_cite_and_narrow | Do not claim text-table RAG novelty; cite as direct table-text prior work and keep novelty at the combined suite level. | https://aclanthology.org/2026.eacl-main.121/ |
| faithfulness-qa-2026-verified | medium | cite_and_narrow | Position counterfactual-context faithfulness as adjacent to entity/state confusion, while keeping hard-grounded novelty limited to multi-source research evidence and conclusion-support failures. | https://arxiv.org/abs/2604.25313 |
| faitheval-2024 | medium | cite_and_narrow | Cite noisy-context faithfulness work and reserve novelty for the combined evidence sufficiency, source authority, and citation-overreach taxonomy. | https://arxiv.org/abs/2410.03727 |
| confiqua-context-dpo-2024 | medium | cite_and_narrow | Cite context-faithfulness alignment work and avoid claiming novelty for generic hallucination control in QA. | https://arxiv.org/abs/2412.15280 |
| legalbench-rag-2024 | medium | cite_no_overlap_or_narrow | Cite LegalBench-RAG as domain-specific legal RAG unless its source structure directly tests authority hierarchy or cross-document contradiction. | https://arxiv.org/abs/2408.10343 |
| rag-evaluation-survey-2025 | high | must_cite_and_remove_generic_rag_novelty | Cite the RAG evaluation survey as broad evaluation/taxonomy prior work and keep novelty limited to hard-grounded research-QA failure categories and HF-derived item construction. | https://arxiv.org/abs/2504.14891 |
| finegrained-rag-2026 | high | must_cite_and_remove_generic_rag_novelty | Remove any generic fine-grained RAG benchmarking novelty claim; limit novelty to the hard-grounded research-QA construct and review/gold workflow. | https://arxiv.org/abs/2605.07471 |
| grace-2026 | high | must_compare_before_final | Compare GRACE against the multi-hop, contradiction, and temporal categories before claiming hard-grounded reasoning coverage. | https://arxiv.org/abs/2606.11418 |

## Prohibited Claims

| # | Claim |
| --- | --- |
| 1 | First RAG benchmark. |
| 2 | First table-text RAG benchmark. |
| 3 | First evidence insufficiency or abstention benchmark. |
| 4 | First citation-faithfulness or evidence-force benchmark. |
| 5 | First contradiction/conflict RAG benchmark. |
| 6 | Novelty for any single category independent of the unified hard-grounded research-QA suite. |

## Required Manuscript Moves

| # | Move |
| --- | --- |
| 1 | Cite or contrast every high-overlap source in the final related-work section. |
| 2 | State that individual subproblems are crowded and the contribution is the combined HF-derived research-QA stress suite. |
| 3 | Keep human review framed as optional audit rather than primary data generation. |
| 4 | Keep final novelty and completion claims blocked until the final novelty audit incorporates this adjudication. |
