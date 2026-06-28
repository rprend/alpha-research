# Qwen Switch Frontier Audit

Generated: 2026-06-28T07:16:36.021Z

Status: `frontier_requires_stronger_verifier`

This run makes no OpenAI calls and launches no compute. It audits the switch frontier between the scaffold-priority baseline, calibrated hybrid, and Qwen-switch oracle.

## Current Surfaces

| Surface | Answer rate | Answer support | Overall correct | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | 60.9% | 73.8% | 82.6% | 31 |
| Calibrated hybrid | 71.0% | 71.4% | 79.7% | 35 |
| Qwen switch oracle | 72.5% | 78.0% | 84.1% | 39 |

## Frontier

- Eligible scaffold-abstention rows with Qwen answer candidates: 12
- Oracle-supported switches missed by hybrid: 4
- Harmful hybrid Qwen switches: 3
- Feature separability: `simple_deployable_features_overlap`

## Best Diagnostic Sweep

Policy: `score_0.6_tokens_3_all_qwen_allow_yes_no`

| Answer rate | Answer support | Overall correct | Supported answers | Qwen switches | Supported switches | Unsupported switches |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 71.0% | 71.4% | 79.7% | 35 | 7 | 4 | 3 |

## Decision

The Qwen switch frontier has oracle headroom, but simple score/length/family features overlap between missed supported switches and harmful switches. Next work should build an entailment-aware verifier or repair target, not another hand threshold.
