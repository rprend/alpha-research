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
| Train | 52 | 42 | 71.2% | 66.7% | 60.4% | 20.6% | 100.0% | 96.2% | 69.2% |
| Eval | 40 | 31 | 82.5% | 78.0% | 68.5% | 21.0% | 100.0% | 92.5% | 77.5% |

## Eval Policy Mix

- balanced_rubric: 3
- citation_repair: 29
- strict_rubric: 8

## Oracle Headroom

- Target-good rate if an oracle picked any inline-complete good candidate: 92.5%
- Oracle answered examples: 27
- Oracle policy mix: {"balanced_rubric":1,"direct":32,"strict_rubric":7}

This is a calibration experiment, not a final student. It tests whether support labels from one temporal window transfer to routing decisions on the next window.
