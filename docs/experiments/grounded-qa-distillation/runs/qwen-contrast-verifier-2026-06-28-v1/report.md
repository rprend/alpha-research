# Qwen Contrast Verifier

Generated: 2026-06-28T08:51:45.165Z

Status: `qwen_contrast_verifier_not_sufficient`

This run makes no OpenAI calls and launches no compute. It trains from leakage-safe non-final contrast labels and keeps final-window Qwen frontier rows diagnostic-only.

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | 74 | 59 | 79.7% |
| Qwen non-final contrast validation | 5 | 3 | 60.0% |
| Existing validation pairwise | 24 | 14 | 58.3% |
| Final diagnostic pairwise | 61 | 21 | 34.4% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The contrast verifier does not clear all held-out and final diagnostic thresholds.
- Next step: Use this packet as evidence that reference-vs-unsupported contrasts help only partially; next build frontier-style non-final candidate pools or buy a bounded verifier-label batch before more generator GPU runs.
