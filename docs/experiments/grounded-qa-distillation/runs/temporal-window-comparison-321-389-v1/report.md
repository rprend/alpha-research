# Temporal Window Comparison 321-389

Scope: extended_temporal_future_holdout examples 321-389

This synthesis makes no LLM calls. It reads existing run and judge artifacts to compare candidate amortization shapes on the same final temporal window.

Comparability note: Reference-overlap metrics, GPT-4o judge metrics, and support-oracle metrics answer different questions and should not be averaged together.

## Reference and Judge Metrics

| System | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citations | GPT-4o answer support | GPT-4o overall correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct gpt-4o-mini student | n/a | n/a | 68.2% | 77.3% | 32.2% | 81.1% | n/a | n/a |
| Direct mini + citation repair | 53 | 76.8% | 68.2% | 77.3% | 32.2% | 100.0% | 64.2% | 72.5% |
| Balanced claim-pruner-label risk gate | 44 | 63.8% | 66.3% | 61.4% | 26.5% | 100.0% | 70.5% | 79.7% |
| Temporal packet extractive scaffold | 22 | 31.9% | 63.6% | 21.6% | 6.1% | 100.0% | n/a | n/a |
| Temporal answer-span scaffold | 52 | 75.4% | 59.6% | 58.0% | 13.8% | 100.0% | 19.2% | 39.1% |
| Local Qwen 0.5B LoRA SFT (64 train rows) | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | n/a | n/a |
| Local Qwen 0.5B LoRA SFT (full balanced packet) | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | n/a | n/a |
| Local Qwen 0.5B LoRA SFT (answered-only) | 36 | 52.2% | 21.8% | 13.1% | 13.7% | 22.2% | n/a | n/a |
| Local Qwen 0.5B LoRA SFT (answered-only + citation repair) | 36 | 52.2% | 21.8% | 13.1% | 13.7% | 100.0% | n/a | n/a |
| Local Qwen 0.5B LoRA SFT (citation repair + contract gate) | 10 | 14.5% | 33.3% | 6.3% | 3.0% | 100.0% | n/a | n/a |

## Support-Oracle Metrics

| System | Correct / examples | Answered | Answer rate | Answer support | Gate fired | Useful suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mini-negative verifier teacher | 57 / 69 (82.6%) | 42 | 60.9% | n/a | 2 | 2 | 0 |
| Frozen sequence verifier (Strong support target) | 52 / 69 (75.4%) | 35 | 50.7% | 71.4% | 9 | 3 | 6 |
| Frozen sequence verifier (Exported policy action) | 56 / 69 (81.2%) | 43 | 62.3% | 72.1% | 1 | 1 | 0 |

## Interpretation

- Direct mini plus citation repair remains the strongest answer-quality baseline on 321-389, but GPT-4o support correctness is only 72.5%.
- The balanced local risk gate raises GPT-4o judged correctness to 79.7% and answer support to 70.5%, but reduces answered rows from 53 to 44 and lowers reference recall/F1.
- The mini-negative verifier teacher reaches 82.6% support-oracle correctness with two useful and zero harmful suppressions on this window, making it a strong label-construction signal but not yet amortized because the source verifier uses mini calls.
- Current learned/local verifier attempts fail to close that gap reliably; the best 321-389 sequence-verifier policy reaches 81.2% support-oracle correctness while the strong-support objective falls to 75.4%.
- The temporal extractive scaffold is a weak zero-call floor: 31.9% answer rate, 6.1% answer F1, and 21.6% citation recall.
- The temporal answer-span scaffold improves the extractive floor's answer rate and answer F1, but GPT-4o judges only 19.2% of answered spans supported because selected spans are often relevant text that does not answer the question.
- The first bounded local Qwen LoRA SFT diagnostic is runnable but collapses to all abstentions on the final window, so the local generative path needs more training budget, better formatting, or a different backend before it can be a paper system.
- Full balanced local Qwen LoRA training improves valid JSON to 91.3% but still answers 0 of 69 examples, confirming that the current compact balanced packet teaches abstention/format more readily than answer synthesis.
- Answered-only Qwen LoRA training proves the local model can emit some answers, but format and citation control remain weak: only 53.6% valid JSON, 22.2% inline citation compliance, and 21.8% citation precision.
- A zero-call citation repair pass raises answered-only Qwen inline citation compliance to 100.0%, but it leaves answer F1 at 13.7%, citation precision at 21.8%, and citation recall at 13.1%, so it fixes format presentation rather than grounded correctness.
- A zero-call lexical contract gate improves local-SFT citation precision to 33.3% by suppressing 26 of 36 generated answers, but answer F1 falls to 3.0% and citation recall to 6.3%; cheap overlap gating is therefore a precision diagnostic, not an amortized grounded-QA system.

## Source Cost Boundary

- Synthesis calls: 0
- Synthesis cost: $0.00
- This synthesis makes no LLM calls. Some source systems were produced or judged by previously ledgered OpenAI calls.
