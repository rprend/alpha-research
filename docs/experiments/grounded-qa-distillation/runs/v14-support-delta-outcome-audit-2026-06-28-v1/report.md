# V14 Support-Delta Outcome Audit

Generated: 2026-06-28T07:10:24.683Z

Status: `v14_small_selector_signal_not_launch_ready`

This run makes no OpenAI calls and launches no compute. It joins the v14 predictions, paid v14 judgments, the v14 contract audit, the v13 delta audit, the Qwen-only diagnostic, and the calibrated hybrid selector.

## Metrics

| Policy | Answered | Supported answers | Answer support | Overall correct |
| --- | ---: | ---: | ---: | ---: |
| V14 standalone | 51 | 20 | 39.2% | 55.1% |
| V13 standalone | 52 | 21 | 40.4% | 55.1% |
| Qwen-only heuristic | 38 | 25 | 65.8% | 81.2% |
| Qwen-only oracle | 35 | 35 | 100.0% | 100.0% |
| Scaffold priority | 42 | 31 | 73.8% | 82.6% |
| Calibrated hybrid | 49 | 35 | 71.4% | 79.7% |
| Scaffold + v14 answer-citation gate | 47 | 33 | 70.2% | 79.7% |
| Hybrid + v14 answer-citation gate | 52 | 35 | 67.3% | 75.4% |

## Support Delta

- V14 non-counterfactual supported answers: 16
- V13 non-counterfactual supported answers: 17
- V14 supported answers not in V13: 3
- V14 supported answers not in prior Qwen-only oracle: 0
- Prior Qwen-only oracle supported answers not reproduced by V14: 19
- V14 answer-citation-complete hard negatives: 24
- V14 counterfactual answered rows: 16

## Selector Delta

- Scaffold + v14 gate supported-answer delta: +2
- Scaffold + v14 gate answered delta: +5
- Scaffold + v14 oracle supported-answer delta: +2
- Hybrid + v14 gate supported-answer delta: +0
- Hybrid + v14 gate answered delta: +3
- Hybrid + v14 oracle supported-answer delta: +0

## Next Signal

Do not launch another GPU job from this result alone. V14 should be treated as a source of supported positives and hard negatives for a verifier or repair-generator target, not as a deployable generator.
