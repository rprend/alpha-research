# Judge Reliability Second-Pass Plan

Generated: 2026-06-26T19:31:12.956Z

Status: `second_pass_requests_ready_not_run`

Source packet: `judge-adjudication-packet-2026-06-26-v1`

## Blind Protocol

- Original judge verdict hidden: yes
- Request rows: 26
- Estimated second-pass calls: 42
- Planned model: `gpt-4o-mini`

## Budget Gate

| Current actual spend | Estimated second-pass cost | Estimated total after second pass | Within $100 cap |
| ---: | ---: | ---: | --- |
| $5.878324 | $0.014757 | $5.893081 | yes |

## Audit Types

- unsupported_answer: 8
- questionable_abstention: 6
- correct_abstention_sanity_check: 4
- cross_policy_disagreement: 8

## Required Completion Artifacts

- second_pass_results.jsonl with one result per packet_id/case_id
- agreement_report.md with original-vs-second-pass agreement by audit_type
- updated manuscript/risk-audit treatment of model-judged metrics

This plan makes no OpenAI calls, launches no GPU jobs, and records no new spend.
