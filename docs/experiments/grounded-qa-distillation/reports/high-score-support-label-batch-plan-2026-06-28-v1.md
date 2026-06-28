# High-Score Support Label Batch Plan

Generated: 2026-06-28T21:37:18.304Z

Status: `high_score_support_label_batch_ready_below_budget`

This is a planning artifact. It makes no API calls and launches no compute.

## Batch

- Non-final training-eligible requests: 48
- Final validation-only requests: 24
- Duplicate calibration requests: 8
- Total planned requests: 80

## Cost

- Model: `gpt-4o-mini`
- Estimated cost: $0.0396
- Estimated cost with 2x safety: $0.0793
- Remaining budget: $86.1558

## Decision

- Run label batch now: no
- Ask for secret now: no
- Launch GPU now: no
- Reason: The planned 80-call batch targets the exact anti-transfer failure and costs about $0.0396 before a 2x safety factor.
