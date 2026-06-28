# V13 Coverage-Gap Delta

Generated: 2026-06-28T06:16:37.103Z

Status: `v13_no_gap_fill_negative`

This run makes no OpenAI calls and launches no compute. It joins the v13 predictions, paid v13 judgments, the v13 contract audit, the qwen-only amortization diagnostic, and the calibrated hybrid selector.

## Metrics

| Policy | Answered | Supported answers | Answer support | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| V13 standalone | 52 | 21 | 40.4% | 55.1% |
| Qwen-only heuristic | 38 | 25 | 65.8% | 81.2% |
| Qwen-only oracle | 35 | 35 | 100.0% | 100.0% |
| Scaffold priority | 42 | 31 | 73.8% | 82.6% |
| Calibrated hybrid | 49 | 35 | 71.4% | 79.7% |
| Scaffold + v13 answer-citation gate | 45 | 33 | 73.3% | 82.6% |
| Scaffold + v13 oracle | 44 | 33 | 75.0% | 84.1% |

## Targeted Coverage Gaps

| Targeted gaps | V13 answered | V13 supported | New supported gaps | Unsupported answered gaps |
| ---: | ---: | ---: | ---: | ---: |
| 9 | 5 | 0 | 0 | 5 |

New supported gap ids: none

Repeated supported gap ids: none

## Candidate Delta

- V13 supported answers not in the prior Qwen-only oracle: 0
- Prior Qwen-only oracle supported answers not reproduced by V13: 18
- Scaffold abstentions where V13 supplies a supported answer: 2
- Scaffold + V13 oracle supported-answer delta: +2
- Scaffold + V13 answer-citation gate supported-answer delta: +2

## Next Packet Signal

Do not launch another GPU job from this result alone. Use the supported, citation-complete V13 rows as positives and the answer-citation-complete unsupported rows as hard negatives, then rebuild the training target around row-level support deltas rather than aggregate answer coverage.
