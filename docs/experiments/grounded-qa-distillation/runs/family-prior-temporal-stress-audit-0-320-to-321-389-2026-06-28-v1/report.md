# Family-Prior Temporal Stress Audit

Generated: 2026-06-28T13:45:29.260Z

Status: `family_prior_temporal_shift_not_promoted`

This audit stress-tests whether non-final source-family reliability is stable enough for an evolving-KB selector claim.

## Temporal Stress

- Leave-one-window-out micro accuracy: 27/58
- Prefix temporal micro accuracy: 18/44
- Prefix into 240-320: 1/20
- Committed final family-prior selection: 42/49
- Tie sensitivity on final selection: raw-only 44/49, raw-then-id 42/49

## Decision

- Promote family-prior selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Keep source reliability, but make it explicitly time-aware and preregister tie handling before any new labels or GPU training.
- Reason: The final-window gain is real as an audit result, but early-window priors fail on the 240-320 window, showing that stationary source reliability is not robust enough for a paper claim about evolving knowledge bases.
