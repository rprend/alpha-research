# Low-Prior Rescue Packet Audit

Generated: 2026-06-28T15:07:15.061Z

Status: `low_prior_rescue_packet_available_sparse`

This audit mines non-final analogs of the D299 final misses: rows where the supported candidate exists but a chronological source-prior selector would choose the unsupported candidate.

## Temporal Transfer

- Evaluated pairs: 44
- Source-prior correct: 21
- Source-prior accuracy: 47.7%
- Low-prior rescue rows: 23

## Packet

- Rescue rows: 23
- Examples: 22
- Same-citation rows: 9
- Unsupported-longer rows: 0
- Unsupported-claim rows: 20
- Qwen rejected rows: 19

## Final Analogy

- Final misses: 5
- Final misses with supported candidate: 5
- Final misses with Qwen supported candidate: 5

## Decision

- Build low-prior rescue selector next: yes
- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Train or audit a low-prior rescue selector on these non-final rows with preservation/regression controls before touching final labels again.
- Reason: There is a leakage-safe non-final packet for the D299 failure mode, but it is sparse and must be used as a guarded selector diagnostic rather than a promoted policy.
