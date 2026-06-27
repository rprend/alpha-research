# Candidate Selector Cross-Window

Generated: 2026-06-27T04:43:34.239Z

Status: `selector_transfers_under_coverage`

Selected rule: support score >= 0.55 uses direct citation-repaired answer; otherwise uses risk gate.

## Eval Baselines

| System | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| direct_mini_citation_repair | 76.8% | 64.2% | 100.0% | 72.5% |
| balanced_support_risk_gate | 63.8% | 70.5% | 96.0% | 79.7% |
| claim_entailment_guard | 60.9% | 73.8% | 96.3% | 82.6% |

## Selected Rule

| Split | Answer rate | Answer support | Abstention support | Overall judged correct | Answered | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| train 240-320 | 72.5% | 67.2% | 100.0% | 76.3% | 58 | 19 |
| eval 321-389 | 72.5% | 66.0% | 100.0% | 75.4% | 50 | 17 |

## Interpretation

The learned rule modestly improves answer support while preserving the 70% answer-rate floor on held-out examples, but it is only a zero-call selector over direct-mini outputs and does not create new supported answers.

Qwen implication: Keep the Qwen 3B joint-action smoke focused on generating or repairing supported answers, not only choosing among current direct/gate/guard outputs.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
