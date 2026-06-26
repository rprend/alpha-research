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
- `openai-student-direct-mini-extended-future-holdout-160-240-v1`: direct `gpt-4o-mini` baseline on reserved `extended_temporal_future_holdout` examples 161-240
- `citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1`: zero-call inline-citation repair over that direct baseline
- `risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1`: zero-call support-risk gate trained from claim-pruned teacher-label traces and evaluated on examples 161-240
- `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-160-240-v1`: stronger `gpt-4o` judge over the repaired direct baseline
- `openai-judge-gpt4o-risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1`: stronger `gpt-4o` judge over the risk-gated predictions
- `mini-verifier-gate-balanced-risk-gate-240-389-v1`: synthesis of cheap mini-verifier negatives plus the deterministic claim-entailment guard over balanced risk-gate transfer outputs
- `teacher-combined-mini-det-guard-future-holdout-240-389-v1`: zero-new-call SFT and verifier-label export from the combined teacher policy

Model:

- `gpt-4o-mini`
- Pricing table in the runner: $0.15 / 1M input tokens and $0.60 / 1M output tokens, sourced from the official OpenAI model pricing page.

Budget ledger:

- Ledger path: `llm-calls/ledger.jsonl`
- Budget summary: `llm-calls/budget.json`
- Maximum budget: $100.00
- Total spend so far: $5.57454550
- Remaining budget: $94.42545450

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
| `exports/teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1.sft.jsonl` | 33 | claim-pruned strict labels from the final temporal-test slice |
| `exports/teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1.rejected.jsonl` | 7 | rejected claim-pruned audit rows |
| `exports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.sft.jsonl` | 125 | combined mini-negative and deterministic-guard teacher labels |
| `exports/teacher-combined-mini-det-guard-future-holdout-240-389-v1.verifier.jsonl` | 149 | answer-support verifier labels with 119 keep and 30 suppress targets |

The strict filter accepts answered labels only when the judge marks every claim supported, citation ids valid, and every cited id appears inline in the answer. This is stricter than the judge aggregate: 14 semantically supported answered labels are rejected because the repaired teacher still omitted inline citation markers, and 1 answered label is rejected as unsupported.

The first-80 repaired teacher plus judge labeling cost is $0.5675848. Compared with the 80-120 demo scaffold's per-query cost premium over direct mini prompting, the offline packet breaks even after about 798 future queries if post-training keeps inference near direct mini-student cost. The expanded first-132 packet costs $0.9448423 and breaks even after about 1327 future queries under the same assumption. This is an amortization calculation, not a quality claim; a trained or fitted student still needs held-out evaluation.

`teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1` converts the stronger claim-pruned outputs into a smaller, stricter packet: 33 accepted labels from 40 examples, including 17 answered labels and 16 abstentions. Its full upstream cost is $0.150775, including the `gpt-4o` pruner and `gpt-4o` judge, and it breaks even against the in-context demo scaffold after about 212 future queries under the same direct-student inference-cost assumption. Because this packet is built from examples 133-172, it should be used for label-quality checks or future training only after creating a new later held-out snapshot.

`teacher-combined-mini-det-guard-future-holdout-240-389-v1` exports the current best support-first teacher policy into model-facing labels. The export itself makes no OpenAI calls; it reuses the already ledgered 149 mini-verifier calls from D68, which cost $0.01805595. The resulting packet accepts 125 rows under the strong support-oracle conversion, rejects 24 audit rows, and exposes the underlying verifier target separately so a local verifier can learn `keep` versus `suppress` without treating mini positive judgments as calibrated truth.

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

`hf-sft-prep-teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-qwen05b-v1` prepares a second Qwen 0.5B LoRA packet from the claim-pruned labels:

| Artifact | Rows / setting |
| --- | ---: |
| Train rows | 28 |
| Validation rows | 5 |
| Same-window eval prompts | 40 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Target adapter repo | `rprendergast/grounded-qa-qasper-claim-pruned-qwen05b-lora-v1` |
| HF job flavor | `t4-small` |
| Timeout | 45m |
| Estimated HF job cost | $0.5625 |
| OpenAI calls | 0 |

