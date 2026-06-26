# Hard Grounded Research Novelty Replacement Candidates

This generated report lists verified or explicitly caveated related-work candidates for quarantined novelty-watchlist sources. It does not resolve overlap or allow final novelty claims; it gives reviewers concrete primary-source candidates to adjudicate.

## Summary

- Candidates ready: true
- Version: novelty-replacement-candidates-v1
- Date checked: 2026-06-26
- Quarantined sources: 4
- Candidates: 7
- Verified title-match candidates: 5
- Candidate title conflicts: 2
- Covered quarantined sources: 4
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| quarantined_sources_loaded | true | 4/4 quarantined source ids loaded |
| replacement_candidates_present | true | 5 verified replacement/supplement candidates for 4 quarantined sources |
| quarantined_sources_covered | true | faithjudge-2026=2; faithfulness-qa-2026=1; dora-2026=1; hierarag-2026=1 |
| final_claims_still_blocked | true | completion_claim_allowed=false; final_novelty_claim_allowed=false |

## Candidates

| Candidate | Primary-source status | Observed title | Replaces or supplements | URL | Audit role |
| --- | --- | --- | --- | --- | --- |
| faithfulness-qa-2026-verified | verified_title_match | Faithfulness-QA: A Counterfactual Entity Substitution Dataset for Training Context-Faithful RAG Models | faithfulness-qa-2026 | https://arxiv.org/abs/2604.25313 | Replace the mismatched Faithfulness-QA URL before claim revision or citation. |
| faitheval-2024 | verified_title_match | FaithEval: Can Your Language Model Stay Faithful to Context, Even If "The Moon is Made of Marshmallows" | faithjudge-2026 | https://arxiv.org/abs/2410.03727 | Use as a verified faithfulness/noisy-context adjacent benchmark if FaithJudge remains unverified. |
| confiqua-context-dpo-2024 | verified_title_match | Context-DPO: Aligning Language Models for Context-Faithfulness | faithjudge-2026 | https://arxiv.org/abs/2412.15280 | Use as a verified QA hallucination-control comparator for abstention and unsupported-answer claims. |
| legalbench-rag-2024 | verified_title_match | LegalBench-RAG: A Benchmark for Retrieval-Augmented Generation in the Legal Domain | dora-2026 | https://arxiv.org/abs/2408.10343 | Use as a verified legal-domain RAG comparator for domain-specific QA and source-grounded citation behavior. |
| rag-evaluation-survey-2025 | verified_title_match | Retrieval Augmented Generation Evaluation in the Era of Large Language Models: A Comprehensive Survey | hierarag-2026 | https://arxiv.org/abs/2504.14891 | Use as the verified generic RAG evaluation survey comparator before making taxonomy novelty claims. |
| finegrained-rag-2026 | candidate_title_conflict | Transfer Learning Across Fast- and Full-Simulation Domains in High-Energy Physics | hierarag-2026 | https://arxiv.org/abs/2605.07471 | Use as a verified generic/fine-grained RAG benchmark comparator before making taxonomy novelty claims. |
| grace-2026 | candidate_title_conflict | Classification of rotational zero modes in 2D micropolar solids | hierarag-2026 | https://arxiv.org/abs/2606.11418 | Use as a verified contextual-reasoning RAG comparator before finalizing hard-grounded reasoning novelty claims. |
