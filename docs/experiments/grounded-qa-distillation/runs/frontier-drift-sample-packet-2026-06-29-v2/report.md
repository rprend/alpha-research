# Frontier Drift Sample Packet

Generated: 2026-06-29T01:24:28.778Z

Status: `drift_sample_packet_ready_for_frontier_teacher`

Source packet: `evidence-first-targeted-contract-packet-2026-06-29-v1`

## Selection

- Examples: 60
- Train: 15 grounded answers, 15 abstentions
- Validation: 15 grounded answers, 15 abstentions
- Policy: deterministic interleaved sample, balanced across grounded_answer and abstain within each split

## Decision

- Run frontier teacher next: yes
- Run packet-local judge next: yes
- Launch Prime now: no
- Reason: The 10-row diagnostic target was repaired, but train/validation labels remain un-audited for over-answering relative to compact evidence packs.