The generated validator passes against the local dataset folder. This packet is useful for overfit and label-quality checks, but it is not a paper-grade held-out setup because the eval prompts are from the same final temporal-test window used to build the labels.

`extended_temporal_future_holdout` fixes that immediate evaluation overlap. I expanded the QASPER source pull from 120 source rows to all 1,585 Dataset Viewer rows, temporalized the extended corpus, and carved March-April 2020 examples after excluding the 7 papers used by `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1`. The resulting holdout has 389 examples on 77 papers, with 254 answerable examples and 135 abstentions. It is exported as `exports/extended_temporal_future_holdout.sft.jsonl`.

`hf-sft-prep-teacher-repair-claim-pruner-gpt4o-quote-extractive-future-holdout-qwen05b-v1` reuses the 33 claim-pruned labels for training and points evaluation at all 389 future-holdout prompts:

| Artifact | Rows / setting |
| --- | ---: |
| Train rows | 28 |
| Validation rows | 5 |
| Future eval prompts | 389 |
| Eval split | `extended_temporal_future_holdout` |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Target adapter repo | `rprendergast/grounded-qa-qasper-claim-pruned-future-qwen05b-lora-v1` |
| HF job flavor | `t4-small` |
| Timeout | 45m |
| Estimated HF job cost | $0.5625 |
| OpenAI calls | 0 |

This creates a real paper-disjoint evaluation target for the claim-pruned SFT path, although it remains a QASPER/arXiv-date proxy rather than a true private-KB update stream.

## Fresh Future-Holdout Student Check

The first bounded run on `extended_temporal_future_holdout` compares direct mini prompting against a static rubric distilled from the 33 claim-pruned labels. Both systems are locally citation-repaired before `gpt-4o` judging:

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o overall judged correct | Student + judge cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 63 | 76.3% | 66.1% | 68.8% | 25.7% | 100.0% | 65.1% | 72.5% | $0.0176652 + $0.1549575 |
| Claim-pruned rubric + citation repair | 61 | 71.3% | 65.6% | 60.6% | 23.5% | 100.0% | 63.9% | 72.5% | $0.0207288 + $0.1553300 |

This is a negative result for static rubric distillation on the paper-disjoint future holdout. The rubric transfers output-format discipline but does not improve support, and it loses answer quality versus direct mini. The next future-holdout experiment should use a trained/fitted student or verifier rather than a prompt summary of the label packet.

### Disjoint Future-Holdout Selector Check

HF Jobs could not launch the prepared Qwen 0.5B LoRA job because the account returned `402 Payment Required` for insufficient prepaid Jobs credits. As the next available fitted-object test, I trained a zero-call selector on the first future-holdout window and evaluated on a disjoint second window.

Train window: `extended_temporal_future_holdout` examples 1-80. Eval window: examples 81-160. Candidate generation and judging for the second window added 320 ledgered OpenAI calls and $0.341271.

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o overall judged correct | Incremental cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 58 | 86.3% | 69.0% | 73.0% | 23.9% | 100.0% | 70.7% | 78.8% | $0.0168663 + $0.1547150 |
| Claim-pruned rubric + citation repair | 57 | 85.0% | 69.3% | 62.7% | 23.7% | 100.0% | 61.4% | 72.5% | $0.0199197 + $0.1497700 |
| Two-policy learned selector | 56 | 88.8% | 70.5% | 73.0% | 24.6% | 100.0% | inherited | 77.5% inherited | $0 after candidate labels |
| Mini claim-pruner over direct + citation repair | 58 | 86.3% | 69.5% | 72.1% | 28.0% | 100.0% | 72.4% | 80.0% | $0.0134595 + $0.1492500 |

The selector chooses direct mini on 71 examples and the balanced rubric on 9. It slightly improves answer-type accuracy and answer F1 versus direct-only, but it loses stronger-judged correctness. The oracle target-good rate over this two-policy candidate pool is only 78.75%, so the current pool has little routing headroom. This rejects the two-policy future-holdout selector as the fitted verifier.

