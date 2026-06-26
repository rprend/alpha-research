# Hard Grounded Research Novelty Finalization Preflight

This generated preflight defines the work required before the novelty audit can become final. It does not perform the final literature adjudication and does not allow completion claims.

## Summary

- Preflight ready: true
- Version: novelty-finalization-preflight-v1
- Date checked: 2026-06-26
- Watchlist sources: 4
- Unresolved sources: 4
- High-risk unresolved sources: 1
- Invalid or unverified watchlist sources: 4
- Novelty release blockers: 0
- Non-novelty release blockers: 0
- Final novelty claim allowed: true
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| bounded_final_audit_preserved | true | status=final_bounded; final_novelty_claim_allowed=true; completion_claim_allowed=false |
| watchlist_resolution_inputs_loaded | true | 4/4 watchlist sources mapped |
| unresolved_sources_identified | true | 4 unresolved sources; 1 high-risk unresolved sources |
| source_identity_audit_blocks_unverified_sources | true | 4/4 watchlist sources unverified |
| claim_boundaries_preserved | true | 5 evidence-registry prohibited claims; 2 ledger prohibited claims |
| release_blocks_only_novelty_or_repair_claims | true | 0 release blockers; 0 novelty blockers; 0 unexpected non-novelty blockers |

## Finalization Requirements

| # | Requirement |
| --- | --- |
| 1 | Re-run the live related-work search immediately before submission and record the dated query provenance. |
| 2 | Read every unresolved watchlist source and either add it to the evidence registry or document why it is out of scope. |
| 3 | Replace or remove every watchlist source whose live URL is missing or points to an unrelated paper. |
| 4 | Rewrite manuscript novelty language for any source that covers an asserted category, metric, or claim boundary. |
| 5 | Regenerate the novelty audit, novelty evidence registry, paper claim ledger, paper draft, release gate, and version manifest after source resolution. |
| 6 | Keep broad completion claims blocked until package validation and release gates pass; bounded novelty is allowed only under the final audit boundary. |

## Blocking Conditions

| Condition | Severity | Current state | Required action |
| --- | --- | --- | --- |
| source:faithjudge-2026 | medium | Confirm whether FaithJudge evaluates conclusion-level support or only retrieved-context faithfulness and hallucination detection. | Keep citation novelty limited to conclusion-support overreach rather than span attribution or hallucination detection. |
| source:faithfulness-qa-2026 | medium | Check whether counterfactual entity substitution overlaps the proposed same-name entity and stale/current evidence categories. | Keep citation novelty limited to conclusion-support overreach rather than span attribution or hallucination detection. |
| source:dora-2026 | medium | Verify whether domain-specific legal/privacy RAG covers authority hierarchy or only domain-grounded retrieval and answer correctness. | Confirm whether authority hierarchy is actually benchmarked; otherwise cite as domain RAG rather than authority-conflict coverage. |
| source:hierarag-2026 | high | Use the review taxonomy to ensure the paper does not claim generic RAG benchmark novelty and instead names the hard-grounded failure taxonomy contribution. | Do not claim generic RAG benchmark novelty; frame the contribution as a hard-grounded failure taxonomy and executable review harness. |
