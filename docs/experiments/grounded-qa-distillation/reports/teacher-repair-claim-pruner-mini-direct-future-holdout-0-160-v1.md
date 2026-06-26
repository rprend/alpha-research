# Teacher Label Export V1

## Setup

- Teacher runs: `citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1`, `citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1`
- Judge runs: `openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1`, `openai-judge-gpt4o-citation-contract-repair-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1`
- Extra upstream cost runs: `openai-claim-pruner-mini-direct-repair-extended-future-holdout-0-80-v1`, `openai-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1`
- Split: `extended_temporal_future_holdout`
- Accepted SFT labels: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1.sft.jsonl`
- Rejected audit rows: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1.rejected.jsonl`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 160 | 124 | 36 | 77.5% | 85 | 39 |

The quality filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. It accepts abstentions only when the judge marks the abstention supported and the label cites no evidence.

## Amortization

| Component | Cost |
| --- | ---: |
| Teacher/source runs, including extra upstream cost runs | $0.0281242 |
| Judge runs | $0.2969650 |
| Total offline labeling | $0.3250893 |
| Direct mini student per query | $0.0002108 |
| Demo scaffold per query | $0.0002490 |

The offline label packet breaks even against the in-context demo scaffold after about 8518 future queries if post-training preserves the direct mini student's inference cost. This is an accounting result, not a quality result: the next experiment still needs to train or fit a compact student/filter on these labels and evaluate held-out grounded correctness.

## Rejections

- `2003.00576:2ed02be0c183fca7031ccb8be3fd7bc109f3694b:counterfactual-insufficient`: verdict=partial
- `2003.00639:3ccd337f77c5d2f7294eb459ccc1770796c2eaef`: verdict=unsupported
- `2003.00864:184382af8f58031c6e357dbee32c90ec95288cb3`: verdict=partial
- `2003.00864:184382af8f58031c6e357dbee32c90ec95288cb3:counterfactual-insufficient`: verdict=partial
- `2003.00864:9ec0527bda2c302f4e82949cc0ae7f7769b7bfb8`: verdict=unsupported
- `2003.01472:90f80a94fabaab72833256572db1d449c2779beb`: verdict=unsupported
- `2003.01472:da55878d048e4dca3ca3cec192015317b0d630b1`: verdict=unsupported
- `2003.01769:e1b36927114969f3b759cba056cfb3756de474e4`: verdict=unsupported
- `2003.02249:8b9c12df9f89040f1485b3847a29f11b5c9262e0`: verdict=partial
- `2003.02249:b637d6393ef3af7462917b81861531022b291933`: verdict=partial
- `2003.03044:ce0e2a8675055a5468c4c54dbb099cfd743df8a7`: verdict=unsupported
- `2003.03106:66c96c297c2cffdf5013bab5e95b59101cb38655:counterfactual-insufficient`: verdict=unsupported
- `2003.03131:526dc757a686a1fe41e77f7e3848e3507940bfc4`: verdict=partial
- `2003.03131:9186b2c5b7000ab7f15a46a47da73ea45544bace`: verdict=unsupported
- `2003.03612:574f17134e4dd041c357ebb75a7ef590da294d22:counterfactual-insufficient`: verdict=partial
- `2003.04032:269b05b74d5215b09c16e95a91ae50caedd9e2aa`: verdict=unsupported
- `2003.04032:58e65741184c81c9e7fe0ca15832df2d496beb6f`: verdict=unsupported
- `2003.04707:58259f2e22363aab20c448e5dd7b6f432556b32d:counterfactual-insufficient`: verdict=unsupported
- `2003.04707:b9e0b1940805a5056f71c66d176cc87829e314d4`: verdict=unsupported
- `2003.04866:a616a3f0d244368ec588f04dfbc37d77fda01b4c`: verdict=unsupported
- `2003.05995:9c94ff8c99d3e51c256f2db78c34b2361f26b9c2`: verdict=partial
- `2003.05995:bc26eee4ef1c8eff2ab8114a319901695d044edb:counterfactual-insufficient`: verdict=partial
- `2003.06279:23d32666dfc29ed124f3aa4109e2527efa225fbc`: verdict=partial
- `2003.06651:3c0eaa2e24c1442d988814318de5f25729696ef5`: verdict=unsupported
- `2003.06651:d94ac550dfdb9e4bbe04392156065c072b9d75e1`: verdict=unsupported
- `2003.07433:1870f871a5bcea418c44f81f352897a2f53d0971`: verdict=unsupported
- `2003.07433:7081b6909cb87b58a7b85017a2278275be58bf60`: verdict=unsupported
- `2003.07459:9465d96a1368299fd3662d91aa94ba85347b4ccd`: verdict=unsupported
- `2003.07459:d9949dd4865e79c53284932d868ca8fd10d55e70`: verdict=unsupported
- `2003.07459:d9949dd4865e79c53284932d868ca8fd10d55e70:counterfactual-insufficient`: verdict=unsupported
- `2003.07723:3a9d391d25cde8af3334ac62d478b36b30079d74:counterfactual-insufficient`: verdict=unsupported
- `2003.08385:35b3ce3a7499070e9b280f52e2cb0c29b0745380`: verdict=partial
- `2003.08385:612c3675b6c55b60ae6d24265ed8e20f62cb117e`: verdict=unsupported
- `2003.08385:71ba1b09bb03f5977d790d91702481cc406b3767`: verdict=partial
- `2003.08437:2694a679a703ccd6139897e4d9ff8e053dabd0f2`: verdict=unsupported
- `2003.08769:f3b851c9063192c86a3cc33b2328c02efa41b668`: verdict=unsupported

## Decision Use

Use this export as candidate post-training data, not as a final benchmark score. The important next measurement is whether a student trained or filtered with these labels keeps the precision/support gains without carrying the demo scaffold's per-query token cost.
