# Structural Target Transfer Repaired Router Audit

Generated: 2026-06-29T04:08:27.765Z

Status: `structural_transfer_no_switch_or_no_gain`

This audit makes no API calls and launches no GPU jobs. It transfers the selected structural target-completeness verifier onto the current repaired router candidate pool and selects overlay thresholds only on repaired train-heldout rows.

## Selected Structural Verifier

- Policy: strict_citation_slots_t_0p66
- Non-final balanced accuracy: 78.1%
- Frozen final pair transfer: 84.2%

## Metrics

| Split | Source Router | Selected Overlay | Delta | Switches |
| --- | ---: | ---: | ---: | ---: |
| Train heldout | 32/63 | 32/63 | 0 | 0 |
| Repaired validation | 47/70 | 47/70 | 0 | 0 |

## Aggressive Probe

- Train heldout: 31/63, switches 14
- Repaired validation: 42/70, switches 14

## Decision

- Promote overlay now: no
- Buy OpenAI judgments now: no
- Launch Prime now: no
- Reason: Train-heldout selection did not improve the source router, and validation delta is 0.
- Next step: Keep the structural verifier as a diagnostic feature, but do not add the overlay; move to fresher heldout routing labels or better grounded-answer candidate construction.
