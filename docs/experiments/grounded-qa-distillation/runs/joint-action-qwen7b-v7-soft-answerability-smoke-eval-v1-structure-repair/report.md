# Qwen Structure And Citation Repair

## Setup

- Source run: `joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1`
- Packet run: `joint-action-gpu-prep-qwen7b-soft-answerability-construction-curriculum-v7`
- Base model: `Qwen/Qwen2.5-7B-Instruct`
- OpenAI calls: 0
- External compute: $0.0000

## Metrics

| Surface | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Source | 33 | 47.8% | 33.3% | 19.9% | 10.5% | 24.2% |
| Structure repair | 63 | 91.3% | 46.6% | 63.1% | 35.0% | 100.0% |

## Repair Summary

| Source parse errors | Recovered from raw | Answer type changed | Answer changed | Citations changed | Invalid citations dropped | Inline citations repaired |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 36 | 39 | 30 | 57 | 41 | 2 | 57 |

This local repair recovers structure and citation syntax only. It does not prove answer support and should be judged before support claims.
