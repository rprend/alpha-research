# Abstention Boundary Listwise Packet

Generated: 2026-06-28T20:55:34.852Z

Status: `abstention_boundary_packet_ready_for_listwise_audit`

This packet makes no OpenAI calls and launches no compute.

## Examples

- Boundary pairs: 40
- Train pairs: 22
- Validation pairs: 18
- Unique examples: 40

## Contrast Counts

- prefer_supported_abstention_over_unsupported_answer: 21
- both_supported_answer_preferred_for_coverage: 15
- prefer_supported_answer_over_unsupported_abstention: 2
- both_unsupported_prefer_abstention_safety: 2

## Decision

- Merge into listwise packet now: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The packet converts already-paid direct/risk-gate judgments into answer/abstain boundary supervision without new model calls.
- Next step: Rerun the listwise supervision audit with this abstention-boundary packet included.
