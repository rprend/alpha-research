# Hard Grounded Research Novelty Replacement Candidates

This generated report lists verified or explicitly caveated related-work candidates for quarantined novelty-watchlist sources. It does not resolve overlap or allow final novelty claims; it gives reviewers concrete primary-source candidates to adjudicate.

## Summary

- Candidates ready: true
- Version: novelty-replacement-candidates-v1
- Date checked: 2026-06-26
- Quarantined sources: 4
- Candidates: 6
- Verified title-match candidates: 5
- Candidate title conflicts: 1
- Covered quarantined sources: 4
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| quarantined_sources_loaded | true | 4/4 quarantined source ids loaded |
| replacement_candidates_present | true | 6 replacement/supplement candidates for 4 quarantined sources |
| quarantined_sources_covered | true | faithjudge-2026=2; faithfulness-qa-2026=1; dora-2026=1; hierarag-2026=2 |
| final_claims_still_blocked | true | completion_claim_allowed=false; final_novelty_claim_allowed=false |

## Candidates

| Candidate | Primary-source status | Replaces or supplements | URL | Audit role |
| --- | --- | --- | --- | --- |
| faithfulness-qa-2026-verified | verified_title_match | faithfulness-qa-2026 | https://arxiv.org/abs/2604.25313 | Replace the mismatched Faithfulness-QA URL before claim revision or citation. |
| faitheval-2024 | verified_title_match | faithjudge-2026 | https://arxiv.org/abs/2410.03727 | Use as a verified faithfulness/noisy-context adjacent benchmark if FaithJudge remains unverified. |
| confiqua-context-dpo-2024 | verified_title_match | faithjudge-2026 | https://arxiv.org/abs/2408.10343 | Use as a verified QA hallucination-control comparator for abstention and unsupported-answer claims. |
| legalbench-rag-2024 | candidate_title_conflict | dora-2026 | https://arxiv.org/abs/2408.10343 | Use only after primary-source URL correction; current URL collides with ConFiQA search result and must not be cited as verified. |
| finegrained-rag-2026 | verified_title_match | hierarag-2026 | https://arxiv.org/abs/2605.07471 | Use as a verified generic/fine-grained RAG benchmark comparator before making taxonomy novelty claims. |
| grace-2026 | verified_title_match | hierarag-2026 | https://arxiv.org/abs/2606.11418 | Use as a verified contextual-reasoning RAG comparator before finalizing hard-grounded reasoning novelty claims. |