`failure-analysis-future-holdout-direct-vs-claim-rubric-0-160-v1` explains the failure mode: on the first 160 future-holdout examples, the two existing policies are both correct on 104 rows, direct-only correct on 17, rubric-only correct on 12, and both wrong on 27. The wrong cases are unsupported answers, not wrong abstentions. Mini claim pruning is therefore the first positive candidate-construction result on the future holdout, but it is still a teacher/verifier pass rather than amortized inference.

The same mini-pruner path on examples 1-80 improves the direct repaired candidate from 72.5% to 75.0% `gpt-4o` judged correctness and raises answer F1 to 29.8%, at $0.01466475 for the pruner and $0.147715 for the judge. Combining the two future windows yields `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`: 124 accepted strict labels from 160 examples, with 85 answered labels and 39 abstentions. The generated `hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1` packet uses those labels for 111 train rows and 13 validation rows, while reserving examples 161-240 as an untouched 80-example future eval window.

HF Jobs remains blocked by insufficient prepaid credits, so I tested a no-GPU fitted fallback on the reserved future window. `risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` trains a local logistic support-risk gate from accepted/rejected answered traces in `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`. It only converts risky answers to abstentions, uses no gold features, and makes no LLM calls at inference.

Reserved future-window comparison on examples 161-240:

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall judged correct | Incremental cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 64 | 77.5% | 59.8% | 61.7% | 26.1% | 96.9% | 67.2% | 100.0% | 73.8% | $0.0169278 + $0.1487675 |
| Support-risk gate over direct repair | 42 | 60.0% | 68.1% | 46.9% | 19.8% | 100.0% | 83.3% | 94.7% | 88.8% | $0 gate + $0.1637650 judge |

This is a positive high-safety result, not a balanced student improvement. The gate substantially improves stronger-judged correctness and answer support, while losing answer coverage, answer-type accuracy, citation recall, and answer F1. It supports the project hypothesis that expensive teacher/judge traces can be amortized into a cheaper grounded scaffold, but the current scaffold is too conservative to be the final answer-quality system.

`risk-gate-threshold-sweep-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` replays lower gate thresholds without new LLM calls. It is valid for thresholds at or below 0.70 because kept answers inherit direct-repair `gpt-4o` judgments, and newly forced abstentions are a subset of the already-judged threshold-0.70 abstentions.

| Threshold | Answered | Abstained | Gate fired | Inherited GPT-4o answer support | Inherited GPT-4o overall correct |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.55 | 57 | 23 | 7 | 71.9% | 80.0% |
| 0.60 | 54 | 26 | 10 | 72.2% | 80.0% |
| 0.65 | 48 | 32 | 16 | 77.1% | 85.0% |
| 0.70 | 42 | 38 | 22 | 81.0% | 87.5% |

`risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` materializes threshold 0.65 as the balanced operating point. It makes zero LLM calls, answers 48 examples, reaches 68.3% local citation precision, 53.4% citation recall, 23.0% answer F1, and has 85.0% inherited `gpt-4o` judged correctness. The 0.70 point remains the support-first setting; 0.65 is the better default for studying coverage-preserving amortization.

I then froze the 0.65 threshold and evaluated the next untouched future-holdout window, examples 241-320:

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall judged correct | Incremental cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 64 | 76.3% | 60.5% | 64.5% | 28.6% | 96.9% | 64.1% | 100.0% | 71.3% | $0.0172004 + $0.1511475 |
| Balanced support-risk gate | 46 | 68.8% | 64.7% | 51.7% | 23.3% | 100.0% | 69.6% | 94.1% | 80.0% | $0 gate + $0.1632750 judge |

This later-window result confirms transfer directionally: the fixed local gate improves stronger-judged correctness without per-query LLM calls. It also confirms the current limitation: the gate buys support by abstaining on many answerable examples, and answer support remains below the level needed for a paper-grade system.

To test whether the same local gate improves with more on-policy stronger-judge labels, I exported `judge-support-direct-repair-future-holdout-0-320-v1` from existing direct-repair `gpt-4o` judgments. It contains 249 answered labels from examples 1-320: 167 supported accepted rows and 82 rejected rows. This export makes no new LLM calls.

Final untouched tail comparison on examples 321-389:

