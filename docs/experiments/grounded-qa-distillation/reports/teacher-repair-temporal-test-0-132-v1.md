# Teacher Label Export V1

## Setup

- Teacher runs: `openai-multistep-teacher-recall-repair-temporal-test-40-v1`, `openai-multistep-teacher-recall-repair-temporal-test-40-80-v1`, `openai-multistep-teacher-recall-repair-temporal-test-80-132-v1`
- Judge runs: `openai-judge-multistep-teacher-recall-repair-temporal-test-40-v1`, `openai-judge-multistep-teacher-recall-repair-temporal-test-40-80-v1`, `openai-judge-multistep-teacher-recall-repair-temporal-test-80-132-v1`
- Split: `temporal_test`
- Accepted SFT labels: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-temporal-test-0-132-v1.sft.jsonl`
- Rejected audit rows: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-temporal-test-0-132-v1.rejected.jsonl`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 132 | 109 | 23 | 82.6% | 48 | 61 |

The quality filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. It accepts abstentions only when the judge marks the abstention supported and the label cites no evidence.

## Amortization

| Component | Cost |
| --- | ---: |
| Repaired teacher runs | $0.9275725 |
| Judge runs | $0.0172698 |
| Total offline labeling | $0.9448423 |
| Direct mini student per query | $0.0002302 |
| Demo scaffold per query | $0.0009424 |

The offline label packet breaks even against the in-context demo scaffold after about 1327 future queries if post-training preserves the direct mini student's inference cost. This is an accounting result, not a quality result: the next experiment still needs to train or fit a compact student/filter on these labels and evaluate held-out grounded correctness.

## Rejections

- `1911.04474:6e040e80f2da69d50386a90a38ed6d2fa4f77bbd`: verdict=supported;missing_inline_citation
- `1911.04474:6e040e80f2da69d50386a90a38ed6d2fa4f77bbd:counterfactual-insufficient`: verdict=supported;missing_inline_citation
- `1911.06964:3d7d865e905295d11f1e85af5fa89b210e3e9fdf`: verdict=supported;missing_inline_citation
- `1912.01214:9a05a5f4351db75da371f7ac12eb0b03607c4b87`: verdict=supported;missing_inline_citation
- `1912.01214:b6f15fb6279b82e34a5bf4828b7b5ddabfdf1d54:counterfactual-insufficient`: verdict=supported;missing_inline_citation
- `1912.02481:cbf1137912a47262314c94d36ced3232d5fa1926`: verdict=supported;missing_inline_citation
- `1912.03804:2ccc26e11df4eb26fcccdd1f446dc749aff5d572`: verdict=supported;missing_inline_citation
- `1912.04961:99e78c390932594bd833be0f5c890af5c605d808`: verdict=supported;missing_inline_citation
- `1912.04961:f161e6d5aecf8fae3a26374dcb3e4e1b40530c95`: verdict=supported;missing_inline_citation
- `1912.08960:63a1cbe66fd58ff0ead895a8bac1198c38c008aa`: verdict=supported;missing_inline_citation
- `1912.13337:5bb3c27606c59d73fd6944ba7382096de4fa58d8`: verdict=supported;missing_inline_citation
- `1912.13337:75ff6e425ce304a35f18c0230c0d13d3913a31a9`: verdict=supported;missing_inline_citation
- `1912.13337:8de9f14c7c4f37ab103bc8a639d6d80ade1bc27b`: verdict=supported;missing_inline_citation
- `2001.05284:c9c85eee41556c6993f40e428fa607af4abe80a9`: verdict=supported;missing_inline_citation
- `2002.03407:31735ec3d83c40b79d11df5c34154849aeb3fb47`: verdict=supported;missing_inline_citation
- `2003.06651:3c0eaa2e24c1442d988814318de5f25729696ef5`: verdict=supported;missing_inline_citation
- `2003.07433:1870f871a5bcea418c44f81f352897a2f53d0971`: verdict=unsupported
- `2003.07433:3334f50fe1796ce0df9dd58540e9c08be5856c23:counterfactual-insufficient`: verdict=supported;missing_inline_citation
- `2003.07433:7081b6909cb87b58a7b85017a2278275be58bf60`: verdict=supported;missing_inline_citation
- `2003.08529:9174aded45bc36915f2e2adb6f352f3c7d9ada8b`: verdict=supported;missing_inline_citation
- `2003.08529:b5c3787ab3784214fc35f230ac4926fe184d86ba`: verdict=supported;missing_inline_citation
- `2003.12218:928828544e38fe26c53d81d1b9c70a9fb1cc3feb`: verdict=supported;missing_inline_citation
- `2004.03354:16535db1d73a9373ffe9d6eedaa2369cefd91ac4`: verdict=supported;missing_inline_citation

## Decision Use

Use this export as candidate post-training data, not as a final benchmark score. The important next measurement is whether a student trained or filtered with these labels keeps the precision/support gains without carrying the demo scaffold's per-query token cost.
