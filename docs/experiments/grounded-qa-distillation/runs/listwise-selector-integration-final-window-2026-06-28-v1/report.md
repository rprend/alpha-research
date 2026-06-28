# Listwise Selector Integration

Generated: 2026-06-28T21:08:34.353Z

Status: `listwise_selector_not_integrated`

This run makes no API calls and launches no compute.

## Selected Policy

- Policy: `heuristic_qwen_penalty`
- Non-final validation accuracy: 91.4%
- Frozen final pair transfer accuracy: 86.7%

## System Metrics

| Policy | Answered | Supported answers | Answer support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | 42 | 31 | 73.8% | 82.6% |
| Calibrated hybrid | 49 | 35 | 71.4% | 79.7% |
| Listwise all candidates | 54 | 34 | 63.0% | 71.0% |
| Listwise contract-safe | 54 | 34 | 63.0% | 71.0% |
| Listwise conservative | 53 | 35 | 66.0% | 73.9% |

## Gap

- Conservative minus calibrated overall correctness: -5.8%
- Conservative minus calibrated answer support: -5.4%
- Conservative minus calibrated answer rate: 5.8%

## Decision

- Replace calibrated hybrid now: no
- Use listwise selector in scaffold now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The listwise pairwise gain does not cleanly dominate the calibrated hybrid on end-to-end selection metrics.
- Next step: Use the positive pairwise signal to design a coverage-constrained selector objective before replacing the current scaffold.
