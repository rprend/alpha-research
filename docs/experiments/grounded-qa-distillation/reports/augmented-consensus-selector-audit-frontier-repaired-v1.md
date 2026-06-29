# Augmented Consensus Selector Audit

Generated: 2026-06-29T09:18:23.666Z

Status: `consensus_selector_ties_augmented_router`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy | Contract correct | Rate |
| --- | ---: | ---: |
| Prior three-system router | 47 / 70 | 67.1% |
| Augmented router | 46 / 70 | 65.7% |
| Consensus selector | 46 / 70 | 65.7% |
| Augmented oracle | 58 / 70 | 82.9% |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote consensus selector: no
- Reason: Train-heldout selected consensus does not beat the augmented router on validation (46/70 vs 46/70).
- Next step: Do not spend on judging. The remaining path is richer support supervision or stronger candidate construction, not shallow consensus rules.
