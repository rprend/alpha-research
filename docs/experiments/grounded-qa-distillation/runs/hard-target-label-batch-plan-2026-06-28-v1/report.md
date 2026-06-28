# Hard Target Label Batch Plan

Generated: 2026-06-28T16:44:08.948Z

Status: `hard_final_like_batch_ready_below_budget`

This is a planning artifact only. It makes no API calls and launches no compute.

## Why

D309 labels were stable, D310 scalar selectors anti-transferred, and D311 local text verification improved final pair transfer but failed leave-one-out reliability. This plan targets harder non-final rows that better resemble D311 final errors.

## Batch

- Primary requests: 96
- Calibration duplicate requests: 12
- Total requests: 108
- Candidate rows considered: 199
- Selected by source: {"minimal_span_validation":10,"minimal_span_train":28,"nonfinal_margin_train":28,"qwen_frontier_validation":2,"support_ranker_validation":6,"support_ranker_train":22}
- Selected tags: {"list_or_entity_scope":75,"minimal_span_contrast":38,"numeric_target":85,"overexpanded_or_equal_rejected":41,"similar_answer_length":43,"similar_citation_count":87,"similar_claim_count":81,"unsupported_claim_available":91,"cross_family_pair":47}

## Cost

- Model: gpt-4o-mini
- Estimated cost: $0.0543
- Estimated cost with 2x safety: $0.1085
- Keeps total under $100: yes

## Decision

- Run label batch now: no
- Ask for secret now: no
- Launch GPU now: no
- Reason: The plan finds 96 leakage-safe hard non-final rows matching D311 final-error strata at an estimated $0.0543 before safety margin.
- Next step: Run this harder final-like label batch only if the plan validates; then retrain the local target verifier before considering Prime/GPU.
