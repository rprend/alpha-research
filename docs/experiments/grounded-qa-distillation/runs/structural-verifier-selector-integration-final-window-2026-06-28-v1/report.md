# Structural Verifier Selector Integration

Generated: 2026-06-28T17:20:28.703Z

Status: `structural_selector_not_integrated`

This run makes no API calls and launches no compute. It applies D316's selected structural target-completeness policy to the existing final-window candidate pool and reports inherited-judgment metrics.

## Metrics

| Selector | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | 60.9% | 73.8% | 82.6% | 31 |
| Calibrated hybrid | 71.0% | 71.4% | 79.7% | 35 |
| Structural abstention switch | 78.3% | 66.7% | 73.9% | 36 |
| Structural all-candidates | 78.3% | 61.1% | 69.6% | 33 |
| Structural conservative | 78.3% | 66.7% | 73.9% | 36 |

## Decision

- Integrate structural selector now: no
- Replace calibrated hybrid now: no
- Train student on GPU now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: Structural policies recover supported answers but do not dominate calibrated hybrid across support and overall correctness.
- Next step: Use structural target score as an analysis feature, but tune a non-final selector objective before replacing the calibrated hybrid.
