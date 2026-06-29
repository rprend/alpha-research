# Frontier Drift Repair Packet

Generated: 2026-06-29T01:30:08.112Z

Status: `repair_packet_ready_with_quarantine`

## Source Runs

- Drift packet: `frontier-drift-sample-packet-2026-06-29-v2`
- Frontier: `openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v2`
- Judge: `openai-packet-judge-frontier-gpt54-drift-sample-2026-06-29-v2`
- Audit: `frontier-drift-sample-audit-2026-06-29-v2`

## Examples

- Sampled: 60
- Accepted repair candidates: 57
- Quarantined: 3
- Train repair candidates: 28
- Validation repair candidates: 29
- Accepted answer-type changes: 14
- Accepted grounded answers: 18
- Accepted abstentions: 39

## Decision

- Use as full training packet now: no
- Use as repair seed for larger adjudication: yes
- Launch Prime now: no
- Buy more OpenAI judgments now: no
- Reason: The accepted rows prove the repair transform, but a student run should wait for a larger repaired train/validation packet rather than training on a 57-row sample.
