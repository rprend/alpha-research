# Combined Mini/Deterministic Guard Teacher Export

## Setup

- Source policy run: `mini-verifier-gate-balanced-risk-gate-240-389-v1`
- Split: `extended_temporal_future_holdout`
- Accepted SFT labels: `docs/experiments/grounded-qa-distillation/exports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.sft.jsonl`
- Rejected audit rows: `docs/experiments/grounded-qa-distillation/exports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.rejected.jsonl`
- Verifier labels: `docs/experiments/grounded-qa-distillation/exports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.verifier.jsonl`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained | Verifier keep targets | Verifier suppress targets | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 149 | 125 | 24 | 83.9% | 62 | 63 | 119 | 30 | 8 |

The combined policy improves strong support-oracle correctness from 79.9% for the balanced risk gate to 83.9% by combining rare `gpt-4o-mini` verifier negatives with the deterministic claim-entailment guard.

## Cost

The source mini verifier runs made 149 calls and cost $0.01805595. This export makes no additional LLM calls.

## Caveats

- Suppressed unsupported answers are accepted by support-oracle conversion, not by a fresh abstention judge.
- The combined policy uses per-query mini verifier calls; this packet is for distillation or verifier training.

## Rejections

- `2004.01853:193ee49ae0f8827a6e67388a10da59e137e7769f`: combined_policy_retained_unsupported
- `2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6`: combined_policy_retained_unsupported
- `2004.02143:014830892d93e3c01cb659ad31c90de4518d48f3`: combined_policy_retained_unsupported
- `2004.02143:ae7c5cf9c2c121097eb00d389cfd7cc2a5a7d577`: combined_policy_retained_unsupported
- `2004.02192:55507f066073b29c1736b684c09c045064053ba9`: combined_policy_retained_unsupported
- `2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient`: combined_policy_retained_unsupported
- `2004.02334:e5b2eb6a49c163872054333f8670dd3f9563046a`: combined_policy_retained_unsupported
- `2004.02334:ec990c16896793a819766bc3168c02556ef69971`: combined_policy_retained_unsupported
- `2004.02393:022e5c996a72aeab890401a7fdb925ecd0570529`: combined_policy_retained_unsupported
- `2004.02393:bd7039f81a5417474efa36f703ebddcf51835254`: combined_policy_retained_unsupported
- `2004.02929:8bfbf78ea7fae0c0b8a510c9a8a49225bbdb5383`: combined_policy_retained_unsupported
- `2004.02929:97757a69d9fc28b260e68284fd300726fbe358d0`: combined_policy_retained_unsupported
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26`: combined_policy_retained_unsupported
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec`: combined_policy_retained_unsupported
- `2004.03685:d4b9cdb4b2dfda1e0d96ab6c3b5e2157fd52685e`: combined_policy_retained_unsupported
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd`: combined_policy_retained_unsupported
- `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a`: combined_policy_harmful_suppression
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753`: combined_policy_retained_unsupported
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753:counterfactual-insufficient`: combined_policy_retained_unsupported
- `2004.04228:e09dcb6fc163bba7d704178e7edba2e630b573c2`: combined_policy_retained_unsupported
- `2004.04435:d353a6bbdc66be9298494d0c853e0d8d752dec4b`: combined_policy_retained_unsupported
- `2004.04435:e2cfaa2ec89b944bbc46e5edf7753b3018dbdc8f`: combined_policy_retained_unsupported
- `2004.04721:73906462bd3415f23d6378590a5ba28709b17605`: combined_policy_retained_unsupported
- `2004.04721:bfc1de5fa4da2f0e301fd22aea19cf01e2bb5b31:counterfactual-insufficient`: combined_policy_retained_unsupported
