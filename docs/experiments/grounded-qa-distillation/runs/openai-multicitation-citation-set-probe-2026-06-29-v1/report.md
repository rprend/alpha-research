# OpenAI Multi-Citation Composition Probe

Generated: 2026-06-29T18:49:24.018Z

Status: `multicitation_composition_probe_failed`

This run probes whether a stronger paid teacher can select complete multi-citation evidence sets for D437 validation rows. It is a diagnostic gate before broader paid labels or Prime GPU spend.

| Model | Calls | Cost | Citation exact | Contract correct | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4o` | 15 | $0.044940 | 2/15 | 0/15 | $82.094559 |

## By Target Citation Count

| Target citations | Examples | Citation exact | Contract correct | Mean predicted citations |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 8 | 1 | 0 | 1.25 |
| 3 | 3 | 1 | 0 | 2.00 |
| 4 | 4 | 0 | 0 | 1.75 |

## Budget

- Estimated cost: $0.105277
- Run cost: $0.044940
- Total tracked spend: $17.905441 / $100
- OpenAI ledger spend: $11.958341
- External compute spend: $5.947100

## Decision

- Use frontier teacher for multi-citation labels next: no
- Rent Prime GPU now: no
- Buy more OpenAI labels now: no
- Reason: Frontier probe reached 2/15 exact citation sets; that is not yet strong enough to justify broad paid labeling or GPU training.
- Next step: Audit prompt/evidence mismatch and try a narrower verifier/adjudicator prompt before any Prime GPU rental.
