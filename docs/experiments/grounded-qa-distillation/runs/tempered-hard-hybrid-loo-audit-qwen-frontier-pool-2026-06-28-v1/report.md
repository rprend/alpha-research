# Tempered Hard Hybrid LOO Audit

Generated: 2026-06-28T12:42:58.505Z

This is a zero-call leave-one-clean-example-out stability audit. It uses no final-window labels and makes no OpenAI or GPU calls.

## Summary

- Clean examples: 7
- Clean pairs: 19
- Folds reselecting frozen D280 policy: 6/7
- LOO-selected heldout pair correctness: 15/19
- Frozen D280 heldout pair correctness: 18/19
- D262 heldout pair correctness: 15/19

## Fold Policies

- 2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6: alpha_hard=-0.25, alpha_boundary=0, heldout 2/2, frozen 2/2, D262 2/2
- 2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient: alpha_hard=-0.25, alpha_boundary=0, heldout 2/2, frozen 2/2, D262 2/2
- 2004.04124:935873b97872820b7b6100d6a785fba286b94900: alpha_hard=0, alpha_boundary=0, heldout 0/3, frozen 3/3, D262 0/3
- 1912.02866:20632fc4d2b693b5aabfbbc99ee5c1e9fc485dea: alpha_hard=-0.25, alpha_boundary=0, heldout 3/3, frozen 3/3, D262 3/3
- 2004.01820:42eb7c5311fc1ac0344f0b38d3184ccd4faad3be:counterfactual-insufficient: alpha_hard=-0.25, alpha_boundary=0, heldout 1/2, frozen 1/2, D262 1/2
- 2004.01820:235c7c7ca719068136928b18e19f9661e0f72806: alpha_hard=-0.25, alpha_boundary=0, heldout 3/3, frozen 3/3, D262 3/3
- 2004.01820:c87966e7f497975b76a60f6be50c33d296a4a4e7: alpha_hard=-0.25, alpha_boundary=0, heldout 4/4, frozen 4/4, D262 4/4

## Diagnosis

- Primary finding: tempered_policy_not_stable_under_loo
- Interpretation: The fixed D280 coefficient remains high-scoring, but the coefficient-selection rule depends on the small clean diagnostic slice and does not reliably reselect the same policy under leave-one-example-out.

## Decision

- Promote tempered hard hybrid now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Do not deploy the D280 coefficient until it is confirmed on a larger temporally separate clean heldout; use LOO instability as the reason to keep it hypothesis-only.
