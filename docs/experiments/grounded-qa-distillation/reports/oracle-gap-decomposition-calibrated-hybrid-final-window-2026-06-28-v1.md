# Oracle Gap Decomposition

Status: `selector_oracle_gap_small_generation_gap_primary`

This run makes no OpenAI calls and launches no Prime job.

## Baseline vs Oracle

| Policy | Answer rate | Answer support | Overall judged correctness | Supported answers |
| --- | ---: | ---: | ---: | ---: |
| Scaffold priority | 60.9% | 73.8% | 82.6% | 31 |
| Calibrated hybrid | 71.0% | 71.4% | 79.7% | 35 |
| Qwen switch oracle | 72.5% | 78.0% | 84.1% | 39 |

## Aggregate

- Oracle net judged-correct lift over calibrated hybrid: 3
- Oracle gains / losses: 3 / 0
- Oracle supported-answer lift: 4
- Calibrated misses with any supported answer candidate: 4
- Calibrated misses with a Qwen supported answer candidate: 4
- Heuristic top candidate judged-correct rate: 53.6%
- Heuristic top candidate supported-answer rate when support exists: 77.8%

## Gap Buckets

| Bucket | Rows | Share |
| --- | ---: | ---: |
| both_correct | 55 | 79.7% |
| candidate_generation_gap | 10 | 14.5% |
| local_score_cannot_rank_supported_candidate | 2 | 2.9% |
| selector_missed_supported_answer_over_unsupported_answer | 2 | 2.9% |

## Decision

- Rent GPU now: no
- Buy more OpenAI labels now: no
- Train selector now: no
- Next step: Do not spend on a selector-only GPU run. Build the next zero/low-cost packet around support-preserving candidate generation or repair, and only rent Prime once a generator packet can plausibly add more supported answer candidates beyond the small oracle gap.
- Reason: The oracle selector headroom over the calibrated hybrid is only three net judged-correct rows on the final window, and existing local heuristic/ranker signals fail to identify supported candidates reliably enough. Selector work alone is unlikely to produce a NeurIPS-grade result.
