# Temporal Hugging Face SFT Prep

## Purpose

Prepare a leakage-aware generative SFT/LoRA packet from the strongest current mini-negative teacher labels. Unlike the older HF prep packets, this split is causal by judged future window and excludes papers that appear in the later eval window.

## Setup

| Item | Value |
| --- | --- |
| Teacher label packet | `teacher-mini-negative-future-holdout-160-389-v1` |
| Train windows | `161-240, 241-320` |
| Eval window | `321-389` |
| Eval-paper exclusion | `true` |
| Accepted labels total | 192 |
| Train rows | 113 |
| Validation rows | 19 |
| Eval prompts | 69 |
| Excluded train labels for eval-paper overlap | 3 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Hub output | `rprendergast/grounded-qa-qasper-mini-negative-temporal-qwen05b-lora-v1` |
| Estimated HF job cost | $0.5625 |

## Distribution

| Split | Rows | Answered | Abstained | Answer rate | Papers | Counterfactual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 113 | 57 | 56 | 50.4% | 28 | 35 |
| Validation | 19 | 9 | 10 | 47.4% | 5 | 7 |

## Leakage Checks

| Check | Count |
| --- | ---: |
| Train/eval example overlap | 0 |
| Validation/eval example overlap | 0 |
| Train/eval paper overlap | 0 |
| Validation/eval paper overlap | 0 |

## Artifacts

- Train JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/train.hf-sft.jsonl`
- Validation JSONL: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/validation.hf-sft.jsonl`
- Eval prompts: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/eval_prompts.jsonl`
- Dataset folder: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/hf_dataset_repo`
- Local validation script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/validate_dataset.mjs`
- TRL/LoRA script: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/train_lora_sft_uv.py`
- HF job spec: `docs/experiments/grounded-qa-distillation/runs/hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1/hf_job_spec.json`

## Budget

This prep makes no OpenAI API calls. The estimated HF compute cost is separate from the OpenAI key budget.
