# Selector Coverage Confirmation Audit

Generated: 2026-06-28T12:16:23.767Z

This is a zero-call held-out selector coverage audit. It uses no final-window labels for training, tuning, or evaluation.

## Summary

- Selector-slice rows: 19
- Slices: existing_validation, frontier_pool_validation, qwen_reference_validation
- Selected-hybrid broader frontier coverage pairs: 0
- Best frontier selector: hard_negative_baseline (0.904762)

## Coverage Rows

- existing_validation / d262_pool_pairwise: 20/24 correct, accuracy 0.833333, uses=allowed_validation
- existing_validation / d262_constrained: 19/24 correct, accuracy 0.791667, uses=allowed_validation
- existing_validation / d272_boundary_only: 16/24 correct, accuracy 0.666667, uses=allowed_validation
- existing_validation / d272_selected_hybrid: 20/24 correct, accuracy 0.833333, uses=allowed_validation
- existing_validation / qwen_label_ranker: 15/24 correct, accuracy 0.625, uses=allowed_validation
- existing_validation / qwen_contrast_verifier: 17/24 correct, accuracy 0.708333, uses=allowed_validation
- existing_validation / claim_nli_support_verifier: 20/24 correct, accuracy 0.833333, uses=allowed_validation
- existing_validation / hard_negative_baseline: 19/24 correct, accuracy 0.791667, uses=allowed_validation
- existing_validation / hard_negative_hard_weighted: 16/24 correct, accuracy 0.666667, uses=allowed_validation
- existing_validation / hard_negative_risk_penalized: 19/24 correct, accuracy 0.791667, uses=allowed_validation
- existing_validation / overexpansion_aware: 14/24 correct, accuracy 0.583333, uses=allowed_validation
- existing_validation / calibrated_overexpansion_hybrid: 19/24 correct, accuracy 0.791667, uses=allowed_validation
- existing_validation / conditional_overexpansion_gate: 19/24 correct, accuracy 0.791667, uses=allowed_validation
- frontier_pool_validation / qwen_contrast_verifier: 18/21 correct, accuracy 0.857143, uses=allowed_nonfinal_frontier_supervision
- frontier_pool_validation / claim_nli_support_verifier: 17/21 correct, accuracy 0.809524, uses=allowed_nonfinal_frontier_supervision
- frontier_pool_validation / hard_negative_baseline: 19/21 correct, accuracy 0.904762, uses=allowed_nonfinal_frontier_supervision
- frontier_pool_validation / hard_negative_hard_weighted: 19/21 correct, accuracy 0.904762, uses=allowed_nonfinal_frontier_supervision
- frontier_pool_validation / hard_negative_risk_penalized: 19/21 correct, accuracy 0.904762, uses=allowed_nonfinal_frontier_supervision
- qwen_reference_validation / qwen_contrast_verifier: 4/5 correct, accuracy 0.8, uses=allowed_nonfinal_support_supervision

## Diagnosis

- Primary finding: selected_hybrid_broader_coverage_missing
- Interpretation: The D276 selected-hybrid gain is real on the clean validation slice but lacks direct frontier-pool validation coverage; broader frontier results support claim/NLI/contrast feature families, not the exact selected-hybrid policy.

## Decision

- Promote selected hybrid now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Run zero-call frontier replay next: yes
- Reason: D276's selected-hybrid gain has no direct frontier-pool validation coverage; broader frontier evidence supports claim/NLI/contrast features but not the exact D272 hybrid policy.
- Next step: Recompute D262, boundary-only, and selected-hybrid scores on frontier-pool validation pairs with existing local features, or mine a larger clean pairwise packet where all candidate selectors have comparable coverage.
