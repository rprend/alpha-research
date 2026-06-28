# Mined Overclaim/Citation Probe

Generated: 2026-06-28T22:07:02.819Z

Status: `mined_overclaim_citation_probe_overfits_nonfinal`

This probe makes no API calls and launches no compute. It selects on mined non-final validation rows and uses final-window rows only for reporting transfer.

## Data

- Train pairs: 64
- Validation pairs: 32
- Final reporting pairs: 65
- Policies evaluated: 51

## Selected Policy

- Policy: `logreg_lr_0p08_l2_0_e_320`
- Validation accuracy: 78.1%
- Final reporting accuracy: 47.7%
- Diagnostic best-final accuracy: 50.8%

## Decision

- Integrate selector next: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Validation-selected policy does not transfer strongly enough: validation 0.781, final reporting 0.477; diagnostic best-final 0.508 is reporting-only.
- Next step: Do not spend yet; inspect mined-packet failure mix and consider a richer text/verifier model only if it can be evaluated without final-label leakage.
