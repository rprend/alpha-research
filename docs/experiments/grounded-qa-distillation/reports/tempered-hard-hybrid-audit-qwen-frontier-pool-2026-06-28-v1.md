# Tempered Hard Hybrid Audit

Generated: 2026-06-28T12:36:55.198Z

This is a zero-call comparable-coverage hybrid audit. It grids small hard-negative and boundary margin adjustments on non-final validation rows only and uses no final-window labels.

## Summary

- Grid rows: 81
- Eligible policies preserving existing/frontier thresholds: 10
- Existing validation pairs: 24
- Clean validation pairs: 19
- Frontier validation pairs: 21

## Selected Candidate

- Alpha hard-negative: -0.25
- Alpha boundary: 0
- Existing validation: 20/24
- Clean validation: 18/19
- Frontier validation: 19/21

## Baselines

- D262 pool-pairwise clean: 15/19
- D262 proxy frontier: 19/21
- Hard-negative clean: 14/19
- Boundary clean: 11/19

## Diagnosis

- Primary finding: tempered_hard_negative_candidate_found
- Interpretation: A small negative hard-negative coefficient improves the clean non-final diagnostic while preserving existing and frontier thresholds, but it was selected on the diagnostic slice and needs a larger heldout before promotion.

## Decision

- Promote tempered hard hybrid now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Freeze the tempered hard-negative coefficient as a candidate hypothesis and test it on a larger clean non-final heldout before changing the active selector.
