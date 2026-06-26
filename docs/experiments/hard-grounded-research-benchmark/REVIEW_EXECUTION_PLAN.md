# Hard Grounded Research Review Execution Plan

This generated plan turns the remaining human review blockers into an executable workload. It does not complete review, adjudicate labels, or clear gold gates.

## Summary

- Plan ready: true
- Version: review-execution-plan-v1
- Rows remaining: 600
- Estimated reviewer hours with reserve: 74.4
- Blocking review checks: 0
- Completion claim allowed: false

## Workload

- Pilot rows remaining: 60
- Expansion rows remaining: 540
- Target reviewed items total: 300
- Target reviewed items per category: 30
- First-wave export rows/files: 160/40

## Effort Estimate

- Minutes per pilot row: 8
- Minutes per expansion row: 6
- Review minutes remaining: 3720
- Adjudication reserve minutes: 744
- Total minutes with reserve: 4464

Estimates cover reading evidence, applying rubric fields, and notes. They are planning estimates, not performance claims.

## Review Waves

| Wave | Scope | Rows remaining | Target items | Acceptance gates |
| --- | --- | --- | --- | --- |
| pilot_triage_completion | pilot_review | 60 | 30 | review_preflight_ready<br>review_merge_ready<br>gold_review_complete |
| expansion_scale_completion | expansion_review | 540 | 270 | expansion_review_preflight_ready<br>expansion_review_merge_ready<br>category_scale_ready |

## Blocking Acceptance Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |

## Quality Controls

| Rule | Threshold | Enforcement |
| --- | --- | --- |
| calibration_before_assignment | reviewer calibration accuracy >= 0.9 | Reviewers who miss calibration sentinels are retrained before receiving benchmark rows. |
| double_blind_overlap | 2 independent reviews for every pilot, expansion, and source-acquisition candidate before promotion | Single-reviewed rows remain in preflight queues and cannot be promoted. |
| citation_support_check | required citation ids must exist and support the final label, not only a nearby fact | Citation id, label, answer, and insufficiency/conflict mismatches go to adjudication or repair. |
| adjudication_sampling | 100% of disagreements plus any invalid/calibration-failed reviewer batch | Adjudication readiness must be regenerated before release after returned labels are imported. |
| agreement_claim_gate | agreement claims require completed reviewer pairs and non-null agreement metrics | The paper must report unavailable agreement as unavailable while reviewer pairs are incomplete. |
