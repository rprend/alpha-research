# Judge Calibration Audit

Generated: 2026-06-26T19:04:08.063Z

Status: `audit_packet_ready`

This audit makes no new OpenAI calls. It samples existing judge outputs for manual or independent spot-checking.

## Summary

- Source judge runs: 5
- Judgments loaded: 447
- Unique examples: 149
- Unsupported answer rows: 46
- Questionable abstention rows: 6
- Cross-policy disagreement examples: 40
- Audit queue rows: 26
- Historical source judge cost represented: $0.892177

## Source Runs

| Policy | Run | Examples | Overall judged correct | Answer support | Abstention support | Invalid rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| direct_mini_repair | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1` | 80 | 71.3% | 64.1% | 100.0% | 2.5% |
| direct_mini_repair | `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1` | 69 | 72.5% | 64.2% | 100.0% | 0.0% |
| balanced_risk_gate | `openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-240-320-v1` | 80 | 80.0% | 69.6% | 94.1% | 0.0% |
| balanced_risk_gate | `openai-judge-gpt4o-risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-320-389-v1` | 69 | 79.7% | 70.5% | 96.0% | 0.0% |
| claim_entailment_guard | `openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1` | 149 | 83.2% | 74.1% | 95.3% | 0.0% |

## Calibration Limits

- This artifact audits existing gpt-4o judge outputs; it does not create independent human labels.
- Cross-policy disagreements can be caused by different predictions, not necessarily judge inconsistency.
- The final Qwen 3B student still needs its own grounded-correctness judge and optional human spot-check.

## Recommended Paper Treatment

- Report metrics as model-judged grounded correctness unless independent adjudication is later added.
- Include judge prompt/schema and example-level failure categories in the appendix.
- Before submission, manually review the audit queue or run an independent second-judge/human audit on the sampled rows.

See `audit_queue.jsonl` for the sampled rows.
