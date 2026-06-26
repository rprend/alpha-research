# Agentic Buyer-Grade Audit

This audit checks the expanded suite against the buyer-grade benchmark target.

## Status

- Ready for buyer claim: false
- Reason: The expanded task suite is materialized, but fresh current-best Codex CLI and Claude Code baselines over all 200 tasks are still required before buyer-grade empirical claims.
- Tasks: 200
- Categories: 10
- Corpus docs per task: 1000-1000
- Missing required-evidence tasks: 0
- Public shortcut findings: 0

## Checks

| Check | Pass |
| --- | --- |
| task_count_at_least_200 | true |
| corpus_docs_between_1000_and_10000 | true |
| categories_covered | 10 |
| balanced_category_minimum | 20 |
| hidden_gold_present | true |
| constant_time_scoring | true |
| required_evidence_in_corpus | true |
| public_shortcut_fields_absent | true |
| contamination_resistant_provenance_present | true |

## Remaining Buyer-Grade Blockers

- Run Codex CLI with the strongest available accepted model over all 200 no-gold workspaces.
- Run Claude Code with the strongest available accepted model over all 200 no-gold workspaces.
- Produce per-category failure analysis from fresh expanded-suite runs.
- Perform live novelty and contamination review before claiming the benchmark does not already exist.
