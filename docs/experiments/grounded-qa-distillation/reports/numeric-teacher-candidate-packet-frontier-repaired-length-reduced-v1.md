# Numeric Teacher Candidate Length Reduction

Generated: 2026-06-29T07:59:46.334Z

Status: `numeric_teacher_candidate_length_reduced_packet_ready_for_bounded_smoke`

This run makes no OpenAI calls and launches no compute. It rebuilds prompts from structured SFT inputs and clips evidence to remove avoidable length risk.

| Validation errors | Total rows over limit | SFT max | DPO prompt max | DPO full max | Eval max |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 1531 | 991 | 1531 | 641 |

## Decision

- Run launch preflight next: yes
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: This step removes avoidable truncation risk without changing labels or spending compute.
- Next step: Run launch preflight on the length-reduced numeric teacher packet; use its prompt profile for the Prime decision.