| Policy | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall judged correct | Incremental cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 53 | 81.2% | 68.2% | 77.3% | 32.2% | 100.0% | 64.2% | 100.0% | 72.5% | $0.0146727 + $0.1337350 |
| Claim-pruner-label risk gate | 44 | 73.9% | 66.3% | 61.4% | 26.5% | 100.0% | 70.5% | 96.0% | 79.7% | $0 gate + $0.1397575 judge |
| Direct-judge-support risk gate | 41 | 72.5% | 69.9% | 60.2% | 26.1% | 100.0% | 68.3% | 96.4% | 79.7% | $0 gate + $0.1416575 judge |

The on-policy judged-support gate is a negative result for this feature family. It ties the older claim-pruner-label gate on overall judged correctness while answering fewer examples and lowering answer support. More direct-judge labels are not enough; the next step needs a stronger verifier model, better candidates, or actual generative fine-tuning.

`risk-gate-transfer-synthesis-240-389-v1` aggregates the two true transfer windows after threshold selection:

| Policy | Examples | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate | GPT-4o answer support | GPT-4o overall correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 149 | 117 | 78.5% | 64.1% | 70.4% | 30.2% | 98.3% | 64.1% | 71.8% |
| Balanced claim-pruner-label risk gate | 149 | 90 | 60.4% | 65.4% | 56.2% | 24.7% | 100.0% | 70.0% | 79.9% |

The aggregate is the cleanest current amortization result: the local risk gate improves stronger-judged correctness by 8.1 percentage points and answer support by 5.9 percentage points with zero per-query verifier calls. It is still a support/coverage tradeoff, not a final student: 27 fewer answers, 14.2 percentage points lower citation recall, and 5.5 percentage points lower answer F1.

`risk-gate-tradeoff-240-389-v1` classifies the same transfer rows:

| Category | Rows |
| --- | ---: |
| Retained supported answers | 64 |
| Retained unsupported answers | 26 |
| Effective suppressions of unsupported answers | 15 |
| Ineffective suppressions of unsupported answers | 1 |
| Harmful suppressions of supported answers | 2 |
| Ambiguous suppressions of supported answers | 9 |
| Direct abstentions | 32 |

The headroom is asymmetric. Recovering the two harmful false suppressions would raise correctness only to 81.2%, while suppressing the 26 retained unsupported answers would raise it to 97.3% under an oracle. The next useful experiment should therefore target a stronger support verifier for retained answers rather than answer recovery alone.

`retained-unsupported-error-analysis-240-389-v1` inspects those 26 retained unsupported answers using existing `gpt-4o` judge notes and no new LLM calls. The retained failures are not low-confidence threshold misses: median support-risk score is 0.787, 12 failures score at least 0.800, and 5 score at least 0.850. The primary failure modes are numeric or comparative overclaims (18 rows), scope or overgeneralization errors (5), citation contract gaps (2), and method-result confusion (1). This makes the next verifier target sharper: claim/evidence entailment over cited evidence, especially for numbers, comparisons, and scoped claims.

`claim-entailment-guard-balanced-risk-gate-240-389-v1` implements a first deterministic post-gate guard for that failure mode. The broad version over-suppressed supported answers, so the final default only fires when answer or claim-table numbers, comparative/superlative terms, or quantifiers are absent from the cited evidence after simple numeric normalization. It makes no LLM calls. Under inherited `gpt-4o` support-oracle accounting, it suppresses 4 unsupported retained answers and 1 supported answer, raising correctness from 119/149 (79.9%) to 122/149 (81.9%) while reducing answer coverage from 90 to 85. This is a useful feature candidate but not enough by itself; fresh judging and a stronger learned entailment verifier are still needed.

`openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1` supplies that fresh stronger-judge check. It made 149 `gpt-4o` calls for $0.3042625, moving tracked spend to $5.55648955. The guarded policy reaches 83.2% overall judged correctness, 74.1% answer support, and 95.3% abstention support. Compared with the balanced risk gate, it gains +3.4 percentage points overall correctness and +4.1 percentage points answer support while answering 5 fewer examples. Compared with direct mini plus citation repair, it is +11.4 percentage points overall correctness and +10.0 percentage points answer support, but answers 32 fewer examples and loses 15.3 percentage points citation recall. This validates the direction but not the final system.

