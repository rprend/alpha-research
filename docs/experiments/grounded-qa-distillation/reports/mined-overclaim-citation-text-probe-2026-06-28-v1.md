# Mined Overclaim/Citation Text Probe

Generated: 2026-06-28T22:08:59.339Z

Status: `mined_overclaim_citation_text_probe_overfits_nonfinal`

This probe makes no API calls and launches no compute. The vocabulary is learned only from non-final train rows.

## Data

- Train pairs: 64
- Validation pairs: 32
- Final reporting pairs: 65
- Vocabulary size: 180
- Policies evaluated: 48

## Selected Policy

- Policy: `text_logreg_lr_0p08_l2_0_e_320`
- Validation accuracy: 87.5%
- Final reporting accuracy: 49.2%
- Surface final reporting accuracy: 47.7%

## Decision

- Integrate text verifier next: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The lexical verifier still fails transfer: validation 0.875, final reporting 0.492, versus surface final 0.477.
- Next step: Stop selector-only work for this failure slice; the next useful move is targeted data generation or a small paid adjudication batch with stronger final-like sampling.
