# Temporal Packet Scaffold

## Purpose

Evaluate a zero-LLM local scaffold that consumes the same leakage-safe temporal SFT packet prepared for Qwen LoRA. This is a control for what the accepted labels teach without generative fine-tuning.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1` |
| Train windows | `161-240, 241-320` |
| Eval window | `321-389` |
| Train rows | 113 |
| Validation rows | 19 |
| Eval prompts | 69 |
| Selected threshold | 0.65 |
| LLM calls | 0 |

## Validation Threshold Sweep

| Threshold | Answered | Answer-type acc. | Citation precision | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.15 | 16 | 63.2% | 31.3% | 28.8% | 100.0% |
| 0.25 | 11 | 68.4% | 36.4% | 22.5% | 100.0% |
| 0.35 | 10 | 63.2% | 40.0% | 21.7% | 100.0% |
| 0.45 | 6 | 73.7% | 50.0% | 16.7% | 100.0% |
| 0.5 | 5 | 68.4% | 40.0% | 11.8% | 100.0% |
| 0.55 | 4 | 63.2% | 25.0% | 3.6% | 100.0% |
| 0.65 | 1 | 57.9% | 100.0% | 1.7% | 100.0% |
| 0.75 | 0 | 52.6% | 0.0% | 0.0% | 0.0% |
| 0.85 | 0 | 52.6% | 0.0% | 0.0% | 0.0% |

## Later Eval Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Temporal packet scaffold | 22 | 47 | 68.1% | 63.6% | 21.6% | 6.1% | 100.0% |

## Interpretation

This scaffold is cheap and fully amortized, but it is extractive and cannot synthesize or repair claims like a generative student. It should be treated as a local control while the Qwen LoRA path is blocked.
