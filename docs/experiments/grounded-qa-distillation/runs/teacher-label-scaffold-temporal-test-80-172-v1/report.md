# Teacher-Label Scaffold V1

## Setup

- Teacher label packet: `teacher-repair-temporal-test-0-80-v1`
- Accepted teacher labels: 65
- Answer labels: 29
- Abstention labels: 36
- Held-out slice: `temporal_test` examples 81-172
- Selected sufficiency threshold: 0.85
- LLM calls: 0

## Held-Out Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Teacher-label scaffold | 22 | 70 | 48.9% | 56.8% | 10.9% | 3.3% | 100.0% |

This scaffold is trained only from the judge-filtered repaired-teacher labels. It is a true amortized zero-LLM policy, but it can only extract spans from retrieved evidence and does not have generative paraphrasing ability.
