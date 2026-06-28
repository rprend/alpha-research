# Calibrated Overexpansion Hybrid

Generated: 2026-06-28T11:08:26.343Z

This hybrid makes no OpenAI calls and launches no compute. Alpha is calibrated on existing validation only; final-window labels are forbidden diagnostics.

Selected alpha: `0.15`

| Metric | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Existing validation pairwise | 24 | 19 | 79.2% |
| Final diagnostic pairwise | 61 | 35 | 57.4% |
| Hybrid final selection | 8 | 4 | 50.0% |
| D262 final selection | 8 | 4 | 50.0% |
| D265 final selection | 8 | 5 | 62.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The hybrid does not simultaneously preserve validation and recover the overexpansion final-selection gain.
- Next step: Keep D262 as the active baseline and use D265 only as a targeted diagnostic signal.
