# Hard Grounded Research Novelty Finalization Preflight

This generated preflight defines the work required before the novelty audit can become final. It does not perform the final literature adjudication and does not allow completion claims.

## Summary

- Preflight ready: true
- Version: novelty-finalization-preflight-v1
- Date checked: 2026-06-26
- Watchlist sources: 4
- Unresolved sources: 4
- High-risk unresolved sources: 1
- Novelty release blockers: 1
- Non-novelty release blockers: 0
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| preliminary_audit_preserved | true | status=refreshed_preliminary; completion_claim_allowed=false |
| watchlist_resolution_inputs_loaded | true | 4/4 watchlist sources mapped |
| unresolved_sources_identified | true | 4 unresolved sources; 1 high-risk unresolved sources |
| claim_boundaries_preserved | true | 5 evidence-registry prohibited claims; 1 ledger prohibited claims |
| release_blocks_only_final_novelty_claims | true | 1 release blockers; 1 novelty blockers; 0 non-novelty blockers |

## Finalization Requirements

| # | Requirement |
| --- | --- |
| 1 | Re-run the live related-work search immediately before submission and record the dated query provenance. |
| 2 | Read every unresolved watchlist source and either add it to the evidence registry or document why it is out of scope. |
| 3 | Rewrite manuscript novelty language for any source that covers an asserted category, metric, or claim boundary. |
| 4 | Regenerate the novelty audit, novelty evidence registry, paper claim ledger, paper draft, release gate, and version manifest after source resolution. |
| 5 | Keep final novelty and completion claims blocked until live related-work adjudication resolves the remaining novelty_audit_final gate. |

## Blocking Conditions

| Condition | Severity | Current state | Required action |
| --- | --- | --- | --- |
| source:faithjudge-2026 | medium | Confirm whether FaithJudge evaluates conclusion-level support or only retrieved-context faithfulness and hallucination detection. | Keep citation novelty limited to conclusion-support overreach rather than span attribution or hallucination detection. |
| source:faithfulness-qa-2026 | medium | Check whether counterfactual entity substitution overlaps the proposed same-name entity and stale/current evidence categories. | Keep citation novelty limited to conclusion-support overreach rather than span attribution or hallucination detection. |
| source:dora-2026 | medium | Verify whether domain-specific legal/privacy RAG covers authority hierarchy or only domain-grounded retrieval and answer correctness. | Confirm whether authority hierarchy is actually benchmarked; otherwise cite as domain RAG rather than authority-conflict coverage. |
| source:hierarag-2026 | high | Use the review taxonomy to ensure the paper does not claim generic RAG benchmark novelty and instead names the hard-grounded failure taxonomy contribution. | Do not claim generic RAG benchmark novelty; frame the contribution as a hard-grounded failure taxonomy and executable review harness. |
| release:novelty_audit_final | high | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
