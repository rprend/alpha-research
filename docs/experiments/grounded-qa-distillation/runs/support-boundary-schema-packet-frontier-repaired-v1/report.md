# Support Boundary Schema Packet

Generated: 2026-06-29T07:06:44.973Z

Status: `support_boundary_schema_packet_ready_for_preflight`

This packet makes no OpenAI calls and launches no compute.

## Construction

- Added DPO train rows: 342
- Added DPO validation rows: 113
- Added preference types: {"prefer_contract_abstention_over_cited_abstention_rationale":159,"prefer_abstention_over_misclassified_partial_answer":28,"prefer_grounded_evidence_first_over_empty_claims":134,"prefer_supported_answer_over_false_insufficiency":134}
- Eval prompts preserved: yes
- Eval targets preserved: yes

## Examples

- SFT train: 223
- SFT validation: 70
- DPO train: 734
- DPO validation: 245
- Eval prompts: 10
- Eval targets: 10

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Run launch preflight next: yes
- Reason: This packet targets the observed post-smoke contract failures directly instead of adding another selector over the same weak candidate surface.
- Next step: Run launch preflight and length profile. Only consider a bounded Prime smoke if the packet remains under budget and the prompt-length risk is acceptable.
