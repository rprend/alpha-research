# Verifier Selector

## Setup

- Split: `temporal_test`
- Train window: offset 80, 52 examples
- Eval window: offset 132, 40 examples
- LLM calls: 0
- Run cost: $0.0000000

The verifier is trained only from existing candidate predictions and judge labels. The target is candidate-level correctness: judge-correct and answer-type-correct.

## Result

| Split | Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Inherited judged correct | Target-good |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 52 | 36 | 78.8% | 77.8% | 59.5% | 21.1% | 100.0% | 98.1% | 76.9% |
| Eval | 40 | 25 | 82.5% | 84.7% | 61.3% | 20.7% | 100.0% | 97.5% | 80.0% |

## Eval Policy Mix

- balanced_rubric: 2
- citation_repair: 24
- strict_rubric: 14

## Oracle Headroom

- Target-good rate if an oracle picked any inline-complete good candidate: 92.5%
- Oracle answered examples: 27
- Oracle policy mix: {"balanced_rubric":1,"direct":32,"strict_rubric":7}

This is a calibration experiment, not a final student. It tests whether support labels from one temporal window transfer to routing decisions on the next window.
