# Overclaim/Citation Packet

Generated: 2026-06-28T21:57:43.268Z

Status: `overclaim_citation_packet_too_small_for_probe`

This packet makes no API calls and launches no compute. It converts D349 adjudications into a narrower preference dataset focused on overclaiming and citation mismatch.

## Data

- Non-final target rows: 21
- Train DPO rows: 13
- Validation DPO rows: 8
- Final reporting rows: 9
- Non-final failure modes: {"citation_mismatch":5,"overbroad_or_overclaimed":16}
- Final reporting failure modes: {"overbroad_or_overclaimed":9}

## Decision

- Run zero-cost probe next: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The packet is too small for a meaningful probe.
- Next step: Mine additional non-final overclaim/citation-mismatch rows before spending.
