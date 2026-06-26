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

- Raw URL base: `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-qwen05b-v1/hf_dataset_repo`
- Source label packet: `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1`
- Source split: `temporal_test`
- Train rows: 28
- Validation rows: 5
- Eval prompt rows: 40

Each train/validation row has chat `messages` where the assistant message is JSON with `answer_type`, `answer`, `citations`, `claim_table`, and abstention fields. The eval file contains future prompts plus references for downstream held-out evaluation.
