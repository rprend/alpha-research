# Evidence-First Targeted Contract Packet

Generated: 2026-06-29T00:20:09.898Z

Status: `evidence_first_targeted_packet_ready_for_launch_packet`

## Source

- Source packet: `evidence-first-contract-packet-2026-06-28-v1`
- Repair audit: `evidence-first-contract-repair-audit-qwen3b-smoke-v1`
- Repair audit status: `repair_recovers_syntax_not_correctness`

## Construction

- Target simplification: Grounded answers are rewritten as short claim text plus inline citations derived from supported_claims; abstentions remain explicit insufficient-support outputs.
- Augmented train rows: 951
- Augmented validation rows: 297
- Final diagnostic targets used for training: no

## Data

- SFT train: 240
- SFT validation: 75
- DPO train: 1999
- DPO validation: 617
- Eval prompts: 10
- Eval targets: 10

## Validation

- Checked SFT rows: 315
- Checked DPO preferences: 2616
- Checked eval targets: 10
- Error count: 0

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Materialize launch packet next: yes
- Reason: The packet is valid and targets the failure modes from D368, but it still needs a launch-packet preflight before any paid Prime run.
