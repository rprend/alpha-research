# Overexpansion-Aware Selector

Generated: 2026-06-28T11:01:55.665Z

This selector makes no OpenAI calls and launches no compute. Final-window labels are forbidden diagnostics only.

| Split | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train overexpansion pairs | 40 | 37 | 92.5% |
| Validation overexpansion pairs | 13 | 12 | 92.3% |
| Existing validation pairwise | 24 | 14 | 58.3% |
| Final diagnostic pairwise | 61 | 30 | 49.2% |
| Final diagnostic selection | 8 | 5 | 62.5% |
| D262 baseline final selection | 8 | 4 | 50.0% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Overexpansion-aware features improve final diagnostic selection but fail the existing validation preservation gate.
- Next step: Test a calibrated hybrid with D262 so the overexpansion signal can recover final misses without sacrificing broad grounded-support validation.
