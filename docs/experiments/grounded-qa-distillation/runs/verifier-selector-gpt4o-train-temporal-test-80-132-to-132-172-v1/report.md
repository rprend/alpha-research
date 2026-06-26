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
| Train | 52 | 37 | 76.9% | 73.0% | 54.7% | 21.5% | 100.0% | 80.8% | 65.4% |
| Eval | 40 | 28 | 85.0% | 82.7% | 66.7% | 22.9% | 100.0% | 95.0% | 80.0% |

## Eval Policy Mix

- balanced_rubric: 3
- citation_repair: 1
- direct: 33
- strict_rubric: 3

## Oracle Headroom

- Target-good rate if an oracle picked any inline-complete good candidate: 92.5%
- Oracle answered examples: 27
- Oracle policy mix: {"balanced_rubric":1,"direct":32,"strict_rubric":7}

This is a calibration experiment, not a final student. It tests whether support labels from one temporal window transfer to routing decisions on the next window.
