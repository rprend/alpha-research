# Margin-Compatible Heldout NLI

Generated: 2026-06-28T13:24:18.481Z

Status: `heldout_nli_scored`

This run scores the 321-389 heldout packet's candidate-claim units with local NLI only. It makes no OpenAI calls and launches no rented compute.

## Counts

- Heldout pair rows: undefined
- Input NLI units: 211
- Scored NLI units: 211
- Missing or malformed rows: 0

## Decision

- Evaluate frozen D280 next: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The heldout pair packet now has the missing local NLI features needed for a frozen-selector evaluation.
