# Hugging Face SFT Prep

## Purpose

Prepare the first generative SFT/LoRA student experiment for amortized grounded QA distillation. This packet uses the strict repaired-teacher labels and emits a self-contained Hugging Face Jobs script that can train a Qwen 0.5B LoRA student without first uploading a dataset repo.

## Setup

| Item | Value |
| --- | --- |
| Teacher label packet | `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1` |
| Raw data URL base | `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/hf_dataset_repo` |
| Accepted labels | 124 |
| Train rows | 111 |
| Validation rows | 13 |
| Eval prompts | 80 from `extended_temporal_future_holdout` offset 160 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Hub output | `rprendergast/grounded-qa-qasper-claim-pruner-mini-future-qwen05b-lora-v1` |
| HF flavor | `t4-small` |
| Timeout | `1h` |
| Estimated HF job cost | $0.7500 |

## Artifacts

- Train JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/train.hf-sft.jsonl`
- Validation JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/validation.hf-sft.jsonl`
- Eval prompts: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/eval_prompts.jsonl`
- Dataset repo upload folder: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/hf_dataset_repo`
- CPU validation script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/validate_dataset_uv.py`
- TRL/LoRA training script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/train_lora_sft_uv.py`
- HF job spec: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1/hf_job_spec.json`

## Budget

This prep makes no OpenAI API calls and does not change the OpenAI key ledger. The HF job cost estimate is separate from the $100 OpenAI budget.
