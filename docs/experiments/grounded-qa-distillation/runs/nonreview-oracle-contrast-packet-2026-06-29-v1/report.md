# Non-Review Oracle Contrast Packet

Generated: 2026-06-29T17:45:34.695Z

Status: `nonreview_oracle_contrast_packet_ready`

This packet is a post-training data artifact, not a model run. It packages four-source oracle-correct non-review candidates as SFT targets and DPO preferences while preserving fresh non-review rows for evaluation only.

## Metrics

- SFT train: 113
- SFT validation: 60
- DPO train: 84
- DPO validation: 47
- Fresh eval prompts: 64
- Train oracle coverage: 113/160
- Validation oracle coverage: 60/80

## Decision

- Keep packet for next student: yes
- Train student now: no
- Rent Prime GPU now: no
- Buy more OpenAI labels now: no
- Reason: Packet has 113 SFT train rows, 84 DPO train rows, and 64 fresh eval prompts.
- Next step: Run a local/cheap preflight that checks fixture contract correctness and prompt length before deciding whether a bounded GPU smoke is justified.
