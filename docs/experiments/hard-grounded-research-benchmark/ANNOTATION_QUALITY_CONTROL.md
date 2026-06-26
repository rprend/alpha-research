# Hard Grounded Research Annotation Quality Control

This generated plan defines the quality-control rules for collecting labels. It is not evidence that review is complete; it is the pre-registered acceptance policy that returned labels must satisfy before gold promotion or paper claims.

## Summary

- Quality-control plan ready: true
- Completion claim allowed: false
- Required reviews per item: 2
- Minimum calibration accuracy: 0.9
- Allow sentinel rows in gold: false
- Allow gold without completed preflight: false

## Workload

| Field | Value |
| --- | --- |
| categories | 10 |
| exported_review_rows | 124 |
| pilot_review_rows | 60 |
| expansion_review_rows | 540 |
| source_acquisition_review_rows | 492 |
| total_review_rows | 1092 |
| blind_overlap_rows | 124 |
| calibration_sentinels | 10 |
| sentinel_insertion_rate | 0.0092 |

## Quality Rules

| Rule | Threshold | Enforcement |
| --- | --- | --- |
| calibration_before_assignment | reviewer calibration accuracy >= 0.9 | Reviewers who miss calibration sentinels are retrained before receiving benchmark rows. |
| double_blind_overlap | 2 independent reviews for every pilot, expansion, and source-acquisition candidate before promotion | Single-reviewed rows remain in preflight queues and cannot be promoted. |
| citation_support_check | required citation ids must exist and support the final label, not only a nearby fact | Citation id, label, answer, and insufficiency/conflict mismatches go to adjudication or repair. |
| adjudication_sampling | 100% of disagreements plus any invalid/calibration-failed reviewer batch | Adjudication readiness must be regenerated before release after returned labels are imported. |
| agreement_claim_gate | agreement claims require completed reviewer pairs and non-null agreement metrics | The paper must report unavailable agreement as unavailable while reviewer pairs are incomplete. |
