# Verifier Selector

## Setup

- Split: `extended_temporal_future_holdout`
- Train window: offset 0, 80 examples
- Eval window: offset 80, 80 examples
- LLM calls: 0
- Run cost: $0.0000000

The verifier is trained only from existing candidate predictions and judge labels. The target is candidate-level correctness: judge-correct and answer-type-correct.

## Result

| Split | Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Inherited judged correct | Target-good |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 80 | 64 | 75.0% | 65.1% | 68.1% | 25.6% | 100.0% | 73.8% | 57.5% |
| Eval | 80 | 56 | 88.8% | 70.5% | 73.0% | 24.6% | 100.0% | 77.5% | 70.0% |

## Eval Policy Mix

- balanced_rubric: 9
- direct: 71

## Oracle Headroom

- Target-good rate if an oracle picked any inline-complete good candidate: 78.8%
- Oracle answered examples: 55
- Oracle policy mix: {"balanced_rubric":8,"direct":72}

This is a calibration experiment, not a final student. It tests whether support labels from one temporal window transfer to routing decisions on the next window.
