# Non-Review Claim-Coverage Group Scaffold

Generated: 2026-06-29T19:11:05.059Z

Status: `claim_coverage_group_scaffold_below_d440`

This zero-spend run trains a grouped evidence selector on D437 train rows, calibrates on D437 SFT validation, and evaluates only the D437 fresh non-review eval split.

## Fresh Eval

- Eval examples: 64
- Predictions: 40 grounded, 24 abstain
- Mean citations when grounded: 1.27
- Overall contract correct: 60.9%
- Citation-set exact: 60.9%
- Multi-citation exact: 3/14

## Baselines

- D440 citation selector: 64.1%
- D442 subset selector: 62.5%
- Structured-group non-review baseline: 73.4%
- Four-source non-review oracle: 89.1%

## Decision

- Promote as current best scaffold: no
- Keep as candidate source: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Fresh contract correctness is 39/64; multi-citation exact is 3/14.
- Next step: Use this as a candidate source in a non-review router audit and analyze remaining multi-citation misses.
