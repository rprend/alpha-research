# Teacher-Label Scaffold V1

## Setup

- Teacher label packet: `teacher-repair-temporal-test-0-132-v1`
- Accepted teacher labels: 109
- Answer labels: 48
- Abstention labels: 61
- Held-out slice: `temporal_test` examples 133-172
- Selected sufficiency threshold: 0.85
- LLM calls: 0

## Held-Out Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Teacher-label scaffold | 5 | 35 | 42.5% | 90.0% | 6.5% | 4.1% | 100.0% |

This scaffold is trained only from the judge-filtered repaired-teacher labels. It is a true amortized zero-LLM policy, but it can only extract spans from retrieved evidence and does not have generative paraphrasing ability.
