# Qwen Contrast Verifier

Generated: 2026-06-28T09:45:18.089Z

Status: `qwen_contrast_verifier_partial_signal`

This run makes no OpenAI calls and launches no compute. It trains from leakage-safe non-final contrast labels and keeps final-window Qwen frontier rows diagnostic-only.

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | 137 | 117 | 85.4% |
| Qwen non-final contrast validation | 5 | 4 | 80.0% |
| Qwen frontier-pool contrast validation | 21 | 18 | 85.7% |
| Existing validation pairwise | 24 | 17 | 70.8% |
| Final diagnostic pairwise | 61 | 27 | 44.3% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The contrast verifier does not clear all held-out and final diagnostic thresholds.
- Next step: Treat the frontier-pool labels as in-distribution but non-transfering supervision; audit final-domain shift or improve the verifier target before more generator GPU spend.
