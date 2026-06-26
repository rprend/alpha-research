# Teacher-Label Filter V1

## Setup

- Student run: `openai-student-temporal-test-full-v1`
- Judge run for kept direct answers: `openai-judge-student-temporal-test-full-v1`
- Teacher label packet: `teacher-repair-temporal-test-0-80-v1`
- Training slice: first 80 `temporal_test` examples
- Training examples used: 52 direct grounded-answer predictions
- Held-out slice: `temporal_test` examples 81-172
- Selected keep threshold: 0.15

The filter is a local logistic gate over the direct mini student's output. It does not call an LLM and cannot generate missing answers; it only keeps grounded answers or converts them to abstentions.

## Held-Out Result

| Policy | Answered | Forced abstentions | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Kept-answer support | Hybrid support/gold-abstention |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini student | 65 | 0 | 80.4% | 76.9% | 63.5% | 22.6% | 82.1% | 92.3% | 84.8% |
| Teacher-label filter | 58 | 7 | 77.2% | 78.4% | 56.5% | 19.8% | 92.0% | 91.4% | 79.3% |

The hybrid support/gold-abstention metric uses the existing LLM judge for kept direct answers and the gold insufficient-evidence label for abstentions. It is not a replacement for judging the filtered abstentions, but it is a zero-cost screening metric for whether the local filter is moving in the right direction.

## Interpretation

This is an offline policy test, not a final student. If the filter improves support by over-abstaining, the next step is to train a generator on the accepted teacher labels rather than shipping the gate. If it hurts both support and answer coverage, the strict label packet needs more examples or a better teacher repair rule before post-training.
