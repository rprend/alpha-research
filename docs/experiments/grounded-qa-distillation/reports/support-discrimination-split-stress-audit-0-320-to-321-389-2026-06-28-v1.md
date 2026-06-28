# Support-Discrimination Split Stress Audit

Generated: 2026-06-28T21:30:34.925Z

Status: `existing_splits_select_anti_transfer`

This run makes no API calls and launches no compute.

## Data

- Packet rows: 165
- Early non-final rows: 135
- Late 2004 non-final rows: 30
- Policies evaluated: 51

## Selected Policies

| Selection source | Policy | Selection accuracy | Final analog accuracy |
| --- | --- | ---: | ---: |
| Original validation | `heuristic_numeric_comparative_penalty` | 81.4% | 26.8% |
| Late 2004 non-final | `logreg_lr_0p005_l2_0_e_80` | 96.7% | 41.9% |
| Conservative intersection | none | n/a | n/a |
| Diagnostic final-only | `heuristic_shorter_supported_shape` | n/a | 82.2% |

## Decision

- Integrate selector now: no
- Plan targeted label batch next: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: Existing non-final split choices anti-transfer (original 26.8%, late 41.9%) while the diagnostic final-only policy reaches 82.2%.
