# Hugging Face SFT Prep

## Purpose

Prepare the first generative SFT/LoRA student experiment for amortized grounded QA distillation. This packet uses the strict repaired-teacher labels and emits a self-contained Hugging Face Jobs script that can train a Qwen 0.5B LoRA student without first uploading a dataset repo.

## Setup

| Item | Value |
| --- | --- |
| Teacher label packet | `teacher-repair-temporal-test-0-132-v1` |
| Raw data URL base | `https://raw.githubusercontent.com/rprend/alpha-research/main/docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/hf_dataset_repo` |
| Accepted labels | 109 |
| Train rows | 92 |
| Validation rows | 17 |
| Eval prompts | 40 from `temporal_test` offset 132 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Hub output | `rprendergast/grounded-qa-qasper-qwen05b-lora-v1` |
| HF flavor | `t4-small` |
| Timeout | `45m` |
| Estimated HF job cost | $0.5625 |

## Artifacts

- Train JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/train.hf-sft.jsonl`
- Validation JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/validation.hf-sft.jsonl`
- Eval prompts: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/eval_prompts.jsonl`
- Dataset repo upload folder: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/hf_dataset_repo`
- CPU validation script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/validate_dataset_uv.py`
- TRL/LoRA training script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/train_lora_sft_uv.py`
- HF job spec: `docs/experiments/grounded-qa-distillation/runs/hf-sft-prep-teacher-repair-0-132-qwen05b-v1/hf_job_spec.json`

## Budget

This prep makes no OpenAI API calls and does not change the OpenAI key ledger. The HF job cost estimate is separate from the $100 OpenAI budget.
