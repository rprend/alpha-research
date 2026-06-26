# Hard Grounded Research Novelty Resolution Matrix

This generated matrix turns the live novelty watchlist into source-level related-work resolution tasks. It is not a final novelty audit and does not allow completion claims.

## Summary

- Matrix ready: true
- Version: novelty-resolution-matrix-v1
- Date checked: 2026-06-26
- Watchlist sources: 4
- Unresolved sources: 4
- High-risk sources: 1
- Registry sources: 22
- Prohibited claims preserved: 3
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| watchlist_loaded | true | 4/4 watchlist sources mapped |
| claim_impacts_mapped | true | 4/4 sources with claim impacts |
| final_audit_still_blocked | true | novelty status=refreshed_preliminary; completion_claim_allowed=false |
| prohibited_claims_preserved | true | 3 prohibited paper claims remain in the claim ledger |

## Source Resolution Matrix

| Source | Title | Risk | Pressure points | Impacted claims | Final-audit disposition |
| --- | --- | --- | --- | --- | --- |
| faithjudge-2026 | [FaithJudge: Evaluating Intrinsic and Extrinsic Hallucinations in Retrieval-Augmented Generation](https://arxiv.org/html/2606.21923v1) | medium | citation supports fact but not conclusion<br>evidence insufficiency / abstention | citation faithfulness evaluation<br>conclusion-support overreach | must_compare_before_final |
| faithfulness-qa-2026 | [Faithfulness-QA: Evaluating Long-Context Large Language Models Through Counterfactual Contexts](https://arxiv.org/html/2606.03962v1) | medium | entity disambiguation<br>stale-vs-current document conflicts<br>citation supports fact but not conclusion | citation faithfulness evaluation<br>conclusion-support overreach | must_compare_before_final |
| dora-2026 | [Benchmarking Domain-Specific Retrieval-Augmented Generation for Real-World Question Answering in Privacy Policies](https://arxiv.org/html/2601.10870v3) | medium | source authority conflicts<br>evidence insufficiency / abstention<br>large-corpus research QA | source authority conflicts<br>domain-specific RAG | must_compare_before_final |
| hierarag-2026 | [RAG Benchmarking: A Hierarchical Review of Methods and Evaluation Perspectives](https://arxiv.org/html/2606.12159v1) | high | generic RAG benchmark claim<br>benchmark taxonomy framing | generic RAG benchmark claim<br>benchmark taxonomy framing | must_cite_or_rule_out_before_final |

## Final Audit Requirements

| # | Requirement |
| --- | --- |
| 1 | Read or re-check every watchlist source immediately before final submission. |
| 2 | Move any directly overlapping source into generated/novelty-evidence.json before final novelty claims. |
| 3 | Rewrite paper claims if a watchlist source covers a proposed hard-grounded category as a standalone contribution. |
| 4 | Keep completion_claim_allowed false until review, scale, and final novelty gates all pass. |
