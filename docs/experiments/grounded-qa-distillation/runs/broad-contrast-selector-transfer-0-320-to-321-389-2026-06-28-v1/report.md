# Broad Contrast Selector Transfer

Generated: 2026-06-28T13:26:58.680Z

Status: `broad_selector_transfer_not_sufficient`

This run trains on non-final judged answer contrasts only and evaluates on the broad final heldout.

## Selected Policy

- Policy: nonfinal_broad_pairwise
- Train: 42/58
- Final pairwise: 572/865
- Final selection: 19/49

## Baseline

- D262 final pairwise: 543/865
- Frozen D280 final pairwise: 474/865

## Decision

- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The non-final contrast selector improves pairwise ranking over D262 but collapses candidate selection, so it is useful only as a ranking signal.
