# Local Generative SFT

## Purpose

Run a bounded local LoRA SFT student on the leakage-safe temporal packet. This is the first local generative student path after OpenAI hosted fine-tuning and HF Jobs were blocked.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1` |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Device | `mps` |
| Train rows used | 113 |
| Train rows materialized | 170 |
| Train filter | `all` |
| Answer repeat | 2 |
| Eval prompts used | 69 |
| Epochs | 1 |
| LoRA rank | 8 |
| LLM calls | 0 |

## Training

| Metric | Value |
| --- | ---: |
| Optimizer steps | 22 |
| Mean loss | 0.9517 |
| Last loss | 0.4252 |
| Train seconds | 458.9 |
| Trainable params | 1081344 |

## Eval

| Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Valid JSON |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 29 | 56.5% | 33.1% | 30.7% | 13.9% | 2.5% | 72.5% |
