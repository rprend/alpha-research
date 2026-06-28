# Filtered Boundary Selector

Generated: 2026-06-28T11:45:00.514Z

This zero-call selector trains only on the 8 accepted D271 paid boundary labels. Quarantined disagreements and final-window labels are excluded from training and tuning.

| System | Existing validation | Final selection |
| --- | ---: | ---: |
| D262 baseline | 19/24 | 4/8 |
| Boundary-only | 16/24 | 5/8 |
| Selected hybrid alpha=0.3 | 20/24 | 4/8 |

## Decision

- Integrate filtered boundary hybrid now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: Boundary-only final selection is 5/8 and the selected hybrid is 4/8; this does not improve safely over D262's 4/8.
- Next step: Keep D262 as active baseline; use the filtered labels as calibration evidence, but do not buy more labels until the remaining miss pattern is audited.
