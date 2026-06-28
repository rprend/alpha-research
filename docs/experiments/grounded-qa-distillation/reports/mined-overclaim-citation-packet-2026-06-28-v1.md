# Mined Overclaim/Citation Packet

Generated: 2026-06-28T22:05:11.182Z

Status: `mined_overclaim_citation_packet_ready_for_probe`

This packet makes no API calls and launches no compute. It mines existing judged non-final contrast pools after D351 found the targeted paid slice too small.

## Data

- Raw candidates: 208
- Deduped candidates: 119
- Selected candidates: 96
- Train DPO rows: 64
- Validation DPO rows: 32
- Failure modes: {"citation_mismatch":48,"numeric_or_comparison_overclaim":26,"overbroad_or_overclaimed":22}
- Sources: {"qwen-frontier-pool-support-packet-2026-06-28-v1":45,"overclaim-citation-packet-from-high-score-support-labels-2026-06-28-v1":6,"support-ranker-pairwise-packet-expanded-2026-06-28-v1":45}

## Decision

- Run zero-cost probe next: yes
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The mined packet is large enough for a local verifier/selector probe before any paid work.
- Next step: Run a zero-cost overclaim/citation transfer probe over this mined packet.
