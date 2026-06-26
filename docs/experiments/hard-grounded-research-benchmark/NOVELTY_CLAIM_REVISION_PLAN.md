# Hard Grounded Research Novelty Claim Revision Plan

This generated plan maps unresolved related-work packets to manuscript claim revisions. It does not perform final novelty adjudication and does not allow completion claims.

## Summary

- Plan ready: true
- Version: novelty-claim-revision-plan-v1
- Date checked: 2026-06-26
- Revisions: 4
- High-risk revisions: 1
- Linked claims: 3
- Prohibited claims preserved: 3
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| packets_loaded | true | 4/4 source packets mapped to claim revisions |
| unresolved_sources_matched | true | 4/4 unresolved sources matched |
| claim_ids_exist | true | 9 claim links checked |
| final_claims_still_blocked | true | final_allowed=false; prohibited_claims=3 |

## Claim Revisions

| Packet | Source | Risk | Impacted claims | Manuscript action | Required disposition |
| --- | --- | --- | --- | --- | --- |
| novelty_source_review_01 | faithjudge-2026 | medium | taxonomy_scope_claim<br>novelty_completion_claim | Compare against faithfulness/citation work and keep the claim to conclusion-support overreach. | cite_and_narrow |
| novelty_source_review_02 | faithfulness-qa-2026 | medium | taxonomy_scope_claim<br>novelty_completion_claim | Compare against faithfulness/citation work and keep the claim to conclusion-support overreach. | cite_and_narrow |
| novelty_source_review_03 | dora-2026 | medium | taxonomy_scope_claim<br>hf_grounding_claim<br>novelty_completion_claim | Cite as domain RAG unless it explicitly tests authority hierarchy among conflicting sources. | cite_no_overlap_or_narrow |
| novelty_source_review_04 | hierarag-2026 | high | taxonomy_scope_claim<br>novelty_completion_claim | Cite as a broad RAG benchmarking review and remove any generic RAG benchmark novelty framing. | cite_and_narrow |
