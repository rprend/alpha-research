# Hard Grounded Research Novelty Watchlist

This generated watchlist records live-search related work that must be resolved before the novelty audit can become final. It is a surveillance artifact, not a completion claim.

## Summary

- Watchlist ready: true
- Version: novelty-watchlist-v1
- Date checked: 2026-06-26
- Watchlist sources: 4
- Unresolved against existing registry: 4
- High-risk sources: 1
- Existing registry sources: 22
- Novelty audit status: refreshed_preliminary
- Completion claim allowed: false

## Watchlist Sources

| ID | Source | Year | Risk | Pressure points | Required resolution |
| --- | --- | --- | --- | --- | --- |
| faithjudge-2026 | [FaithJudge: Evaluating Intrinsic and Extrinsic Hallucinations in Retrieval-Augmented Generation](https://arxiv.org/html/2606.21923v1) | 2026 | medium | citation supports fact but not conclusion<br>evidence insufficiency / abstention | Confirm whether FaithJudge evaluates conclusion-level support or only retrieved-context faithfulness and hallucination detection. |
| faithfulness-qa-2026 | [Faithfulness-QA: Evaluating Long-Context Large Language Models Through Counterfactual Contexts](https://arxiv.org/html/2606.03962v1) | 2026 | medium | entity disambiguation<br>stale-vs-current document conflicts<br>citation supports fact but not conclusion | Check whether counterfactual entity substitution overlaps the proposed same-name entity and stale/current evidence categories. |
| dora-2026 | [Benchmarking Domain-Specific Retrieval-Augmented Generation for Real-World Question Answering in Privacy Policies](https://arxiv.org/html/2601.10870v3) | 2026 | medium | source authority conflicts<br>evidence insufficiency / abstention<br>large-corpus research QA | Verify whether domain-specific legal/privacy RAG covers authority hierarchy or only domain-grounded retrieval and answer correctness. |
| hierarag-2026 | [RAG Benchmarking: A Hierarchical Review of Methods and Evaluation Perspectives](https://arxiv.org/html/2606.12159v1) | 2026 | high | generic RAG benchmark claim<br>benchmark taxonomy framing | Use the review taxonomy to ensure the paper does not claim generic RAG benchmark novelty and instead names the hard-grounded failure taxonomy contribution. |

## Final Audit Requirements

| # | Requirement |
| --- | --- |
| 1 | Decide whether each watchlist source is already covered by novelty-evidence or must be added to the final related-work table. |
| 2 | Update claim boundaries if any watchlist source directly covers document lifecycle, source authority, citation-overreach, or unified hard-grounded taxonomy claims. |
| 3 | Keep completion_claim_allowed false until human review, category scale, and final novelty audit all pass. |
