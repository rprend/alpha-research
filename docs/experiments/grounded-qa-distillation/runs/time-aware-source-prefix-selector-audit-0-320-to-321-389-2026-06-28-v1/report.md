# Time-Aware Source-Prefix Selector Audit

Generated: 2026-06-28T13:58:11.427Z

Status: `time_aware_source_prefix_partial_not_promoted`

This audit preregisters a recency-weighted normalized source-prefix selector and evaluates it against final-window selection and non-final chronological stress.

## Selection

- Selected policy: source_prefix_recency_4x
- Final selection: 44/49 supported
- Source-prefix audit baseline: 44/49 supported
- Family-prior baseline: 42/49 supported
- Hard prefix split, family prior: 1/20
- Hard prefix split, source prefix: 7/20

## Decision

- Promote time-aware source-prefix selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Use time-aware normalized source-prefix reliability as one feature, but add evidence/claim features before any promoted selector or paid labeling run.
- Reason: The time-aware source-prefix selector preserves 44/49 final support and improves the hard temporal prefix split from 1/20 to 7/20, but that stress result is still too weak for a robust evolving-KB claim.
