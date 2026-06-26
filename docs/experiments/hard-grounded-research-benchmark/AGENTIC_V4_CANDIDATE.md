# Agentic V4 Candidate Suite

This candidate suite is a replacement path for the v3 suite's diversity failure.

## Status

- Status: candidate_not_buyer_ready
- Buyer ready: false
- Tasks: 200
- Categories: 10
- Unique native questions: 200/150
- Corpus documents per task: 1000-1000
- Source rows available: 246
- Redistributable preview rows: 174
- Pointer-only rows: 72
- Shallow baseline solved: 0/200
- Evidence contract audit failed: 0/200

## Checks

| Check | Pass |
| --- | --- |
| task_count_at_least_200 | true |
| categories_balanced_20_each | true |
| unique_native_question_minimum_met | true |
| corpus_docs_between_1000_and_10000 | true |
| task_json_embeds_documents | false |
| hidden_gold_withheld_from_workspaces | true |
| deterministic_constant_time_gold | true |
| shallow_metadata_baseline_rejected | true |
| evidence_contract_audit_passed | true |

## Blockers

- Run current Codex CLI and Claude Code over the v4 candidate workspaces after shallow-baseline filtering.
