# Hard Grounded Research Model Reporting Card

This generated card defines how model results may be reported for the benchmark package. It is a reporting policy, not a public leaderboard authorization.

## Status

- Ready: true
- Version: model-reporting-card-v1
- Eligible model baselines: 2
- Public leaderboard allowed: false
- Completion claim allowed: false
- Active release blockers: 7

## Reported Systems

| System | Eligible | Evaluation source | Tasks | Macro answer correct | Report present |
| --- | --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | yes | pilot-suite | 30 | 0.3667 | yes |
| citation-aware-verifier-v1 | no | pilot-suite | 30 | 0.1667 | yes |
| fixture-model-import-smoke | no | pilot-suite | 30 | 1.0000 | yes |
| lexical-evidence-baseline-v1 | no | pilot-suite | 30 | 0.2000 | yes |
| local-rule-agent-v1 | no | pilot-suite | 30 | 1.0000 | yes |
| openai-grounded-baseline-v1 | yes | pilot-suite | 30 | 0.4000 | yes |
| openai-grounded-baseline-v1 | no | calibration-suite | 0 | n/a | no |

## Required Reporting Fields

| # | Field |
| --- | --- |
| 1 | system_id |
| 2 | model_family |
| 3 | model_version_or_checkpoint |
| 4 | inference_date |
| 5 | prompt_packet_hash_or_manifest |
| 6 | submission_contract_version |
| 7 | scoring_contract_version |
| 8 | evaluation_source |
| 9 | task_count |
| 10 | abstention_policy |
| 11 | citation_policy |

## Reporting Rules

| # | Rule |
| --- | --- |
| 1 | Do not publish a public leaderboard while responsible-use public_leaderboard_allowed is false. |
| 2 | Treat pilot scores as diagnostic until reviewed gold, merge, scale, and final novelty gates pass. |
| 3 | Report prompt-packet provenance and scored-report provenance with every model result. |
| 4 | Report abstention, citation-faithfulness, conclusion-support, and answer metrics together. |
| 5 | Do not make category-level model claims until category_scale_ready passes. |

## Prompt Packet Policy

- Packet count: 2
- Packets ready: true
- Scored reports ready: false
- Require packet manifest for reported result: true

## Contract Versions

- Submission contract: submission-contract-v1
- Scoring contract: scoring-contract-v1
- Required answer fields: task_id, answer, citations, abstained, evidence_assessment
- Required metric ids: answer_correctness, evidence_recall, citation_precision, citation_faithfulness, conclusion_support, abstention_quality

## Claim Limits

Public leaderboards, completion claims, and category-level model claims remain blocked until the release gate passes. Current blockers: gold_review_complete, review_preflight_ready, expansion_review_preflight_ready, expansion_review_merge_ready, review_merge_ready, category_scale_ready, novelty_audit_final.
