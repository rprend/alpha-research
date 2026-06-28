# Question-Target Label Batch Plan

Generated: 2026-06-28T16:09:29.160Z

Status: `targeted_label_batch_ready_below_budget`

This is a planning artifact only. It makes no API calls and launches no compute.

## Batch

- Primary requests: 79
- Calibration duplicate requests: 8
- Total requests: 87
- Train requests: 60
- Validation requests: 19

## Cost

- Model: gpt-4o-mini
- Pricing source: https://developers.openai.com/api/docs/models/gpt-4o-mini
- Estimated cost: $0.0367
- Estimated cost with 2x safety: $0.0733
- Keeps total under $100: yes

## Decision

- Run label batch now: no
- Ask for secret now: no
- Launch GPU now: no
- Next step: Run this targeted label batch only after confirming the API key is available through the macOS secret helper; do not rent GPU until labels show the target-completeness verifier is trainable.
- Reason: The planned 87-call batch is estimated at $0.0367 before a 2x safety factor, well inside the remaining budget, and directly targets the missing hard-negative type.
