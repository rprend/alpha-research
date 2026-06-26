# Teacher Label Export V1

## Setup

- Teacher runs: `citation-contract-repair-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1`
- Judge runs: `openai-judge-gpt4o-citation-contract-repair-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1`
- Extra upstream cost runs: `openai-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1`
- Split: `temporal_test`
- Accepted SFT labels: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1.sft.jsonl`
- Rejected audit rows: `docs/experiments/grounded-qa-distillation/exports/teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1.rejected.jsonl`

## Label Quality

| Examples seen | Accepted | Rejected | Acceptance rate | Accepted answered | Accepted abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 33 | 7 | 82.5% | 17 | 16 |

The quality filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. It accepts abstentions only when the judge marks the abstention supported and the label cites no evidence.

## Amortization

| Component | Cost |
| --- | ---: |
| Teacher/source runs, including extra upstream cost runs | $0.0789950 |
| Judge runs | $0.0717800 |
| Total offline labeling | $0.1507750 |
| Direct mini student per query | $0.0002302 |
| Demo scaffold per query | $0.0009424 |

The offline label packet breaks even against the in-context demo scaffold after about 212 future queries if post-training preserves the direct mini student's inference cost. This is an accounting result, not a quality result: the next experiment still needs to train or fit a compact student/filter on these labels and evaluate held-out grounded correctness.

## Rejections

- `1911.04873:e862ebfdb1b3425af65fec81c8984edca6f89a76`: verdict=unsupported
- `1912.02866:20632fc4d2b693b5aabfbbc99ee5c1e9fc485dea`: verdict=partial
- `1912.02866:fff1ed2435ba622d884ecde377ff2de127167638`: verdict=unsupported
- `2003.11687:f5603271a04452cbdbb07697859bef2a2030d75c`: verdict=unsupported
- `2004.01820:235c7c7ca719068136928b18e19f9661e0f72806`: verdict=unsupported
- `2004.04124:5ed02ae6c534cd49d405489990f0e4ba0330ff1b`: verdict=unsupported
- `2004.04124:935873b97872820b7b6100d6a785fba286b94900`: verdict=unsupported

## Decision Use

Use this export as candidate post-training data, not as a final benchmark score. The important next measurement is whether a student trained or filtered with these labels keeps the precision/support gains without carrying the demo scaffold's per-query token cost.
