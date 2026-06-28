# Hard-Negative Promotion Gate Audit

Generated: 2026-06-28T12:30:44.272Z

This is a zero-call promotion gate. It uses existing selector outputs only, reports final-window rows as forbidden diagnostics, and makes no OpenAI or GPU calls.

## Summary

- Clean non-final validation examples: 7
- Clean non-final validation pairs: 19
- Frontier validation pairs: 21
- Final clean diagnostic examples: 5

## Hard-Negative Selectors

- hard_negative_baseline: frontier 19/21; existing 19/24; clean 14/19
- hard_negative_weighted: frontier 19/21; existing 16/24; clean 11/19
- hard_negative_risk_penalized: frontier 19/21; existing 19/24; clean 14/19

## Baselines

- D262 pool-pairwise clean: 15/19
- D262 constrained clean: 14/19
- D278 D262 proxy frontier: 19/21

## Final Diagnostics

- hard_negative_baseline: 3/5 final-clean diagnostic supported selections
- hard_negative_weighted: 3/5 final-clean diagnostic supported selections
- hard_negative_risk_penalized: 3/5 final-clean diagnostic supported selections
- d262_constrained: 3/5 final-clean diagnostic supported selections

## Diagnosis

- Primary finding: hard_negative_signal_not_sufficient_for_promotion
- Interpretation: The hard-negative baseline is useful frontier supervision, but it does not beat the D262 pool-pairwise clean slice or frontier proxy strongly enough to justify promotion.

## Decision

- Promote hard-negative selector now: no
- Promote D262 proxy as active selector now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Construct a comparable-coverage hard-negative-aware hybrid only if it beats the D262 pool-pairwise clean slice and the 19/21 frontier proxy without using final-window labels.