`learned-entailment-gate-cross-window-240-389-v1` tests whether a broader local verifier can be learned from the same judged transfer windows without leakage. It trains on one window and evaluates on the other, using lexical coverage, claim coverage, numeric support, unsupported comparative and quantifier counts, upstream support score, and length/count features. The result is negative: it fires 6 times, suppresses zero unsupported answers, and harmfully suppresses 6 supported answers. Support-oracle correctness falls from 119/149 (79.9%) for the balanced risk gate to 113/149 (75.8%). The current local logistic entailment feature family should not be the next verifier path.

`mini-verifier-gate-balanced-risk-gate-240-389-v1` tries a different verifier class by running the existing judge prompt with `gpt-4o-mini` over the balanced gate outputs. The two source mini judge runs cost $0.01805595 for 149 calls. Mini is too optimistic as a calibrated judge: it marks 96.6% of rows correct, while `gpt-4o` marks 79.9%, and agreement is 83.2%. However, mini's rare negative judgments are high precision: mini-only suppresses 4 answers, all unsupported under `gpt-4o`, raising strong correctness to 123/149 (82.6%). Unioning mini negatives with the deterministic claim-entailment guard gives the best current support-first scaffold, 125/149 (83.9%), with 8 suppressions, 7 unsupported and 1 harmful. This is a teacher/label-construction result, not the final amortized verifier, because it uses per-query mini calls.

`local-verifier-from-combined-labels-240-389-v1` tests whether those combined verifier labels can be distilled into the current local logistic feature family. It makes no LLM calls and uses leave-window-out training over examples 241-389. The strong-support target is negative: 116/149 support-oracle correct (77.9%), with 3 useful suppressions and 6 harmful suppressions. The combined-policy imitation target is safer but too weak: it fires twice, suppresses 1 unsupported and 1 supported answer, and ties the balanced gate at 119/149 (79.9%) rather than matching the combined teacher's 125/149 (83.9%). The result points away from shallow lexical/logistic verifier distillation and toward a stronger claim/evidence model class.

`text-verifier-from-combined-labels-240-389-v1` tests a higher-dimensional local text model over the same labels: word and character TF-IDF over question, answer, claim table, cited evidence, and metadata, plus numeric features. It also makes no LLM calls. It is worse than the hand-feature verifier on the strong support target: 106/149 support-oracle correct (71.1%), with 17 suppressions, only 2 of them useful and 15 harmful. The combined-policy imitation target fires zero times and reproduces the balanced gate's 119/149 (79.9%), missing the teacher's high-precision suppressions. This closes the local bag-of-words verifier path for now.

`pretrained-nli-verifier-combined-labels-240-389-v1` uses `cross-encoder/nli-distilroberta-base` locally over cited evidence and answer/claim hypotheses. It makes no OpenAI calls. Unlike the bag-of-words verifier, it gives a small positive transfer result: 120/149 support-oracle correct (80.5%) versus 119/149 (79.9%) for the balanced gate. It fires 3 times, suppressing 2 unsupported answers and 1 supported answer, and raises answer support from 70.0% to 71.3%. This is still well short of the combined teacher's 125/149 (83.9%), but it is the first local pretrained verifier signal worth carrying forward.

`nli-det-guard-synthesis-240-389-v1` combines the pretrained NLI verifier with the deterministic claim-entailment guard using existing artifacts only. The two signals have zero overlap on fired answers, so their union is complementary: 123/149 support-oracle correct (82.6%), 8 suppressions, 6 useful and 2 harmful, and answer support rises to 74.4%. The intersection fires zero times. This is now the best zero-LLM local verifier-only scaffold, but it still trails the mini-negative plus deterministic teacher's 125/149 (83.9%) and has one extra harmful suppression.

`nli-det-guard-retrospective-160-240-v1` is a fixed-threshold robustness check on the earlier judged balanced-gate window. It makes no OpenAI calls. The result is a warning against promoting the local union: balanced gate is 66/80 support-oracle correct (82.5%), fixed NLI ties it, deterministic guard falls to 65/80, and NLI OR deterministic guard also falls to 65/80. The union raises answer support to 75.6%, but only by suppressing 4 supported answers along with 3 unsupported ones.

