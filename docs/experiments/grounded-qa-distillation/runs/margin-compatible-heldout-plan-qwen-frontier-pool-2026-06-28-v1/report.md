# Margin-Compatible Heldout Plan

This is a zero-call margin-compatible heldout plan for the D280 Qwen pairwise-margin selector.

## Finding

- Final window: 69 examples (44 answerable, 25 abstain).
- Existing scaffold pool: 69 examples have direct/risk/guard candidates.
- Zero-call scaffold contrasts: 36 potential supported-vs-unsupported contrasts.
- D280-compatible now: no.

The saved 321-389 outputs can support a scaffold-level audit, but they do not include the pairwise-margin rows and claim-NLI scores needed to validate D280.

## Budget

- Actual spend before plan: $13.5076056.
- Remaining budget: $86.4923944.
- Observed pool-adjudication cost: $0.00530975 per pool from 20 calls.
- Conservative 2x estimate for 18 future pools: $0.191152.
- Projected total after that conservative batch: $13.698758.

## Decision

- Treat 321-389 as D280 validation now: no.
- Build margin-compatible packet next: yes.
- Buy OpenAI labels now: no.
- Launch GPU now: no.

## Source Inventory

- temporal_321_389_scaffold_candidates: 69 units; D280-compatible now = false; Contains selected scaffold outputs and inherited correctness, not full Qwen pairwise-margin rows with claim-NLI scores.
- direct_risk_guard_judged_pool: 207 units; D280-compatible now = false; Can derive scaffold-level supported-vs-unsupported contrasts, but policy family and features differ from D280.
- qwen_frontier_pairwise_source: 84 units; D280-compatible now = true; Non-final frontier validation already used by prior audits; not a new large temporally separate heldout.
- claim_nli_feature_cache: 505 units; D280-compatible now = existing_candidates_only; Does not cover the 321-389 direct/risk/guard candidate claims needed for D280 hard-negative margins.
