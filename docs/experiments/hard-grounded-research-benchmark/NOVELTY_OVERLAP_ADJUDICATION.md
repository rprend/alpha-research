# Hard Grounded Research Novelty Overlap Adjudication

This generated worksheet maps verified replacement candidates to claim impacts, required boundary language, and reviewer questions. It does not resolve overlap and does not allow final novelty claims.

## Summary

- Adjudication ready: true
- Version: novelty-overlap-adjudication-v1
- Date checked: 2026-06-26
- Candidates: 7
- High-overlap candidates: 3
- Medium-overlap candidates: 4
- Pending dispositions: 7
- Affected claims: 3
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| verified_candidates_loaded | true | 7/7 replacement candidates loaded |
| all_candidates_mapped | true | 7/7 candidates mapped to overlap scope |
| claim_ids_exist | true | 15 claim links checked |
| final_claims_still_blocked | true | final_allowed=false; completion_allowed=false |

## Adjudication Rows

| Candidate | Overlap scope | Affected claims | Required decision | Final disposition |
| --- | --- | --- | --- | --- |
| faithfulness-qa-2026-verified | medium | taxonomy_scope_claim<br>novelty_completion_claim | cite_and_narrow | pending_reviewer_overlap_adjudication |
| faitheval-2024 | medium | taxonomy_scope_claim<br>novelty_completion_claim | cite_and_narrow | pending_reviewer_overlap_adjudication |
| confiqua-context-dpo-2024 | medium | taxonomy_scope_claim<br>novelty_completion_claim | cite_and_narrow | pending_reviewer_overlap_adjudication |
| legalbench-rag-2024 | medium | taxonomy_scope_claim<br>hf_grounding_claim<br>novelty_completion_claim | cite_no_overlap_or_narrow | pending_reviewer_overlap_adjudication |
| rag-evaluation-survey-2025 | high | taxonomy_scope_claim<br>novelty_completion_claim | must_cite_and_remove_generic_rag_novelty | pending_reviewer_overlap_adjudication |
| finegrained-rag-2026 | high | taxonomy_scope_claim<br>novelty_completion_claim | must_cite_and_remove_generic_rag_novelty | pending_reviewer_overlap_adjudication |
| grace-2026 | high | taxonomy_scope_claim<br>novelty_completion_claim | must_compare_before_final | pending_reviewer_overlap_adjudication |

## Reviewer Questions

| Candidate | # | Question |
| --- | --- | --- |
| faithfulness-qa-2026-verified | 1 | Does Faithfulness-QA test document-state or entity confusion in a way that covers stale-vs-current and entity-disambiguation categories? |
| faithfulness-qa-2026-verified | 2 | Does its metric evaluate answer-level conclusion support, or context-faithfulness under counterfactual substitution? |
| faitheval-2024 | 1 | Does FaithEval include abstention or insufficiency scoring that overlaps the evidence-insufficiency category? |
| faitheval-2024 | 2 | Does noisy-context faithfulness cover citation-support-overreach, or only context-grounded answer faithfulness? |
| confiqua-context-dpo-2024 | 1 | Does Context-DPO include benchmark tasks or only alignment data/methods for context faithfulness? |
| confiqua-context-dpo-2024 | 2 | Does it require source-level citation support or only context-consistent generation? |
| legalbench-rag-2024 | 1 | Does LegalBench-RAG encode legal source authority conflicts or only legal retrieval/answering? |
| legalbench-rag-2024 | 2 | Does its evaluation separate citation support for facts from support for conclusions? |
| rag-evaluation-survey-2025 | 1 | Which RAG evaluation dimensions in the survey overlap with the hard-grounded category taxonomy? |
| rag-evaluation-survey-2025 | 2 | Does the survey identify any benchmark that already combines lifecycle, authority, temporal, insufficiency, citation-overreach, entity, table/text, multi-hop, and contradiction tasks? |
| finegrained-rag-2026 | 1 | Does the fine-grained RAG taxonomy subsume any hard-grounded categories? |
| finegrained-rag-2026 | 2 | Which error-analysis claims must cite this work before submission? |
| grace-2026 | 1 | Does GRACE directly cover temporal/as-of-date reasoning or cross-document contradiction? |
| grace-2026 | 2 | Does it evaluate large-corpus research QA evidence sufficiency and source authority, or contextual reasoning in RAG more broadly? |