`learned-verifier-nli-det-features-160-389-v1` broadens that robustness check into a leave-window-out trained verifier over all three judged balanced-gate windows from examples 161-389. It makes no OpenAI calls and no new model calls, consuming cached NLI scores and recomputed deterministic/citation-support features. The learned verifier is negative: support-oracle correctness drops from 185/229 (80.8%) for the balanced gate to 179/229 (78.2%), with 16 suppressions, 5 useful and 11 harmful. The simpler deterministic guard and fixed NLI OR deterministic guard each reach 187/229 (81.7%), so the best conclusion is conservative: current NLI/deterministic signals can serve as diagnostics or narrow support-first baselines, but shallow supervised learning over 229 labels is not the amortized verifier.

`mini-verifier-gate-balanced-risk-gate-160-389-v1` extends the mini-negative verifier signal to all judged balanced-gate windows. The new 161-240 mini run cost $0.00983565 for 80 ledgered calls, and the three source mini runs together cost $0.02789160 for 229 calls. Mini remains too optimistic as a judge, marking 96.5% of rows correct with only 84.3% agreement against `gpt-4o`, but its negative judgments are high precision: mini-negative-only suppression reaches 192/229 support-oracle correct (83.8%), up from 185/229 (80.8%) for the balanced gate, with 7 useful and zero harmful suppressions. The deterministic guard is not robust on this wider range, adding 7 useful and 6 harmful suppressions; the mini-plus-deterministic union is therefore slightly worse at 191/229 (83.4%).

`teacher-mini-negative-future-holdout-160-389-v1` exports that broader teacher policy into distillation artifacts: 192 accepted SFT labels, 37 rejected audit rows, and 229 verifier labels with 185 keep targets and 44 suppress targets. This is the strongest current dataset-distillation object, but it is still a teacher-label construction result rather than an amortized deployed verifier because the source policy depends on per-query mini verifier calls.

`local-verifier-from-mini-negative-labels-160-389-v1` and `text-verifier-from-mini-negative-labels-160-389-v1` test the obvious amortization path from that packet into local classifiers. Both fail under leave-window-out evaluation. The hand-feature verifier's best objective ties the balanced gate at 185/229 support-oracle correct, with 5 useful and 5 harmful suppressions, while remaining 7 rows behind the mini-negative teacher. The TF-IDF verifier either over-suppresses under the strong-support target, falling to 166/229, or learns the majority keep action under teacher imitation and fires zero times. This rejects shallow local distillation of the mini-negative teacher and pushes the next step toward a sequence classifier, generative SFT/LoRA, or a larger label corpus.

`sequence-verifier-from-mini-negative-labels-160-389-v1` tests the next model class without OpenAI calls: a frozen `cross-encoder/nli-distilroberta-base` representation over cited evidence and candidate answers, followed by a local logistic verifier head. It is also negative. The strong-support target reaches 178/229 support-oracle correct, with 8 useful and 15 harmful suppressions. The teacher-action target reaches 182/229, with 7 useful and 10 harmful suppressions. Frozen sequence embeddings therefore do not recover the mini-negative teacher's sparse hard negatives; actual sequence-classifier fine-tuning, generative SFT/LoRA, or a larger label corpus is now the more credible path.

`finetuned-sequence-verifier-from-mini-negative-labels-160-389-v1` runs that actual sequence-classifier fine-tune locally with no OpenAI calls. It improves over frozen embeddings but is still not enough: the strong-support objective reaches 186/229 support-oracle correct, only +1 over the balanced gate, while firing 19 suppressions with 10 useful and 9 harmful. The teacher-policy objective reaches 184/229, below balanced, with 5 useful and 6 harmful suppressions. This makes supervised sequence fine-tuning a useful diagnostic, but the current 229-label verifier corpus is too sparse and imbalanced to amortize the mini-negative teacher's 192/229 behavior.

