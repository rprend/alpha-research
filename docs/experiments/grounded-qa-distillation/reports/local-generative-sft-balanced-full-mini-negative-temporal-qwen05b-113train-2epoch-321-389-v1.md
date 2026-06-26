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
| Train filter | `all` |
| Eval prompts used | 69 |
| Epochs | 2 |
| LoRA rank | 8 |
| LLM calls | 0 |

## Training

| Metric | Value |
| --- | ---: |
| Optimizer steps | 30 |
| Mean loss | 0.8715 |
| Last loss | 0.4130 |
| Train seconds | 925.4 |
| Trainable params | 1081344 |

## Eval

| Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Valid JSON |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 69 | 36.2% | 0.0% | 0.0% | 0.0% | 0.0% | 91.3% |
