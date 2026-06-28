# Listwise Selector Probe

Generated: 2026-06-28T21:04:29.152Z

Status: `listwise_selector_probe_promotable`

This run makes no API calls and launches no compute.

## Data

- Train pairwise rows: 368
- Validation pairwise rows: 1458
- Final pairwise rows: 865
- Policies evaluated: 31

## Selected Policy

- Policy: `heuristic_qwen_penalty`
- Validation accuracy: 91.4%
- Final transfer accuracy: 86.7%
- Structural baseline final accuracy: 84.2%
- D314 final accuracy: 69.1%

## Decision

- Promote selector now: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The validation-selected policy reaches 91.4% non-final validation accuracy and matches or beats the structural final pair baseline.
- Next step: Integrate the selected zero-call listwise selector into the scaffold and rerun system-level judged metrics before any GPU launch.
