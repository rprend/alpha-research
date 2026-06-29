# OpenAI Boundary Adjudication Probe

Generated: 2026-06-29T19:46:14.257Z

Status: `boundary_adjudication_probe_not_enough`

This capped paid probe asks a model to decide citation include/exclude boundaries on D448 router misses. Fresh eval outputs are diagnostic only.

| Model | Calls | Cost | Exact boundaries | Includes all required | Remaining budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-5.4` | 8 | $0.049100 | 1/8 | 1/8 | $82.045459 |

## Impact Context

- D448 router full-eval correct: 42/64
- Probed router-miss rows: 8
- Full-eval correct if exact boundary labels were safely switched for these rows only: 43/64

## Budget

- Estimated cost: $0.103880
- Run cost: $0.049100
- Total tracked spend: $17.954541 / $100
- OpenAI ledger spend: $12.007441
- External compute spend: $5.947100
- Price source: https://developers.openai.com/api/docs/pricing

## Decision

- Buy more OpenAI boundary labels now: no
- Rent Prime GPU now: no
- Train from fresh eval labels: no
- Reason: Boundary adjudication exactness was 1/8; not strong enough for broader paid labeling or GPU training.
- Next step: Stop broad paid boundary labeling for now; inspect failures and either narrow the prompt further or return to train-only adjudication sources.
