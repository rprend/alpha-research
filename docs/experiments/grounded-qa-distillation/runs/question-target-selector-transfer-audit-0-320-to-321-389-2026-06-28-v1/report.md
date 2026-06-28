# Question-Target Selector Transfer Audit

Generated: 2026-06-28T16:27:47.740Z

Status: `question_target_selector_anti_transfers_pairwise`

This audit uses the paid D309 non-final target-completeness labels to select a cheap surface-feature selector, then reports transfer on frozen final supported-vs-unsupported pairs.

## Selected By Non-Final Labels

- Policy: linear_0p5_2_m1_0_0
- Train accuracy: 70/77 (90.9%)
- Final accuracy: 387/838 (46.2%)

## Diagnostic Best Final Policy

- Policy: linear_0_0_0p5_0_m2
- Final accuracy: 441/581 (75.9%)
- Train accuracy: 31/51 (60.8%)

## Decision

- Integrate feature selector now: no
- Train question-target verifier now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The best non-final label-selected policy reaches 90.9% on 77 D309 primary rows but only 46.2% on 838 final heldout pairs; surface feature agreement is not a deployable target-completeness verifier.
- Next step: Do not promote a scalar feature selector. Convert D309 labels into a richer text-pair verifier target, then evaluate transfer before any GPU launch.
