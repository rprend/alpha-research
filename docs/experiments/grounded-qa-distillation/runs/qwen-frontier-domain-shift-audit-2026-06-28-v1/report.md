# Qwen Frontier Domain-Shift Audit

Generated: 2026-06-28T09:53:21.430Z

Status: `domain_shift_confirms_proxy_verifier_failure`

This audit makes no OpenAI calls and launches no compute. It uses final-window labels only as forbidden diagnostic evidence.

| Item | Value |
| --- | ---: |
| Final diagnostic examples | 8 |
| Final selected supported | 3 |
| Final selected unsupported | 5 |
| Final selection support rate | 37.5% |
| Risky positive proxy weights | 3 |

## Miss Tags

- unsupported_candidate_has_more_citations: 3
- inline_contract_not_discriminative: 5
- longer_unsupported_answer_ranked_high: 1
- supported_short_answer_penalized: 3
- surface_overlap_rewards_unsupported: 4
- unsupported_number_not_penalized: 3
- family_or_curriculum_domain_shift: 3

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The failed final selections are explained by proxy features that reward citation count, numeric claims, or longer answers without proving support.
- Next step: Build a semantic support verifier target from non-final claim-level support labels or a small non-final adjudication batch; do not run more generator-only GPU jobs.
