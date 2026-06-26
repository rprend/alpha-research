# Hard Grounded Research Submission Contract

This generated contract defines the external model prediction format and validation policy for the benchmark. It is a reproducibility artifact, not permission to publish a leaderboard while review and novelty gates remain incomplete.

## Summary

- Submission contract ready: true
- Version: submission-contract-v1
- Public leaderboard allowed: false
- Completion claim allowed: false
- Baseline packet count: 2

## Scoring Sources

| Source | Path | Tasks | Leaderboard allowed |
| --- | --- | --- | --- |
| pilot | generated/pilot-suite.json | 30 | false |
| gold | generated/gold-suite.json | 0 | false |

## Answer Fields

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| task_id | string | yes | Must match exactly one released task id. |
| answer | string | yes | Natural language final answer or ABSTAIN. |
| citations | array<string> | yes | Citation ids must come from the task evidence units; empty only for abstention or invalid output. |
| abstained | boolean | yes | True only when the system intentionally refuses to answer due to insufficient or conflicting evidence. |
| confidence | number | no | Optional calibrated confidence in [0, 1]. |
| evidence_assessment | string | yes | Short explanation of why the cited evidence supports the answer or why evidence is insufficient. |

## Validation Rules

| # | Rule |
| --- | --- |
| 1 | Reject submissions with missing task ids, duplicate task ids, or task ids outside the scoring source. |
| 2 | Reject citation ids that are not present in the corresponding task evidence units. |
| 3 | Allow abstention with empty citations only when evidence_assessment explains insufficiency or conflict. |
| 4 | Score parse failures as invalid model outputs, not as missing benchmark labels. |
| 5 | Do not publish leaderboard rankings while responsible-use public_leaderboard_allowed is false. |
