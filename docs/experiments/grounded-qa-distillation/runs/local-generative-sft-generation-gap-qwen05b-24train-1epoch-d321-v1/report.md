# Local Generative SFT

## Purpose

Run a bounded local LoRA SFT student on the leakage-safe temporal packet. This is the first local generative student path after OpenAI hosted fine-tuning and HF Jobs were blocked.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | `generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1` |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Device | `mps` |
| Train rows used | 240 |
| Train rows materialized | 24 |
| Train filter | `all` |
| Answer repeat | 2 |
| Eval prompts used | 10 |
| Epochs | 1 |
| LoRA rank | 8 |
| LLM calls | 0 |

## Training

| Metric | Value |
| --- | ---: |
| Optimizer steps | 6 |
| Mean loss | 1.6831 |
| Last loss | 1.1638 |
| Train seconds | 18.7 |
| Trainable params | 1081344 |

## Eval

| Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Valid JSON |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 10 | 30.0% | 0.0% | 0.0% | 0.0% | 0.0% | 60.0% |