`finetuned-sequence-verifier-hard-negative-augmentation-160-389-v1` tests a train-only synthetic hard-negative fix for that sparsity. Each fold adds 126-134 cited-evidence shuffle, numeric perturbation, or claim-broadening negatives to the training rows, while tuning and evaluation stay on real examples. The result is negative: both objectives fire zero held-out suppressions and exactly match the balanced gate at 185/229, 7 rows behind the exported mini-negative teacher.

`hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1` moves the next credible route back to generative SFT/LoRA with a leakage-safe temporal split. It uses accepted mini-negative labels from windows 161-240 and 241-320 for train/validation, excludes any labels from papers that appear in the later eval window, and reserves window 321-389 as prompt-only eval. The packet has 113 train rows, 19 validation rows, and 69 eval prompts, with zero train/validation overlap against eval examples or papers. This is not yet a trained student, but it is the clean Qwen 0.5B LoRA launch packet the earlier HF prep lacked.

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
| Quote-extractive + citation repair | 26 | 85.0% | 87.2% | 52.4% | 24.1% | 100.0% | n/a | 77.5% GPT-4o | $0.0082596 student + $0.0697975 judge |
| Mini claim-pruner + citation repair | 25 | 82.5% | 86.7% | 51.2% | 24.0% | 100.0% | n/a | 80.0% GPT-4o | $0.0052359 pruner + $0.0706300 judge |
| GPT-4o claim-pruner + citation repair | 24 | 85.0% | 90.3% | 51.5% | 26.4% | 100.0% | n/a | 82.5% GPT-4o | $0.0789950 pruner + $0.0717800 judge |

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
| Quote-extractive + citation repair | 26 | n/a | 65.4% | 100.0% | 77.5% | $0.0697975 |
| Mini claim-pruner + citation repair | 25 | n/a | 68.0% | 100.0% | 80.0% | $0.0706300 |
| GPT-4o claim-pruner + citation repair | 24 | n/a | 70.8% | 100.0% | 82.5% | $0.0717800 |

The stronger judge finds overclaims that the mini judge accepted, especially answers that generalize beyond the cited evidence. This changes the interpretation: the answerability guard is the support-first operating point under a stricter verifier, while the calibrated selector remains the coverage-balanced scaffold. Paper claims should not rely on mini-judge-only correctness.

`verifier-selector-gpt4o-train-temporal-test-80-132-to-132-172-v1` tests whether stricter train-window labels fix routing. I judged 208 train-window candidate outputs with `gpt-4o` and trained the same verifier target on those labels. The held-out selector shifts heavily toward direct mini candidates and gets worse under `gpt-4o`: 77.5% overall judged correctness and 67.9% answer support. One stronger-judged temporal window is therefore not enough; the router needs more diverse stronger labels, a learned entailment model, or better candidates.

`openai-student-quote-extractive-temporal-test-132-172-v1` tests better candidate generation rather than routing. After local citation repair, it has the best answer F1 in this selector slice (24.1%) and high citation precision (87.2%), but `gpt-4o` judges only 65.4% of answered predictions supported. Quote-near prompting alone does not eliminate overclaiming.

`openai-claim-pruner-mini-quote-extractive-temporal-test-132-172-v1` and `openai-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1` test claim-level repair over the quote-extractive candidate. The mini pruner slightly improves stronger-judge support to 80.0% overall after citation repair. The `gpt-4o` pruner improves answer F1 to 26.4%, citation precision to 90.3%, and stronger-judge overall correctness to 82.5%, matching the calibrated selector but still below the high-safety guard. Claim pruning is therefore useful for teacher-label construction and failure analysis, but not yet the deployable amortized scaffold.

## Interpretation

This is the first positive answer-synthesis result. It supports the hypothesis that model-facing post-training examples are the right path after deterministic extraction failed. The student improves citation precision, citation recall, answer overlap, and abstention accuracy over the deterministic temporal scaffold.

The result is not yet paper-grade because it uses hosted models and the current multi-step teachers are small-slice teacher-design pilots rather than a scaled agentic RAG teacher. The next step is to scale the best teacher recipe to a larger slice, calibrate the entailment judge, and test whether teacher-generated post-training data improves the cheaper student beyond direct prompting.
