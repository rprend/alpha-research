---
license: cc-by-4.0
task_categories:
- text-generation
language:
- en
pretty_name: Grounded QA QASPER Teacher Labels
---

# Grounded QA QASPER Teacher Labels

This dataset contains strict judge-accepted repaired-teacher labels for the Alpha Research grounded QA distillation experiment.

- Raw URL base: `https://gist.githubusercontent.com/rprend/6b46b4b77d7f328cd4e6964884013abe/raw`
- Source label packet: `teacher-repair-temporal-test-0-132-v1`
- Source split: `temporal_test`
- Train rows: 92
- Validation rows: 17
- Eval prompt rows: 40

Each train/validation row has chat `messages` where the assistant message is JSON with `answer_type`, `answer`, `citations`, `claim_table`, and abstention fields. The eval file contains future prompts plus references for downstream held-out evaluation.
