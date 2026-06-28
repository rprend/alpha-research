# Structural Cross-Window Selector

Generated: 2026-06-28T17:27:20.575Z

Status: `structural_cross_window_selector_not_promoted`

This run makes no API calls and launches no compute. It tunes support and structural-target thresholds on 240-320, then reports transfer on 321-389.

## Metrics

| Selector | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Selected structural cross-window | 76.8% | 64.2% | 72.5% | 34 |
| Previous cross-window selector | 72.5% | 66.0% | 75.4% | n/a |
| Calibrated hybrid | 71.0% | 71.4% | 79.7% | 35 |

## Decision

- Promote selector now: no
- Replace calibrated hybrid now: no
- Train student on GPU now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The structural cross-window selector reaches 76.8% answer rate, 64.2% answer support, and 72.5% overall correctness; it does not dominate the calibrated hybrid and changes only -2.9% overall correctness versus the prior cross-window selector.
- Next step: Keep calibrated hybrid as the deployable final selector; use structural score as a training feature for future non-final listwise packets, not as a replacement yet.
