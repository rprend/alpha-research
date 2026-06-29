# Broad Sufficiency Headroom Audit

Generated: 2026-06-29T08:51:34.153Z

Status: `sufficiency_diagnostic_does_not_transfer_candidate_construction_gap_dominates`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | 39 / 70 | 55.7% |
| D411 narrow sufficiency transfer | 39 / 70 | 55.7% |
| Current train-supervised router | 47 / 70 | 67.1% |
| Existing candidate-pool oracle | 54 / 70 | 77.1% |

## Headroom

- Recoverable by rerouting existing candidates: 7
- Irrecoverable inside current candidate pool: 16
- Grounded candidate-construction gaps: 16
- Abstention candidate-construction gaps: 0

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote narrow sufficiency rule: no
- Candidate construction required: yes
- Reason: The D411-style narrow sufficiency rule scores 39/70 on the broad repaired-validation gate, tying the abstention prior, while the current router is 47/70 and the existing candidate-pool oracle is only 54/70.
- Next step: Build a broader sufficiency-first constructor that creates new grounded candidates from evidence, then evaluate it against the 70-row gate before spending on Prime or paid judging.
