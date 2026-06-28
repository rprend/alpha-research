# Structural Target Verifier Audit

Generated: 2026-06-28T17:12:19.205Z

Status: `structural_verifier_promotable_as_scaffold_component`

This audit makes no API calls and launches no GPU jobs. It tests deterministic question-requirement parsing, answer slot coverage, and citation-contract features against D309+D313 non-final labels, then reports transfer on the frozen final window.

## Selected Structural Policy

- Policy: strict_citation_slots_t_0p66
- Non-final balanced accuracy: 0.781
- Non-final accuracy: 0.791
- Final pair transfer: 728/865 (84.2%)

## Comparison To D314

- D314 final pair transfer: 69.1%
- Structural final pair transfer delta: 15.0%
- D314 errors rescued: 213
- D314 correct pairs lost: 83

## Decision

- Promote structural verifier now: yes
- Integrate as scaffold component now: yes
- Train student on GPU now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The selected structural policy reaches 78.1% non-final balanced accuracy and 84.2% final transfer, improving final transfer by 15.0% over D314.
- Next step: Integrate the selected structural target-completeness verifier into the answer-selection scaffold and rerun final system evaluation before student training.
