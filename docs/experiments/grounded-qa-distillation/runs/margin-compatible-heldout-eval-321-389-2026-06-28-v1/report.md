# Margin-Compatible Heldout Eval

Generated: 2026-06-28T13:10:21.894Z

Status: `heldout_eval_no_usable_pairs`

This run evaluates frozen selectors on the 321-389 heldout packet. It makes no OpenAI calls, launches no rented compute, and does not fit on heldout rows.

| Policy | Pairs | Correct | Accuracy |
| --- | ---: | ---: | ---: |
| D262 replay | 0 | 0 | 0.0% |
| Hard-negative replay | 0 | 0 | 0.0% |
| Frozen D280 | 0 | 0 | 0.0% |

Frozen D280 selection: 0/0 supported (0.0%).

## Decision

- Promote D280 now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Build larger compatible non-final heldout next: yes
- Reason: After exact-duplicate filtering, the 321-389 scaffold pool has no usable feature-contrast pairs for frozen D280 validation.
