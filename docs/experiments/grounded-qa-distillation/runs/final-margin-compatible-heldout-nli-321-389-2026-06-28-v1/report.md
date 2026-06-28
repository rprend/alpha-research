# Margin-Compatible Heldout NLI

Generated: 2026-06-28T13:17:15.241Z

Status: `heldout_nli_scored`

This run scores the 321-389 heldout packet's candidate-claim units with local NLI only. It makes no OpenAI calls and launches no rented compute.

## Counts

- Heldout pair rows: 865
- Input NLI units: 987
- Scored NLI units: 987
- Missing or malformed rows: 0

## Decision

- Evaluate frozen D280 next: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The heldout pair packet now has the missing local NLI features needed for a frozen-selector evaluation.
