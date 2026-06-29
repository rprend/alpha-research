# Augmented Router Selection Failure Audit

Generated: 2026-06-29T09:12:26.227Z

Status: `answer_override_hurts_augmented_router`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Prior three-system router | 47 / 70 | 67.1% |
| Augmented router | 46 / 70 | 65.7% |
| Answer-override overlay | 43 / 70 | 61.4% |
| Augmented pool oracle | 58 / 70 | 82.9% |

## Failure Shape

- Validation recoverable misses: 15
- Validation irrecoverable misses: 12
- Remaining gap to augmented oracle: 15

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote answer override: no
- Reason: The best train-heldout selected answer override does not improve validation (43/70 vs 46/70), so the added oracle headroom is not recoverable with this simple calibrated override.
- Next step: Use the failure rows to build richer candidate-support supervision or improve constructor precision; do not spend on judging or GPU until selection improves without validation leakage.
