# Conditional Overexpansion Gate

Generated: 2026-06-28T11:21:36.599Z

This gate makes no OpenAI calls and launches no compute. Calibration uses D264 validation and existing validation only; final-window labels are forbidden diagnostics.

| Metric | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| D264 validation pairs | 13 | 13 | 100.0% |
| Existing validation pairwise | 24 | 19 | 79.2% |
| Final diagnostic pairwise | 61 | 35 | 57.4% |
| Gate final selection | 8 | 4 | 50.0% |
| D262 final selection | 8 | 4 | 50.0% |
| D265 final selection | 8 | 5 | 62.5% |

## Decision

- Integrate gate now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The gate does not improve over D262 under leakage-safe calibration.
- Next step: Keep D262 as active baseline; use D265/D267 only as diagnostic evidence.
