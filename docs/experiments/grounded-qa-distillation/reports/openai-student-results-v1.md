# OpenAI Student Results V1

## Setup

Runs:

- `openai-student-temporal-test-v1`: first 20 `temporal_test` examples, initial prompt contract
- `openai-student-temporal-test-v2`: first 20 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-test-full-v1`: all 172 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-validation-full-v1`: all 168 `temporal_validation` examples, tightened JSON/citation contract

Model:

- `gpt-4o-mini`
- Pricing table in the runner: $0.15 / 1M input tokens and $0.60 / 1M output tokens, sourced from the official OpenAI model pricing page.

Budget ledger:

- Ledger path: `llm-calls/ledger.jsonl`
- Budget summary: `llm-calls/budget.json`
- Maximum budget: $100.00
- Calls made so far: 380
- Total spend so far: $0.0822663
- Remaining budget: $99.9177337

## Prompt Contract Result

The first run made valid API calls but exposed a contract problem: the model returned non-canonical `answer_type` values such as `no` and `evaluation`, and often omitted inline citations. The runner now normalizes outputs for evaluation, but the prompt was also tightened to require:

- `answer_type` exactly `grounded_answer` or `abstain`,
- inline bracket citations in the answer,
- `citations` as an array of evidence id strings,
- `claim_table` as an array of claim/support/citation objects.

## Fair 20-Example Slice

Comparison on the same first 20 `temporal_test` examples:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `suff_calibrated_top2_t0p35` | 31.3% | 21.2% | 0.5% | 65.0% | 60.0% |
| `openai_student_gpt4o_mini_v2` | 50.0% | 55.8% | 15.6% | 70.0% | n/a |

The tightened `gpt-4o-mini` student improves citation recall, citation precision, answer F1, and abstention accuracy on this small slice. Inline citation rate is 84.6%.

## Full Temporal Test

Comparison on all held-out temporal examples:

| Split | System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate / inline citation rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| validation | `suff_calibrated_top2_t0p35` | 48.3% | 40.0% | 8.0% | 67.3% | 46.4% abstain |
| validation | `openai_student_gpt4o_mini_full_v1` | 70.2% | 67.7% | 26.2% | 79.8% | 79.6% inline cited |
| test | `suff_calibrated_top2_t0p35` | 49.5% | 45.1% | 6.6% | 68.6% | 40.7% abstain |
| test | `openai_student_gpt4o_mini_full_v1` | 77.3% | 64.6% | 21.1% | 83.1% | 83.2% inline cited |

The full-test run made 172 calls and cost $0.0369291. The full-validation run made 168 calls and cost $0.0369429. Total ledgered project spend is $0.0822663.

Approximate cost per answer-type-correct held-out example:

- validation: $0.0002757
- test: $0.0002582

## Interpretation

This is the first positive answer-synthesis result. It supports the hypothesis that model-facing post-training examples are the right path after deterministic extraction failed. The student improves citation precision, citation recall, answer overlap, and abstention accuracy over the deterministic temporal scaffold.

The result is not yet paper-grade because it uses a hosted model rather than a trained local small model, and there is not yet a larger teacher comparison. The next step is to compare against a larger teacher or agentic RAG teacher under the same ledger and add an entailment-style citation judge.
