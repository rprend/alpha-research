# Targeted Boundary Adjudication Run

Generated: 2026-06-28T11:36:44.787Z

This run executed only the capped D269 packet requests. It did not use final-window labels for training and did not include existing local judge post-hoc fields in the OpenAI prompt.

| Requests | Calls | Cost | Exact existing-signal agreement | Budget remaining |
| ---: | ---: | ---: | ---: | ---: |
| 12 | 12 | $0.049252 | 8/12 (66.7%) | $86.492394 |

## Decision

- Integrate labels now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The targeted boundary labels expose too much disagreement with the existing weak signal for immediate selector integration.
- Next step: Audit disagreement rows before buying more labels or launching more GPU work.
