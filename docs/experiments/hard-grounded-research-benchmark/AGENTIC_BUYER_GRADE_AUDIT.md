# Agentic Buyer-Grade Audit

This audit checks the expanded suite against the buyer-grade benchmark target.

## Status

- Ready for buyer claim: false
- Reason: The expanded task suite is materialized, but source-question diversity is too low for a buyer-grade claim.
- Tasks: 200
- Categories: 10
- Corpus docs per task: 1000-1000
- Unique native questions: 12/150
- Max reuse of one native question: 28
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
| unique_native_question_minimum_met | false |
| contamination_resistant_provenance_present | true |

## Remaining Buyer-Grade Blockers

- Replace repeated templates until at least 150 distinct native questions exist across 200 tasks.
- Perform live novelty and contamination review before claiming the benchmark does not already exist.
