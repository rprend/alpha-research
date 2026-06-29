# OpenAI Multi-Citation Composition Probe

Generated: 2026-06-29T18:47:47.036Z

Status: `multicitation_composition_probe_failed`

This run probes whether a stronger paid teacher can select complete multi-citation evidence sets for D437 validation rows. It is a diagnostic gate before broader paid labels or Prime GPU spend.

| Model | Calls | Cost | Citation exact | Contract correct | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 15 | $0.053200 | 1/15 | 0/15 | $82.139499 |

## By Target Citation Count

| Target citations | Examples | Citation exact | Contract correct | Mean predicted citations |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 8 | 1 | 0 | 1.13 |
| 3 | 3 | 0 | 0 | 1.33 |
| 4 | 4 | 0 | 0 | 2.50 |

## Budget

- Estimated cost: $0.173843
- Run cost: $0.053200
- Total tracked spend: $17.860501 / $100
- OpenAI ledger spend: $11.913401
- External compute spend: $5.947100

## Decision

- Use frontier teacher for multi-citation labels next: no
- Rent Prime GPU now: no
- Buy more OpenAI labels now: no
- Reason: Frontier probe reached 1/15 exact citation sets; that is not yet strong enough to justify broad paid labeling or GPU training.
- Next step: Audit prompt/evidence mismatch and try a narrower verifier/adjudicator prompt before any Prime GPU rental.
