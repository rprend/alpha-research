# OpenAI Student Results V1

## Setup

Runs:

- `openai-student-temporal-test-v1`: first 20 `temporal_test` examples, initial prompt contract
- `openai-student-temporal-test-v2`: first 20 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-test-full-v1`: all 172 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-validation-full-v1`: all 168 `temporal_validation` examples, tightened JSON/citation contract
- `openai-teacher-temporal-test-full-v1`: all 172 `temporal_test` examples, same contract with `gpt-4o` as a larger hosted teacher

Model:

- `gpt-4o-mini`
- Pricing table in the runner: $0.15 / 1M input tokens and $0.60 / 1M output tokens, sourced from the official OpenAI model pricing page.

Budget ledger:

- Ledger path: `llm-calls/ledger.jsonl`
- Budget summary: `llm-calls/budget.json`
- Maximum budget: $100.00
- Calls made so far: 552
- Total spend so far: $0.6615213
- Remaining budget: $99.3384787

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

The full-test student run made 172 calls and cost $0.0369291. The full-validation student run made 168 calls and cost $0.0369429. Student-only held-out evaluation spend is $0.0738720.

Approximate cost per answer-type-correct held-out example:

- validation: $0.0002757
- test: $0.0002582

## Larger Teacher Comparison

Comparison on all 172 `temporal_test` examples:

| System | Model | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Inline citation rate | Run cost | Cost / answer-type-correct |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `suff_calibrated_top2_t0p35` | deterministic | 49.5% | 45.1% | 6.6% | 68.6% | n/a | $0 | $0 |
| `openai_student_temporal_test_full_v1` | `gpt-4o-mini` | 77.3% | 64.6% | 21.1% | 83.1% | 83.2% | $0.0369291 | $0.0002582 |
| `openai_teacher_temporal_test_full_v1` | `gpt-4o` | 82.8% | 57.2% | 17.4% | 79.7% | 96.6% | $0.5792550 | $0.0042281 |

The larger hosted teacher is more precise and much better at putting cited evidence ids inline, but it is worse than the mini student on citation recall, answer token F1, and abstention accuracy under this prompt and compact-evidence setting. It is also about 16.4x more expensive per answer-type-correct example.

## Interpretation

This is the first positive answer-synthesis result. It supports the hypothesis that model-facing post-training examples are the right path after deterministic extraction failed. The student improves citation precision, citation recall, answer overlap, and abstention accuracy over the deterministic temporal scaffold.

The result is not yet paper-grade because it uses hosted models and the larger teacher comparison is prompt-matched rather than a multi-step agentic RAG teacher. The next step is to add an entailment-style citation judge and test whether teacher-generated post-training data improves the cheaper student beyond direct prompting.
