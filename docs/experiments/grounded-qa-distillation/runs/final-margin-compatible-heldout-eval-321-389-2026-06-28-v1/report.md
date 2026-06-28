# Margin-Compatible Heldout Eval

Generated: 2026-06-28T13:17:15.488Z

Status: `frozen_d280_not_validated`

This run evaluates frozen selectors on the 321-389 heldout packet. It makes no OpenAI calls, launches no rented compute, and does not fit on heldout rows.

| Policy | Pairs | Correct | Accuracy |
| --- | ---: | ---: | ---: |
| D262 replay | 865 | 543 | 62.8% |
| Hard-negative replay | 865 | 532 | 61.5% |
| Frozen D280 | 865 | 474 | 54.8% |

Frozen D280 selection: 34/49 supported (69.4%).

## Decision

- Promote D280 now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Build larger compatible non-final heldout next: no
- Reason: Frozen D280 does not clear heldout thresholds.
