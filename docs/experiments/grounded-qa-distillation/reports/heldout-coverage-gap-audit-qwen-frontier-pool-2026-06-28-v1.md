# Heldout Coverage Gap Audit

Generated: 2026-06-28T12:52:21.600Z

This is a zero-call heldout inventory audit. It checks whether existing artifacts can validate the D280/D281 tempered hard-negative selector without new labels or compute.

## Summary

- Sources inventoried: 5
- D280 margin-compatible sources: 3
- Large D280 margin-compatible sources: 0
- Large temporal scaffold sources not margin-compatible: 1
- Largest margin-compatible units: 21
- Largest temporal incompatible units: 69

## Inventory

- qwen_clean_nonfinal_slice: units 19, margin-compatible true, temporal/paper-separate false; The D280 coefficient was selected on this small clean diagnostic slice.
- qwen_frontier_replay: units 21, margin-compatible partial_boundary_only, temporal/paper-separate false; Hard-negative alpha cannot be replayed independently here because D262 proxy already is the hard-negative baseline.
- d281_leave_one_clean_example_out: units 19, margin-compatible true, temporal/paper-separate false; Not an external heldout; one fold does not reselect the frozen D280 policy.
- temporal_321_389_candidate_selector: units 69, margin-compatible false, temporal/paper-separate true; Large and temporally held out, but it is a direct/risk/guard scaffold selector, not a Qwen pairwise-margin candidate selector.
- final_qwen_diagnostic_clean_stratum: units 5, margin-compatible false, temporal/paper-separate true; Final-window rows are diagnostic-only and too small for selector promotion.

## Diagnosis

- Primary finding: margin_compatible_heldout_gap
- Interpretation: The repository has a larger temporal heldout for scaffold-level claims, but no large clean D280-compatible pairwise-margin heldout; using the 321-389 temporal selector as D280 validation would conflate different tasks.

## Decision

- Promote D280/D281 selector now: no
- Treat 321-389 as D280 validation: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Build or identify a margin-compatible clean non-final heldout packet before selector promotion; use the 321-389 temporal window only for scaffold-level claims, not D280 validation.
