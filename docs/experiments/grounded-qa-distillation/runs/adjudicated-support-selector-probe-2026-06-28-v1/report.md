# Adjudicated Support Selector Probe

Generated: 2026-06-28T21:50:43.146Z

Status: `adjudicated_support_selector_overfits_nonfinal`

This probe makes no API calls and launches no compute. It selects policies only on non-final adjudicated labels; final-window adjudications are reporting-only.

## Data

- Non-final usable train pairs: 22
- Non-final usable validation pairs: 12
- Final reporting pairs: 16
- Policies evaluated: 51
- Non-final duplicate exact agreement: 4/4
- Final duplicate exact agreement: 1/4

## Selected Policy

- Policy: `logreg_lr_0p08_l2_0_e_320`
- Non-final validation accuracy: 75.0%
- Final reporting accuracy: 31.3%
- Final reporting mean margin: -16.921

## Decision

- Integrate selector now: no
- Train support discriminator next: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The selected policy does not meet transfer thresholds: non-final validation 0.750, final reporting 0.313, train pairs 22.
- Next step: Use the adjudications to build a narrower overclaim/citation-mismatch packet rather than spending GPU now.
