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

- Raw URL base: `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/hf_dataset_repo`
- Source label packet: `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`
- Source split: `extended_temporal_future_holdout`
- Train rows: 111
- Validation rows: 13
- Eval prompt rows: 80

Each train/validation row has chat `messages` where the assistant message is JSON with `answer_type`, `answer`, `citations`, `claim_table`, and abstention fields. The eval file contains future prompts plus references for downstream held-out evaluation.
