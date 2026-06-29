# Structured Evidence-Group Constructor Audit

Generated: 2026-06-29T16:41:12.998Z

Status: `structured_group_constructor_repairs_fresh_failures`

## Selected Policy

- Policy: `answerThreshold-0p08__maxGroupSize-4__preferStructured-0`
- Train-heldout repairs: 6/26 (23.1%)
- Fresh-validation repairs: 3/16 (18.8%)
- Fresh-validation full-packet gate: 47/75
- Teacher-only fresh-validation baseline: 44/75

## Decision

- Promote scaffold as policy: no
- Keep as candidate source: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected policy repairs 6/26 train-heldout construction rows and 3/16 fresh-validation construction rows; fresh full-packet gate is 47/75.
- Next step: Add the structured group constructor as a candidate source in the next router audit.
