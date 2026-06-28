# Stratified Support Verifier Audit

This audit tests whether separate broad-preservation and targeted-hard-negative objectives resolve the D360 validation conflict.

| Policy | Validation | Broad validation | Targeted validation | Final diagnostic |
| --- | ---: | ---: | ---: | ---: |
| broad_only | 7.3% | 4.2% | 11.8% | 5/8 |
| targeted_only | 46.3% | 16.7% | 88.2% | 6/8 |
| source_stratified | 39.0% | 4.2% | 88.2% | 5/8 |

## Decision

The validation-selected targeted_only policy reaches 46.3% validation accuracy and 75.0% final diagnostic selection support, so the objective conflict is not resolved.

Next step: Stop local feature-only verifier work for this slice; either construct stronger semantic labels for broad preservation or use the targeted packet as a diagnostic ablation rather than a selector.
