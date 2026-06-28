# Support-Discrimination Feature Audit

Generated: 2026-06-28T21:23:24.708Z

Status: `support_discrimination_signal_overfits_nonfinal`

This run makes no API calls and launches no compute.

## Data

- Train pairs: 95
- Validation pairs: 70
- Final analog pairs: 298
- Policies evaluated: 51

## Selected Policy

- Policy: `heuristic_numeric_comparative_penalty`
- Validation accuracy: 81.4%
- Final analog accuracy: 26.8%
- Final analog mean margin: 0.122

## Decision

- Integrate support discriminator next: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The deployable surface features do not transfer strongly enough on final analog hard negatives to justify scaffold integration or new GPU spend.
