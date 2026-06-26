# OpenAI Student Results V1

## Setup

Runs:

- `openai-student-temporal-test-v1`: first 20 `temporal_test` examples, initial prompt contract
- `openai-student-temporal-test-v2`: first 20 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-test-full-v1`: all 172 `temporal_test` examples, tightened JSON/citation contract
- `openai-student-temporal-validation-full-v1`: all 168 `temporal_validation` examples, tightened JSON/citation contract
- `openai-teacher-temporal-test-full-v1`: all 172 `temporal_test` examples, same contract with `gpt-4o` as a larger hosted teacher
- `openai-judge-student-temporal-test-full-v1`: all 172 `temporal_test` student predictions judged for support with `gpt-4o-mini`
- `openai-judge-teacher-temporal-test-full-v1`: all 172 `temporal_test` teacher predictions judged for support with `gpt-4o-mini`
- `openai-multistep-teacher-temporal-test-40-v1`: first 40 `temporal_test` examples with a `gpt-4o` planner/sufficiency stage and a `gpt-4o` answer stage
- `openai-judge-multistep-teacher-temporal-test-40-v1`: first 40 multi-step teacher predictions judged for support with `gpt-4o-mini`
- `openai-multistep-teacher-recall-temporal-test-40-v1`: first 40 `temporal_test` examples with a recall-oriented `gpt-4o` planner/sufficiency stage and a `gpt-4o` answer stage
- `openai-judge-multistep-teacher-recall-temporal-test-40-v1`: first 40 recall-oriented multi-step teacher predictions judged for support with `gpt-4o-mini`
- `openai-multistep-teacher-recall-repair-temporal-test-40-v1`: first 40 `temporal_test` examples with recall-oriented planner, answer stage, and verify-and-repair stage
- `openai-judge-multistep-teacher-recall-repair-temporal-test-40-v1`: first 40 repair-stage multi-step teacher predictions judged for support with `gpt-4o-mini`
- `openai-multistep-teacher-recall-repair-temporal-test-40-80-v1`: next 40 `temporal_test` examples, using `--offset=40`, with the same repair-stage teacher recipe
- `openai-judge-multistep-teacher-recall-repair-temporal-test-40-80-v1`: next 40 repair-stage multi-step teacher predictions judged for support with `gpt-4o-mini`
- `openai-student-teacher-demo-temporal-test-80-120-v1`: next 40 `temporal_test` examples, using `--offset=80`, with six judge-filtered repaired-teacher demonstrations in the student prompt
- `openai-judge-student-teacher-demo-temporal-test-80-120-v1`: teacher-demo student predictions judged for support with `gpt-4o-mini`

Model:

- `gpt-4o-mini`
- Pricing table in the runner: $0.15 / 1M input tokens and $0.60 / 1M output tokens, sourced from the official OpenAI model pricing page.

Budget ledger:

- Ledger path: `llm-calls/ledger.jsonl`
- Budget summary: `llm-calls/budget.json`
- Maximum budget: $100.00
- Calls made so far: 1419
- Total spend so far: $1.71184505
- Remaining budget: $98.28815495

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

## Multi-Step Teacher Pilot

The first multi-step teacher explicitly separates:

1. planner/sufficiency stage: select directly supporting evidence ids and decide whether the evidence pack is sufficient,
2. answer stage: write the cited answer only from planner-selected evidence.

On the first 40 `temporal_test` examples, the strict planner marked 40.0% of examples sufficient and therefore made answer-stage calls for only 16 of 40 examples. The run made 56 calls and cost $0.1834200. A second recall-oriented planner profile marked 47.5% sufficient, made 59 calls, and cost $0.2039550. A third run added verify-and-repair after answer generation, made 76 calls, and cost $0.2689900. The same repair-stage recipe was then run on the next 40 examples using `--offset=40`, making 92 calls and costing $0.2882725, and on examples 81-132 using `--offset=80 --limit=52`, making 106 calls and costing $0.3703100.

Same-slice comparison:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Inline citation rate | Abstention rate | Run cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `openai-student-temporal-test-full-v1` first 40 | 68.5% | 53.2% | 13.6% | 77.5% | 87.0% | 42.5% | $0.0083419 |
| `openai-teacher-temporal-test-full-v1` first 40 | 73.7% | 55.4% | 11.7% | 82.5% | 100.0% | 47.5% | $0.1348725 |
| `openai-multistep-teacher-temporal-test-40-v1` | 75.0% | 38.1% | 10.1% | 70.0% | 75.0% | 60.0% | $0.1834200 |
| `openai-multistep-teacher-recall-temporal-test-40-v1` | 73.1% | 49.7% | 12.2% | 72.5% | 68.4% | 52.5% | $0.2039550 |
| `openai-multistep-teacher-recall-repair-temporal-test-40-v1` | 74.8% | 53.5% | 13.0% | 75.0% | 72.2% | 55.0% | $0.2689900 |
| `openai-multistep-teacher-recall-repair-temporal-test-40-80-v1` | 88.5% | 75.3% | 21.5% | 87.5% | 65.4% | 35.0% | $0.2882725 |
| `openai-multistep-teacher-recall-repair-temporal-test-80-132-v1` | 85.2% | 48.4% | 17.3% | 73.1% | 70.4% | 48.1% | $0.3703100 |

The strict explicit planner improves citation precision slightly over the prompt-matched teacher on this slice, but it over-abstains and loses citation recall, answer F1, abstention accuracy, and inline citation compliance. The recall-oriented profile recovers some recall and answer F1 and improves over the strict planner on abstention accuracy, but trails the prompt-matched teacher. Adding verify-and-repair improves the multi-step teacher again on citation precision, recall, answer F1, abstention accuracy, and inline citation rate versus recall-only. The offset-40 slice is stronger than the first slice, suggesting the recipe is not uniformly weak. However, the combined 80-example view is still mixed.

Combined first-80 comparison:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Inline citation rate | Abstention rate | Run cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `openai-student-temporal-test-full-v1` first 80 | 77.7% | 66.0% | 19.2% | 86.3% | 84.6% | 35.0% | $0.0166761 |
| `openai-teacher-temporal-test-full-v1` first 80 | 80.8% | 64.3% | 16.8% | 86.3% | 97.2% | 40.0% | $0.2696150 |
| repair-stage multi-step teacher first 80 | 82.9% | 64.6% | 17.4% | 81.3% | 68.2% | 45.0% | $0.5572625 |

The scaled repair-stage teacher has the best citation precision and roughly matches the prompt-matched teacher's citation recall, but it costs more and still has weaker abstention accuracy and inline citation compliance. It is better viewed as a source of high-precision candidate teacher labels than as a final teacher policy.

## Entailment Judge

The OpenAI judge runner evaluates predictions against only the question, prediction, and supplied evidence. For answered predictions, it asks whether every factual claim is directly supported by cited evidence ids. For abstentions, it asks whether the full evidence pack is insufficient to answer the question. The judge uses `gpt-4o-mini`, writes each call to the shared ledger, and emits a separate `judgments.jsonl` artifact.

Full temporal-test judge results:

| Judged prediction run | Judge model | Answered predictions | Abstained predictions | Answer support rate | Abstention support rate | Overall judged correct | Invalid judgment rate | Judge run cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `openai-student-temporal-test-full-v1` | `gpt-4o-mini` | 117 | 55 | 91.5% | 100.0% | 94.2% | 1.2% | $0.0203958 |
| `openai-teacher-temporal-test-full-v1` | `gpt-4o-mini` | 99 | 73 | 90.9% | 100.0% | 94.8% | 0.6% | $0.0213821 |
| `openai-multistep-teacher-temporal-test-40-v1` | `gpt-4o-mini` | 16 | 24 | 75.0% | 100.0% | 90.0% | 2.5% | $0.0053748 |
| `openai-multistep-teacher-recall-temporal-test-40-v1` | `gpt-4o-mini` | 19 | 21 | 89.5% | 100.0% | 95.0% | 0.0% | $0.0053402 |
| `openai-multistep-teacher-recall-repair-temporal-test-40-v1` | `gpt-4o-mini` | 18 | 22 | 94.4% | 100.0% | 97.5% | 0.0% | $0.0055755 |
| `openai-multistep-teacher-recall-repair-temporal-test-40-80-v1` | `gpt-4o-mini` | 26 | 14 | 100.0% | 100.0% | 100.0% | 0.0% | $0.0047468 |
| `openai-multistep-teacher-recall-repair-temporal-test-80-132-v1` | `gpt-4o-mini` | 27 | 25 | 100.0% | 100.0% | 100.0% | 0.0% | $0.0069476 |

Combined over the first 80 examples, the repair-stage teacher has 44 answered predictions, 36 abstentions, 97.7% answer support, 100.0% abstention support, and 98.8% overall judged correctness. The teacher run cost is $0.5572625 and the judge cost is $0.0103223. Combined over the first 132 examples, the strict label export accepts 109 rows after rejecting 23 answered rows that fail the stricter inline-citation/support filter.

The judge adds a more direct answer-support signal than lexical answer token F1. It also exposes that both hosted systems are usually grounded when they choose to answer, while the teacher abstains more often. This does not prove final grounded correctness: the judge is still an LLM, uses the same mini model family as the student baseline, and needs calibration against stronger independent or human judgments.

## Teacher-Demonstration Student Scaffold

The student runner now supports `--offset` and judge-filtered demonstrations from prior teacher runs. The first scaffold test used six examples from the first 80 repaired multi-step teacher outputs, filtered by the entailment judge, as in-context demonstrations for `gpt-4o-mini`. It then evaluated the next 40 `temporal_test` examples (`--offset=80 --limit=40`) without generating any new teacher labels.

Same-slice comparison on temporal-test examples 81-120:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Inline citation rate | Answer support | Overall judged correct | Student run cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `openai-student-temporal-test-full-v1` slice 80-120 | 74.1% | 60.7% | 21.4% | 77.5% | 79.0% | 92.6% | 95.0% | $0.0092100 |
| `openai-student-teacher-demo-temporal-test-80-120-v1` | 80.4% | 53.6% | 18.1% | 77.5% | 100.0% | 95.7% | 97.5% | $0.0376944 |

The teacher-demo scaffold is more conservative: it answers 23 of 40 examples versus 27 of 40 for the direct student. It improves citation precision, inline citation compliance, answer support, and overall judged correctness, but loses citation recall and answer token F1 while costing about 4.1x more than the prompt-only mini baseline on the same slice. This is a useful scaffold diagnostic, but not yet an amortized win. The next post-training-data experiment should use repaired teacher outputs to train or filter a cheaper policy, then measure whether the extra teacher-label cost is amortized over repeated inference.

## Offline Teacher-Label Packet

`teacher-repair-temporal-test-0-80-v1` converts the first 80 repaired multi-step teacher outputs into a reusable post-training packet:

| Artifact | Rows | Purpose |
| --- | ---: | --- |
| `exports/teacher-repair-temporal-test-0-80-v1.sft.jsonl` | 65 | strict judge-accepted SFT labels |
| `exports/teacher-repair-temporal-test-0-80-v1.rejected.jsonl` | 15 | audit rows rejected by the strict label filter |
| `exports/teacher-repair-temporal-test-0-132-v1.sft.jsonl` | 109 | expanded strict judge-accepted SFT labels |
| `exports/teacher-repair-temporal-test-0-132-v1.rejected.jsonl` | 23 | expanded rejected audit rows |

The strict filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. This is stricter than the judge aggregate: 14 semantically supported answered labels are rejected because the repaired teacher still omitted inline citation markers, and 1 answered label is rejected as unsupported.

The first-80 repaired teacher plus judge labeling cost is $0.5675848. Compared with the 80-120 demo scaffold's per-query cost premium over direct mini prompting, the offline packet breaks even after about 798 future queries if post-training keeps inference near direct mini-student cost. The expanded first-132 packet costs $0.9448423 and breaks even after about 1327 future queries under the same assumption. This is an amortization calculation, not a quality claim; a trained or fitted student still needs held-out evaluation.

## Teacher-Label Filter

`teacher-label-filter-temporal-test-80-172-v1` is the first zero-additional-token policy trained from the offline label packet. It learns a local logistic gate over the direct mini student's output and either keeps the generated answer or converts it to an abstention. It cannot generate answers that the direct student missed.

Held-out comparison on temporal-test examples 81-172:

| Policy | Answered | Forced abstentions | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Kept-answer support | Hybrid support/gold-abstention |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini student | 65 | 0 | 80.4% | 76.9% | 63.5% | 22.6% | 82.1% | 92.3% | 84.8% |
| Teacher-label filter | 58 | 7 | 77.2% | 78.4% | 56.5% | 19.8% | 92.0% | 91.4% | 79.3% |

This is a negative result. The filter buys citation-format compliance by over-abstaining and loses the broader grounded-correctness screen. The offline teacher labels should be used to train generation/citation behavior directly, not only a post-hoc answer gate.

## Fine-Tune Preparation

`openai-finetune-prep-teacher-repair-0-80-v1` prepares the strict teacher-label packet for hosted supervised fine-tuning:

| File | Rows | Approx tokens |
| --- | ---: | ---: |
| `runs/openai-finetune-prep-teacher-repair-0-80-v1/train.openai.jsonl` | 52 | 57,104 |
| `runs/openai-finetune-prep-teacher-repair-0-80-v1/validation.openai.jsonl` | 13 | 10,429 |

At 3 epochs, the estimated `gpt-4.1-mini-2025-04-14` training cost is $0.85656 under the current OpenAI fine-tuning price of $5 / 1M training tokens. The job was not launched in this run. Before launching, the project needs a controller that uploads files, creates the fine-tune job, polls status, records job ids, and writes actual training spend or a conservative reserved spend to the shared ledger.

`openai-finetune-teacher-repair-0-80-v1` adds that upload/create controller and attempts a launch. File uploads succeeded, but job creation failed with OpenAI `training_not_available`, indicating this organization can no longer create self-serve fine-tuning jobs. No job id was created, no training spend was reserved, and the uploaded files were deleted. The OpenAI-hosted SFT path is therefore unavailable on this account; the strict teacher-label packet should be used with a local/Hugging Face SFT backend next.

## Teacher-Label Local Scaffold

`teacher-label-scaffold-temporal-test-80-172-v1` trains a zero-LLM local extractor from the 65 strict teacher labels. It learns evidence selection, sufficiency, and span extraction from teacher outputs, then evaluates on temporal-test examples 81-172.

| Policy | Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini student | 65 | 27 | 80.4% | 76.9% | 63.5% | 22.6% | 82.1% |
| Teacher-label filter | 58 | 34 | 77.2% | 78.4% | 56.5% | 19.8% | 92.0% |
| Teacher-label local scaffold | 22 | 70 | 48.9% | 56.8% | 10.9% | 3.3% | 100.0% |
| Expanded-label local scaffold, examples 133-172 | 5 | 35 | 42.5% | 90.0% | 6.5% | 4.1% | 100.0% |

This is a negative result. The local scaffold preserves citation formatting but is far too conservative and loses answer synthesis. Scaling from 65 to 109 strict labels improves the offline data asset, but not the hand-built extractor. The strict teacher-label packet needs a generative training backend or a different learned scaffold.

## Hugging Face LoRA SFT Prep

`hf-sft-prep-teacher-repair-0-132-qwen05b-v1` is the first generative-student training packet after OpenAI fine-tuning proved unavailable. It converts the expanded strict teacher labels into a TRL-compatible LoRA SFT setup:

| Artifact | Rows / setting |
| --- | ---: |
| Train rows | 92 |
| Validation rows | 17 |
| Future eval prompts | 40 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Target adapter repo | `rprendergast/grounded-qa-qasper-qwen05b-lora-v1` |
| HF job flavor | `t4-small` |
| Timeout | 45m |
| Estimated HF job cost | $0.5625 |
| OpenAI calls | 0 |

The generated job script uses TRL SFTTrainer, PEFT LoRA, and Trackio. It reads JSONL from a public gist because the local HF CLI token cannot create a Hugging Face dataset repo and the private GitHub raw files are not anonymously fetchable. The generated CPU validator passes against the public gist data base. Remote HF Jobs execution is blocked for now: the CLI token lacks `job.write`, and the MCP-authenticated account reports insufficient prepaid Jobs credits. This is not a quality result yet; it is the first launch-ready generative SFT path with the operational blockers isolated from the OpenAI budget.

## Teacher-Label Rubric Scaffold

`openai-student-teacher-rubric-temporal-test-132-172-v1` distills the 109 strict teacher labels into a compact static rubric: prefer abstention without directly answering evidence, use one or two citations for most answers, require every cited id to appear inline, and keep claim tables short. It uses no per-query demonstrations and no teacher calls at inference time.

Same-slice comparison on temporal-test examples 133-172:

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Answer support | Overall judged correct | Student cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini student | 28 | 85.0% | 82.0% | 71.1% | 24.3% | 85.7% | 92.9% | 95.0% | $0.0082530 |
| Teacher-label rubric scaffold | 17 | 67.5% | 86.3% | 39.0% | 13.7% | 100.0% | 100.0% | 100.0% | $0.0087960 |
| Balanced teacher-label rubric | 30 | 80.0% | 77.2% | 59.5% | 21.4% | 100.0% | 93.3% | 95.0% | $0.0098970 |
| Direct mini + citation contract repair | 28 | 85.0% | 82.0% | 71.1% | 24.3% | 100.0% | 89.3% | 92.5% | $0 incremental |
| Local policy selector | 31 | 82.5% | 78.0% | 70.2% | 23.4% | 100.0% | n/a | 92.5% inherited | $0 incremental |
| No-leak verifier selector | 31 | 82.5% | 78.0% | 68.5% | 21.0% | 100.0% | n/a | 92.5% inherited | $0 incremental after train labels |
| Evidence-aware verifier selector | 30 | 85.0% | 80.6% | 68.5% | 22.3% | 100.0% | n/a | 92.5% inherited | $0 incremental after train labels |
| Evidence-aware + calibrated abstention | 29 | 87.5% | 83.3% | 68.5% | 22.3% | 100.0% | n/a | 95.0% inherited | $0 incremental after train labels |
| Recovery candidate pool selector | 29 | 87.5% | 85.1% | 68.5% | 24.0% | 100.0% | n/a | 87.5% inherited | $0 incremental after recovery labels |
| Answerability-guarded selector | 25 | 82.5% | 84.7% | 61.3% | 20.7% | 100.0% | n/a | 97.5% inherited | $0 incremental |
| Coverage-preserving answerability guard | 29 | 87.5% | 83.3% | 68.5% | 22.3% | 100.0% | n/a | 95.0% inherited | $0 incremental |
| Direct-prior verifier selector | 29 | 87.5% | 83.3% | 68.5% | 22.4% | 100.0% | n/a | 95.0% inherited | $0 incremental |
| Local-entailment verifier selector | 29 | 87.5% | 83.3% | 68.5% | 22.3% | 100.0% | n/a | 95.0% inherited | $0 incremental |
| GPT-4o-train verifier selector | 28 | 85.0% | 82.7% | 66.7% | 22.9% | 100.0% | n/a | 95.0% inherited / 77.5% GPT-4o | $0 incremental after stronger train labels |

The strict rubric scaffold is a safety-formatting improvement, not an amortized answer-quality improvement. It transfers citation discipline and judged support from teacher labels, but mostly by abstaining on examples the direct mini student can answer. The balanced rubric recovers coverage and keeps perfect inline citation formatting, but loses citation precision, recall, and answer F1 versus direct mini prompting. Static teacher-label rubrics are therefore useful controls, not the final amortized student.

`citation-contract-repair-direct-mini-temporal-test-132-172-v1` isolates local output normalization. It appends missing cited ids inline for direct mini answers, changing 4 rows and repairing 8 missing inline citation markers with no student-model calls. It is necessary for the output contract, but not sufficient for grounded correctness: a fresh judge pass drops answer support and overall judged correctness, so citation insertion must be paired with verification or confidence control.

`policy-selector-temporal-test-132-172-v1` is a zero-call routing analysis over already judged component predictions. It selects direct mini for 24 rows, balanced rubric for 7, and citation repair for 9. This recovers most of direct mini's recall while enforcing 100.0% inline citation compliance, but inherited judged correctness stays at 92.5%. The selector needs a learned or LLM-calibrated verifier before it can be a final amortized student.

`verifier-selector-noleak-temporal-test-80-132-to-132-172-v1` trains that first local verifier on a separate temporal window. I generated strict-rubric, balanced-rubric, citation-repair, and judge labels for examples 81-132, costing 260 ledgered OpenAI calls and $0.04670190. The held-out verifier uses no gold-derived features and makes no calls at selection time. It does not improve the final slice: inherited judged correctness remains 92.5%, answer F1 falls to 21.0%, and target-good rate is 77.5%. This rejects simple metadata/agreement routing as the missing verifier, while preserving the oracle-headroom result that better evidence-aware selection could matter.

`verifier-selector-evidence-aware-temporal-test-80-132-to-132-172-v1` adds lexical evidence-alignment features over the candidate answer, claim table, cited evidence, and full evidence pack. It improves several held-out selection metrics versus the metadata verifier: answer-type accuracy reaches 85.0%, citation precision reaches 80.6%, answer F1 reaches 22.3%, and target-good rate reaches 80.0%. It still does not improve inherited judged correctness, which remains 92.5%, so lexical overlap is a useful cheap signal but not a complete support verifier.

`verifier-selector-evidence-aware-abstention-calibrated-temporal-test-80-132-to-132-172-v1` tunes one abstention margin on examples 81-132 and freezes it for examples 133-172. This is the best cheap hybrid so far: it matches direct mini's 95.0% inherited judged correctness and enforces 100.0% inline citation compliance. It is still not a final amortized student because it answers fewer examples than direct mini, has lower answer F1 and citation recall, and leaves target-good at 82.5% versus 92.5% oracle headroom.

`verifier-selector-recovery-pool-temporal-test-80-132-to-132-172-v1` adds an extractive answer-recovery candidate to the selector pool. The recovery experiment costs 184 additional ledgered OpenAI calls and $0.03069765 including student and judge passes. It improves answer F1, but it is not safe: held-out inherited judged correctness drops to 87.5% because the selector over-selects recovery after it looks perfect on the train window. Recovery prompting should stay diagnostic until paired with a stronger entailment verifier.

`verifier-selector-answerability-guard-temporal-test-80-132-to-132-172-v1` trains a zero-call row-level answerability guard on examples 81-132. It improves held-out inherited judged correctness to 97.5%, the best support result so far, but sacrifices coverage and answer quality. This gives a useful high-safety operating point, while confirming that the default paper direction still needs support improvements without heavy over-abstention.

`verifier-selector-answerability-guard-coverage-preserving-temporal-test-80-132-to-132-172-v1` constrains the same guard to preserve 100% of the calibrated selector's train-window answer coverage. Under that constraint, the tuned guard is not selected and the held-out result matches the default calibrated selector. This rejects coverage-preserving row-level answerability gating as a support improvement on the current candidate pool.

`verifier-selector-direct-prior-temporal-test-80-132-to-132-172-v1` gives inline-complete direct-mini candidates a small rank bonus after failure inspection showed direct-mini was frequently oracle-good. The ablation changes policy mix sharply, selecting direct-mini on 26 of 40 examples, but it leaves inherited judged correctness and target-good unchanged. This rejects a simple direct-mini prior as the missing router.

`verifier-selector-local-entailment-temporal-test-80-132-to-132-172-v1` adds local citation-window, claim-nearest-citation, citation density, and citation-order features. These stricter no-LLM features do not change the held-out result versus the calibrated selector, so the remaining verifier gap likely needs learned entailment or better candidates rather than more handcrafted lexical locality features.

## Stronger Judge Check

The selector metrics above mostly inherit `gpt-4o-mini` judge labels. I ran a bounded stronger-judge check with `gpt-4o` on the two most important operating points:

| Policy | Answered | Mini judged correct | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall judged correct | GPT-4o judge cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Evidence-aware + calibrated abstention | 29 | 95.0% inherited | 75.9% | 100.0% | 82.5% | $0.0715400 |
| Answerability-guarded selector | 25 | 97.5% inherited | 80.0% | 100.0% | 87.5% | $0.0756075 |
| GPT-4o-train verifier selector | 28 | 95.0% inherited | 67.9% | 100.0% | 77.5% | $0.0746350 |

The stronger judge finds overclaims that the mini judge accepted, especially answers that generalize beyond the cited evidence. This changes the interpretation: the answerability guard is the support-first operating point under a stricter verifier, while the calibrated selector remains the coverage-balanced scaffold. Paper claims should not rely on mini-judge-only correctness.

`verifier-selector-gpt4o-train-temporal-test-80-132-to-132-172-v1` tests whether stricter train-window labels fix routing. I judged 208 train-window candidate outputs with `gpt-4o` and trained the same verifier target on those labels. The held-out selector shifts heavily toward direct mini candidates and gets worse under `gpt-4o`: 77.5% overall judged correctness and 67.9% answer support. One stronger-judged temporal window is therefore not enough; the router needs more diverse stronger labels, a learned entailment model, or better candidates.

## Interpretation

This is the first positive answer-synthesis result. It supports the hypothesis that model-facing post-training examples are the right path after deterministic extraction failed. The student improves citation precision, citation recall, answer overlap, and abstention accuracy over the deterministic temporal scaffold.

The result is not yet paper-grade because it uses hosted models and the current multi-step teachers are small-slice teacher-design pilots rather than a scaled agentic RAG teacher. The next step is to scale the best teacher recipe to a larger slice, calibrate the entailment judge, and test whether teacher-generated post-training data improves the cheaper student beyond direct prompting.
