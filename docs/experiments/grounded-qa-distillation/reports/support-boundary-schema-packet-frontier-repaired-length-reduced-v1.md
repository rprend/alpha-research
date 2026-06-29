# Targeted Grounded Construction Length Reduction

Generated: 2026-06-29T07:07:24.788Z

Status: `targeted_grounded_construction_length_reduced_packet_ready_for_bounded_smoke`

This audit makes no API calls and launches no GPU jobs.

## Length Profile

| Surface | Rows | p50 approx tok. | p95 approx tok. | Max approx tok. | Rows over limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT full | 293 | 865 | 1368 | 1684 | 0 |
| DPO prompt | 979 | 698 | 1005 | 1160 | 0 |
| DPO full | 1958 | 902 | 1368 | 1684 | 0 |
| Eval prompt | 10 | 615 | 820 | 820 | 0 |

Total rows over limit: 0

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Run launch preflight next: yes
- Reason: This step removes avoidable prompt-length risk without changing labels or spending compute.
- Next step: Run launch preflight on the length-reduced packet; use its prompt profile for the next Prime decision.
