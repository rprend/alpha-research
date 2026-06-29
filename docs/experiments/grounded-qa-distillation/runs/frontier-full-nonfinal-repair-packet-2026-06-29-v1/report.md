# Frontier Drift Repair Packet

Generated: 2026-06-29T01:56:08.826Z

Status: `repair_packet_ready_with_quarantine`

## Source Runs

- Drift packet: `frontier-full-nonfinal-packet-2026-06-29-v1`
- Frontier: `openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1`
- Judge: `openai-packet-judge-frontier-gpt54-full-nonfinal-2026-06-29-v1`
- Audit: `frontier-full-nonfinal-audit-2026-06-29-v1`

## Examples

- Sampled: 315
- Accepted repair candidates: 293
- Quarantined: 22
- Train repair candidates: 223
- Validation repair candidates: 70
- Accepted answer-type changes: 82
- Accepted grounded answers: 134
- Accepted abstentions: 159

## Decision

- Use as full training packet now: yes
- Use as repair seed for larger adjudication: no
- Launch Prime now: no
- Buy more OpenAI judgments now: no
- Reason: The accepted rows cover the nonfinal train/validation distribution well enough to build a repaired launch packet; create a bounded student/scaffold run next, but do not launch Prime from this transform step.
