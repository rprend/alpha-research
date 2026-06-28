# Final Margin-Compatible Heldout Packet

Generated: 2026-06-28T13:16:46.088Z

Status: `ready_for_frozen_selector_nli_and_eval`

This packet makes no API calls. It converts existing judged 321-389 prediction-family contrasts into a D280-compatible heldout pair packet.

## Counts

- Heldout pair rows: 865
- Examples with pairs: 49
- Required claim-NLI units: 987
- Exact duplicate pairs excluded upstream: 26

## Decision

- Score local NLI next: yes
- Evaluate frozen D280 next: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: Existing judged final-window prediction families provide a large non-duplicate answer-contrast heldout for frozen selector replay.
