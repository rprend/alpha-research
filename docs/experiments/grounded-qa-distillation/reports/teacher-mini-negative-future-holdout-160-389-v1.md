# Mini-Negative Teacher Export

## Setup

- Source policy run: `mini-verifier-gate-balanced-risk-gate-160-389-v1`
- Export policy: `mini`
- Split: `extended_temporal_future_holdout`
- Accepted SFT labels: `docs/experiments/grounded-qa-distillation/exports/teacher-mini-negative-future-holdout-160-389-v1.sft.jsonl`
- Rejected audit rows: `docs/experiments/grounded-qa-distillation/exports/teacher-mini-negative-future-holdout-160-389-v1.rejected.jsonl`
- Verifier labels: `docs/experiments/grounded-qa-distillation/exports/teacher-mini-negative-future-holdout-160-389-v1.verifier.jsonl`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained | Verifier keep targets | Verifier suppress targets | Policy suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 192 | 37 | 83.8% | 98 | 94 | 185 | 44 | 7 |

The exported policy changes strong support-oracle correctness from 80.8% for the balanced risk gate to 83.8% by using rare `gpt-4o-mini` verifier negatives.

## Cost

The source mini verifier runs made 229 calls and cost $0.02789160. This export makes no additional LLM calls.

## Caveats

- Suppressed unsupported answers are accepted by support-oracle conversion, not by a fresh abstention judge.
- The source policy uses per-query mini verifier calls; this packet is for distillation or verifier training.

## Rejections

- `2003.09244:b59f3a58939f7ac007d3263a459c56ebefc4b49a`: mini_policy_retained_unsupported
- `2003.11528:c2ce25878a17760c79031a426b6f38931cd854b2`: mini_policy_retained_unsupported
- `2003.11562:19cf7884c0c509c189b1e74fe92c149ff59e444b`: mini_policy_retained_unsupported
- `2003.11645:c2d1387e08cf25cb6b1f482178cca58030e85b70:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2003.12450:d14118b18ee94dafe170439291e20cb19ab7a43c:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2003.12660:2d5d0b0c54105717bf48559b914fefd0c94964a6`: mini_policy_retained_unsupported
- `2003.12660:80bb07e553449bde9ac0ff35fcc718d7c161f2d4:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2003.12738:8740c3000e740ac5c0bc8f329d908309f7ffeff6`: mini_policy_retained_unsupported
- `2003.12738:c69f4df4943a2ca4c10933683a02b179a5e76f64`: mini_policy_retained_unsupported
- `2004.00809:740cc392c0c8bfadfe6b3a60c0be635c03e17f2a`: mini_policy_retained_unsupported
- `2004.01694:a93d4aa89ac3abbd08d725f3765c4f1bed35c889`: mini_policy_retained_unsupported
- `2004.01853:193ee49ae0f8827a6e67388a10da59e137e7769f`: mini_policy_retained_unsupported
- `2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6`: mini_policy_retained_unsupported
- `2004.02105:e25b73f700e8c958b64951f14a71bc60d225125c`: mini_policy_retained_unsupported
- `2004.02143:014830892d93e3c01cb659ad31c90de4518d48f3`: mini_policy_retained_unsupported
- `2004.02143:ae7c5cf9c2c121097eb00d389cfd7cc2a5a7d577`: mini_policy_retained_unsupported
- `2004.02192:55507f066073b29c1736b684c09c045064053ba9`: mini_policy_retained_unsupported
- `2004.02192:b3de9357c569fb1454be8f2ac5fcecaea295b967`: mini_policy_retained_unsupported
- `2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2004.02334:e5b2eb6a49c163872054333f8670dd3f9563046a`: mini_policy_retained_unsupported
- `2004.02334:ec990c16896793a819766bc3168c02556ef69971`: mini_policy_retained_unsupported
- `2004.02393:022e5c996a72aeab890401a7fdb925ecd0570529`: mini_policy_retained_unsupported
- `2004.02393:bd7039f81a5417474efa36f703ebddcf51835254`: mini_policy_retained_unsupported
- `2004.02929:8bfbf78ea7fae0c0b8a510c9a8a49225bbdb5383`: mini_policy_retained_unsupported
- `2004.02929:97757a69d9fc28b260e68284fd300726fbe358d0`: mini_policy_retained_unsupported
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26`: mini_policy_retained_unsupported
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec`: mini_policy_retained_unsupported
- `2004.03685:d4b9cdb4b2dfda1e0d96ab6c3b5e2157fd52685e`: mini_policy_retained_unsupported
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd`: mini_policy_retained_unsupported
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753`: mini_policy_retained_unsupported
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753:counterfactual-insufficient`: mini_policy_retained_unsupported
- `2004.04228:e09dcb6fc163bba7d704178e7edba2e630b573c2`: mini_policy_retained_unsupported
- `2004.04435:d353a6bbdc66be9298494d0c853e0d8d752dec4b`: mini_policy_retained_unsupported
- `2004.04435:e2cfaa2ec89b944bbc46e5edf7753b3018dbdc8f`: mini_policy_retained_unsupported
- `2004.04721:73906462bd3415f23d6378590a5ba28709b17605`: mini_policy_retained_unsupported
- `2004.04721:bfc1de5fa4da2f0e301fd22aea19cf01e2bb5b31:counterfactual-insufficient`: mini_policy_retained_unsupported
