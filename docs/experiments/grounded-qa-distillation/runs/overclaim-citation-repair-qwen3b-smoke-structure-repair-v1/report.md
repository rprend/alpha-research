# Qwen Structure And Citation Repair

## Setup

- Source run: `overclaim-citation-repair-qwen3b-smoke-v1`
- Packet run: `overclaim-citation-repair-launch-packet-2026-06-28-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- OpenAI calls: 0
- External compute: $0.0000

## Metrics

| Surface | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Source | 6 | 60.0% | 0.0% | 0.0% | 14.3% | 0.0% |
| Structure repair | 1 | 10.0% | 40.0% | 14.3% | 0.0% | 100.0% |

## Repair Summary

| Source parse errors | Recovered from raw | Answer type changed | Answer changed | Citations changed | Invalid citations dropped | Inline citations repaired |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 5 | 6 | 1 | 1 | 5 |

This local repair recovers structure and citation syntax only. It does not prove answer support and should be judged before support claims.
