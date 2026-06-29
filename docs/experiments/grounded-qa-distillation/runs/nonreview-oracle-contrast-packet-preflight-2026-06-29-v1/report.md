# Non-Review Oracle Contrast Packet Preflight

Generated: 2026-06-29T17:52:28.721Z

Status: `nonreview_packet_preflight_passed`

This local preflight checks the D437 packet before any student training or GPU spend.

## Shape

- SFT rows: 173
- DPO rows: 131
- Eval prompts/targets: 64/64
- SFT evidence-first valid: 173/173
- DPO chosen evidence-first valid: 131/131
- DPO chosen differs from rejected: 131/131

## Prompt Length

- Max prompt chars: 8627
- P95 prompt chars: 6640
- Over limit (12000): 0

## Fixture Gate

- Oracle fixture overall contract: 100.0%

## Decision

- Run bounded student smoke next: yes
- Launch Prime now: no
- Buy more OpenAI labels now: no
- Reason: Packet passed shape, prompt-length, and oracle-fixture gates; max prompt is 8627 chars.
- Next step: Prepare a bounded local or Prime smoke plan with explicit estimated cost before launch.
