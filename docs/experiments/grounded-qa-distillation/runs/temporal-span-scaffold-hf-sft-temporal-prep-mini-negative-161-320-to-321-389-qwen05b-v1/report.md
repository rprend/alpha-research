# Temporal Span Scaffold

## Purpose

Evaluate a zero-LLM local span-generation scaffold trained from the same leakage-safe temporal SFT packet prepared for Qwen LoRA. This tests whether answer-span supervision improves over the previous top-evidence sentence quote control.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1` |
| Train windows | `161-240, 241-320` |
| Eval window | `321-389` |
| Train rows | 113 |
| Validation rows | 19 |
| Eval prompts | 69 |
| Selected threshold | 0.3 |
| LLM calls | 0 |

## Validation Threshold Sweep

| Threshold | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.2 | 17 | 57.9% | 35.3% | 55.6% | 39.9% | 100.0% |
| 0.3 | 13 | 68.4% | 38.5% | 50.0% | 36.4% | 100.0% |
| 0.4 | 9 | 68.4% | 44.4% | 38.9% | 30.8% | 100.0% |
| 0.5 | 3 | 68.4% | 33.3% | 11.1% | 11.3% | 100.0% |
| 0.55 | 2 | 63.2% | 50.0% | 11.1% | 10.6% | 100.0% |
| 0.6 | 2 | 63.2% | 50.0% | 11.1% | 10.6% | 100.0% |
| 0.65 | 2 | 63.2% | 50.0% | 11.1% | 10.6% | 100.0% |
| 0.7 | 1 | 57.9% | 100.0% | 11.1% | 9.4% | 100.0% |
| 0.8 | 0 | 52.6% | 0.0% | 0.0% | 0.0% | 0.0% |

## Later Eval Result

| System | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Temporal span scaffold | 52 | 17 | 88.4% | 59.6% | 58.0% | 13.8% | 100.0% |

## Interpretation

This scaffold is cheap and fully amortized. It is still extractive: it can select a better answer span than the top-sentence control, but it cannot synthesize multi-evidence answers or rewrite unsupported claims like a trained generative student.
