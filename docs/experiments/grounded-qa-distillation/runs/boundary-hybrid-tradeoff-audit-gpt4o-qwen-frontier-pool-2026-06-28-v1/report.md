# Boundary Hybrid Tradeoff Audit

Generated: 2026-06-28T11:50:04.264Z

This is a zero-call diagnostic audit. It uses final-window labels only to explain D272 after the non-final policy was selected; no final labels are used for training or tuning.

| D262 | Boundary-only | Selected hybrid | Lost boundary rescues |
| ---: | ---: | ---: | ---: |
| 4/8 | 5/8 | 4/8 | 1 |

## Lost Rescues

- 2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137: alpha needed 2.306844, D262 gap 2.924138, boundary advantage 1.267592

## Alpha Grid

- alpha 0: existing 19/24, final 4/8
- alpha 0.3: existing 20/24, final 4/8
- alpha 0.5: existing 20/24, final 4/8
- alpha 0.8: existing 20/24, final 4/8
- alpha 1: existing 20/24, final 4/8
- alpha 1.5: existing 18/24, final 4/8
- alpha 2: existing 18/24, final 4/8
- alpha 2.5: existing 18/24, final 5/8
- alpha 3: existing 18/24, final 5/8
- alpha 4: existing 18/24, final 5/8
- alpha 5: existing 18/24, final 5/8

## Decision

- Integrate boundary gate now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: Recovering the lost boundary-only rescue requires alpha about 2.306844 versus selected alpha 0.3, so this is not a safe small-weight hybrid.
- Next step: Keep D262 as active baseline and audit the lost-rescue example as a possible answer-generation/ranking margin problem rather than buying more broad labels.
