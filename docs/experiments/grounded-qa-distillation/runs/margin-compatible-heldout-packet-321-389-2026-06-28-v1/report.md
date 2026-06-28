# Margin-Compatible Heldout Packet

Generated: 2026-06-28T13:10:21.828Z

Status: `no_heldout_pair_signal`

This packet makes no OpenAI calls and launches no compute. It converts existing 321-389 direct/risk/guard judgments into heldout-only pair rows with the same claim-NLI key surface used by the D280 hard-negative selector.

## Counts

- Window examples: 69
- Support labels: 207
- Raw supported-vs-unsupported pairs: 20
- Exact duplicate pairs removed: 20
- Heldout pair rows: 0
- Required claim-NLI units: 0
- Missing from existing claim-NLI cache: 0

## Decision

- Score local NLI next: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Promote D280 now: no
- Reason: All supported-vs-unsupported answer contrasts are exact duplicate candidate texts, so they cannot validate a feature-based margin selector.
