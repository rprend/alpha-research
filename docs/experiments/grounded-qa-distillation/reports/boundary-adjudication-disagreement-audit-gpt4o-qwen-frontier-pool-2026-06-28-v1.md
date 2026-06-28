# Boundary Adjudication Disagreement Audit

Generated: 2026-06-28T11:38:27.205Z

This is a zero-call audit over the paid D270 non-final boundary labels. It makes no OpenAI calls and uses no final-window labels for training.

| Paid rows | Disagreements | Accepted for training | Quarantined | Spend inherited |
| ---: | ---: | ---: | ---: | ---: |
| 12 | 4 | 8 | 4 | $0.049252 |

## Decision

- Integrate all paid labels now: no
- Integrate filtered paid labels now: yes
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: 8/12 labels are high-confidence A-over-B boundary labels after audit; 4 rows need quarantine or second-pass review.
- Next step: Train a filtered boundary selector on accepted labels only and keep quarantined disagreements out of training.
