# Agentic V5 Candidate Suite

This candidate suite is a replacement path for the v3 suite's diversity failure.

## Status

- Status: candidate_rejected_by_frontier_baseline
- Buyer ready: false
- Tasks: 200
- Categories: 10
- Unique native questions: 200/150
- Corpus documents per task: 1000-1000
- Source rows available: 246
- Redistributable preview rows: 174
- Pointer-only rows: 72
- Shallow baseline solved: 0/200
- Evidence contract audit failed: 100/200
- Frontier max answer membership: 99.5%

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
| evidence_contract_audit_passed | false |
| frontier_agent_failure_gate_passed | false |

## Blockers

- Remove remaining visible locator/rule shortcuts and regenerate tasks whose solution can be recovered by generic corpus parsing.
- Rerun Codex CLI and Claude Code after the rewrite and require frontier difficulty gate pass before buyer claims.
- Rewrite 100 v5 tasks that fail the evidence-contract audit.
