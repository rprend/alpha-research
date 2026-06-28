# Decision Log

This log records implementation and research decisions for the grounded QA distillation project. Each decision should be revisited when results contradict the assumption behind it.

## 2026-06-25

### D1. Use QASPER as the first public proxy for evolving private KBs

Decision: Use Hugging Face `allenai/qasper` as the seed corpus.

Reason: It has domain documents, user-style questions, answer evidence, and unanswerable labels. Those fields directly map to grounded QA distillation examples without requiring paid annotation.

Tradeoff: QASPER is public and scientific-paper-specific, so it is only a proxy for evolving private knowledge bases. The paper will need either simulated updates or an additional private/enterprise-like corpus before a top-conference claim is credible.

### D2. Treat train/validation/test splits as coarse KB snapshots for the first run

Decision: Use QASPER splits as coarse `knowledge_base_version` values.

Reason: This gives immediate held-out evaluation for update robustness without inventing dated paper snapshots.

Tradeoff: Split-as-time is not a real temporal evolution. It is acceptable for infrastructure smoke tests but not sufficient for the final paper.

## 2026-06-26

### D3. Do not expose oracle evidence roles to the student input

Decision: Remove `role: gold_evidence` and hard-negative labels from `input.compact_retrieved_evidence_pack`. Keep those labels only under `teacher_trace.evidence_roles`.

Reason: The previous schema leaked the answer key. A student could cite only `gold_evidence` without learning retrieval, sufficiency, or answer synthesis.

Tradeoff: Evaluation code now needs teacher trace metadata. That is acceptable because teacher trace is not model input.

### D4. Add cheap deterministic scaffolds before training a model

Decision: Run `retrieval_rank_1` and `lexical_overlap_scaffold` baselines before any fine-tuning.

Reason: A paper-worthy result needs to show that learned distillation beats simple cheap scaffolds. If these baselines are strong, the learned system must clear them.

Tradeoff: These are not small language models. They are controls for citation grounding and abstention behavior, not the final student.

### D5. Keep the goal active until there is a defensible paper artifact

Decision: Do not mark the project complete after a pipeline run.

Reason: The requested endpoint is a paper worth submitting to NeurIPS or an equivalent conference. Current artifacts prove only data construction and initial baseline evaluation.

Tradeoff: Work will proceed through incremental commits with explicit gaps rather than pretending the first run is enough.

### D6. Remove gold-first evidence ordering as a default

Decision: Change generated evidence packs from gold-first order to stable mixed order.

Reason: The first meaningful baseline run showed that `retrieval_rank_1` achieved 100% citation precision on validation because the generator always put gold evidence first. That measures positional leakage, not grounded QA ability.

Tradeoff: Stable mixed order is less like a high-quality retriever than gold-first order. The final paper should evaluate both retrieval-conditioned and mixed-order settings, but the default artifact should avoid a trivial shortcut.

### D7. Treat lexical overlap as a baseline, not the student

Decision: Keep lexical overlap threshold sweeps as a baseline family and build the next student around learned evidence selection plus answer compression.

Reason: On `baseline-test-v1`, `lexical_overlap_t0` improved over rank-one retrieval on citation precision (65.4% vs. 30.8%), citation recall (30.1% vs. 12.8%), and answer token F1 (11.0% vs. 4.3%). Higher thresholds improved precision but over-abstained on answerable questions. This shows lexical overlap is useful as a control but cannot preserve citation-grounded correctness.

Tradeoff: The next system should not spend effort hand-tuning lexical thresholds. It should use the generated training data to learn evidence selection, sufficiency, and concise answer synthesis.

### D8. Scale the pilot corpus before judging the learned student

Decision: Increase the default QASPER materialization from 8 source rows per split to 40 source rows per split.

Reason: The first learned selector trained on only 45 examples, which made validation/test conclusions too noisy. The larger pilot produces 153 train examples, 127 validation examples, and 149 test examples while remaining cheap and inspectable.

Tradeoff: This is still not a paper-scale dataset. It is large enough to test implementation direction, not to support a final conference claim.

### D9. Keep the learned selector, but do not claim solved distillation

Decision: Keep the logistic evidence selector as the current cheap learned-student scaffold, while treating it as a component baseline rather than the final student.

Reason: On the larger test run, `learned_selector_top2_t0p35` improved citation recall over the best no-abstain lexical baseline (42.2% vs. 36.7%) and slightly improved answer token F1 (9.9% vs. 9.4%), with better citation precision (66.8% vs. 62.4%). However, it over-abstained on 20.8% of examples, and answer synthesis is still extractive sentence copying rather than a trained small model.

Tradeoff: The learned selector provides evidence that post-training labels can teach cheaper evidence selection, but the paper still needs a generative student, entailment-grade citation checking, and a real update robustness experiment.

### D10. Add counterfactual insufficient-evidence examples

Decision: Augment each split with same-question counterfactual examples that withhold QASPER gold evidence and require abstention.

Reason: Natural QASPER unanswerable examples are too sparse for sufficiency calibration. The previous student could mostly learn to answer everything. Counterfactual insufficient packs make the target closer to private-KB retrieval failures, where a question may be valid but the retrieved evidence is inadequate.

Tradeoff: These examples are synthetic. They improve calibration pressure, but the paper will need to show that counterfactual insufficiency transfers to natural retrieval misses and real KB updates.

### D11. Fix metrics so abstentions do not inflate answer quality

Decision: Compute citation precision only when a system cites evidence, citation recall only for answerable references, and answer token F1 only on answerable examples. Keep abstention accuracy separate.

Reason: The first calibrated run incorrectly rewarded correct abstentions as perfect answer F1 and perfect citation precision. That made over-abstaining systems look strong for the wrong reason.

Tradeoff: The metric table is less superficially flattering, but it better separates answer quality from abstention behavior.

### D12. Keep sufficiency calibration, but prioritize answer compression next

Decision: Keep the separate sufficiency calibrator as the current calibrated-student scaffold, while making constrained answer compression the next engineering target.

Reason: On `calibrated-test-v1`, `suff_calibrated_top2_t0p35` improves citation recall over the best no-abstain lexical baseline (42.1% vs. 38.3%) and slightly improves citation precision (45.7% vs. 44.9%), but answer token F1 is lower (7.8% vs. 9.8%). The selector is finding more supporting evidence, but sentence-copy answers are too verbose and poorly matched to reference answers.

Tradeoff: A stronger compressor may require an actual small generative model or a more sophisticated extractive compression policy. The current dependency-free scaffold is useful for evidence selection research, not final grounded QA.

### D13. Treat phrase-ranked answer compression as a negative ablation

Decision: Keep the phrase-ranked token-salience answer compressor in the run harness, but do not promote it as the current student.

Reason: On `compressed-validation-v1`, `suff_compressed_top2_t0p35` improves answer token F1 over `suff_calibrated_top2_t0p35` from 8.1% to 9.1% without changing citation metrics. On `compressed-test-v1`, the same system drops answer token F1 from 7.8% to 7.2%. The compressor learned surface token salience from train evidence, but it often selects a plausible surrounding sentence instead of the specific short answer span.

Tradeoff: This is a useful control because it shows that answer synthesis is not solved by simple extractive shortening. The next compression step should be a model-facing fine-tuning export or a supervised span generator, evaluated against the same citation and abstention metrics.

### D14. Use month-disjoint temporal splits as the evolving-KB proxy

Decision: Add `temporal_train`, `temporal_validation`, and `temporal_test` files by parsing arXiv-style QASPER paper ids into inferred publication months, then splitting whole months chronologically.

Reason: The original split-as-time setup was too weak for the project question. The temporalized corpus trains on papers from 2016-03 through 2019-04, validates on 2019-05 through 2019-10, and tests on 2019-11 through 2020-04. It is paper-disjoint and month-disjoint, so held-out examples better approximate a knowledge base that evolves over time.

Tradeoff: The dates are inferred from paper ids, not from authoritative publication metadata, and QASPER is still public scientific literature rather than a private KB. This is a better proxy, not a final paper dataset.

### D15. Keep sufficiency calibration as the temporal-transfer baseline

Decision: Keep `suff_calibrated_top2_t0p35` as the current temporal-transfer student scaffold and treat `suff_compressed_top2_t0p35` as an ablation.

Reason: On `temporal-test-v1`, `suff_calibrated_top2_t0p35` improves citation precision over `lexical_overlap_t0` from 39.0% to 49.5% and citation recall from 33.3% to 45.1%, while matching abstention accuracy at 68.6%. Answer token F1 remains lower than lexical overlap (6.6% vs. 7.9%), so evidence selection transfers better than answer synthesis.

Tradeoff: This is real progress toward amortized grounded research over evolving KBs, but the next step must train or export a model-facing answer generator/span extractor. More selector tuning would mostly optimize the wrong bottleneck.

### D16. Export temporal SFT data for a genuine student model

Decision: Add chat-style SFT exports for `temporal_train`, `temporal_validation`, and `temporal_test`.

Reason: The deterministic scaffolds have isolated the bottleneck: evidence selection and sufficiency transfer over time, but answer synthesis does not. A model-facing export is necessary to train or call a genuinely cheaper generative student while preserving the same input contract: question, compact evidence pack, metadata/dates, cited answer, abstention, and claim table.

Tradeoff: Exporting data is not the same as training the student. It makes the next experiment possible and auditable, but paper-quality claims still require an actual smaller model run and cost comparison against a larger teacher.

### D17. Treat supervised span selection as another negative answer-synthesis ablation

Decision: Keep `suff_span_*` in the harness as a negative ablation, but do not promote it.

Reason: On `span-temporal-test-v1`, `suff_span_top2_t0p35` preserves the calibrated selector's citation precision, citation recall, abstention accuracy, and abstention rate, but answer token F1 falls from 6.6% for `suff_calibrated_top2_t0p35` to 5.2%. Training a logistic span selector over gold-evidence spans did not solve multi-span synthesis or short-answer extraction under imperfect evidence selection.

Tradeoff: The result argues against more deterministic span scoring. The next answer-synthesis experiment should use the exported SFT data with a small generative model and evaluate whether citation-grounded answer quality improves without sacrificing the temporal citation gains.

### D18. Enforce an LLM API budget ledger before more model calls

Decision: Add an API-call ledger and budget summary for grounded-QA LLM calls, with a hard maximum budget of $100.

Reason: The project now requires tracking all LLM API calls made with the user's key. The OpenAI student, teacher, and judge runners record model, run id, split, example id, token usage, cost, and price source for every successful call. They refuse runs whose estimated cost plus ledgered spend would exceed the budget. Current ledgered spend is $1.66897385 across 1339 OpenAI calls.

Tradeoff: Cost accounting depends on the runner's price table matching current provider prices. The table must be revisited when changing models or before paper-scale runs.

### D19. Treat `gpt-4o-mini` as the first positive generative-student pilot

Decision: Keep `openai-student-temporal-test-v2` as the first positive answer-synthesis pilot and expand it only after preserving the budget ledger.

Reason: On the same first 20 `temporal_test` examples, the tightened `gpt-4o-mini` student improves over `suff_calibrated_top2_t0p35` on citation precision (50.0% vs. 31.3%), citation recall (55.8% vs. 21.2%), answer token F1 (15.6% vs. 0.5%), and abstention accuracy (70.0% vs. 65.0%). The first prompt run showed contract drift, so the runner now constrains `answer_type`, citation arrays, claim tables, and inline citations.

Tradeoff: This is a 20-example hosted-model pilot, not a full distilled small model. It justifies a full temporal validation/test run and cost-per-accepted-answer analysis, but not a paper claim yet.

### D20. Promote the budget-tracked generative student as the current answer baseline

Decision: Use `openai-student-temporal-test-full-v1` as the current answer-synthesis baseline, while keeping deterministic scaffolds as ablations.

Reason: On the full 172-example `temporal_test` split, `gpt-4o-mini` improves over `suff_calibrated_top2_t0p35` on citation precision (77.3% vs. 49.5%), citation recall (64.6% vs. 45.1%), answer token F1 (21.1% vs. 6.6%), and abstention accuracy (83.1% vs. 68.6%). The full run cost $0.0369291, bringing total tracked LLM spend to $0.0453234.

Tradeoff: This is a hosted small-model baseline, not a trained distilled local model and not yet compared to a larger teacher. It is strong enough to become the answer-synthesis baseline for the next phase: temporal validation, cost-per-accepted-answer, and larger-teacher comparison.

### D21. Keep `gpt-4o-mini` after temporal validation confirms transfer

Decision: Keep the budget-tracked `gpt-4o-mini` student as the current generative student baseline across both temporal validation and temporal test.

Reason: On the full 168-example `temporal_validation` split, the student improves over `suff_calibrated_top2_t0p35` on citation precision (70.2% vs. 48.3%), citation recall (67.7% vs. 40.0%), answer token F1 (26.2% vs. 8.0%), and abstention accuracy (79.8% vs. 67.3%). On `temporal_test`, the improvements also hold. The validation run cost $0.0369429, and total tracked LLM spend is $0.0822663.

Tradeoff: This confirms the small hosted model baseline is worth comparing to a larger teacher, but it still does not prove amortized distillation from an expensive teacher. The next paper-critical experiment is a ledgered larger-teacher comparison and an entailment-style citation judge.

### D22. Treat the first larger-teacher comparison as a prompt-matched control, not the final teacher

Decision: Keep `openai-teacher-temporal-test-full-v1` as a larger hosted model control, but do not treat it as the final expensive teacher.

Reason: On the full 172-example `temporal_test` split, `gpt-4o` improves citation precision over `gpt-4o-mini` (82.8% vs. 77.3%) and inline citation rate (96.6% vs. 83.2%), but it underperforms on citation recall (57.2% vs. 64.6%), answer token F1 (17.4% vs. 21.1%), and abstention accuracy (79.7% vs. 83.1%). The teacher run cost $0.579255, about 16.4x the mini student's test-run cost per answer-type-correct example.

Tradeoff: This is a useful control showing that “larger model” is not automatically a better teacher under the same compact-evidence prompt. The paper still needs an expensive multi-step teacher or agentic RAG teacher, plus an entailment-style citation judge, before claiming successful distillation from expensive behavior.

### D23. Add a budget-tracked entailment judge before optimizing more teachers

Decision: Add `grounded-qa-distillation-openai-judge.mjs` and judge the full temporal-test student and teacher predictions with `gpt-4o-mini`.

Reason: Lexical answer overlap and gold-evidence citation matching are useful but too weak for the paper's grounded-correctness claim. The judge evaluates whether answered predictions are directly supported by cited evidence and whether abstentions are warranted by the supplied evidence pack. On the 172-example temporal test split, the mini student has 91.5% judged answer support and 94.2% overall judged correctness; the larger prompt-matched teacher has 90.9% judged answer support and 94.8% overall judged correctness. The two judge runs cost $0.04177785 total.

Tradeoff: This judge is still a hosted LLM and can be biased or over-lenient, especially because it uses `gpt-4o-mini` to judge `gpt-4o-mini` outputs. It is better evidence than token overlap, but final paper claims need calibration against human/annotation gold or a stronger independent judge, plus the still-missing multi-step teacher.

### D24. Treat the first multi-step teacher as a negative planner-calibration pilot

Decision: Add `grounded-qa-distillation-openai-multistep-teacher.mjs` and run `openai-multistep-teacher-temporal-test-40-v1` as a bounded 40-example `gpt-4o` planner plus `gpt-4o` answerer pilot.

Reason: The project needs a teacher that is actually more like expensive multi-step RAG behavior, not just the same compact prompt on a larger model. The pilot made an explicit sufficiency/evidence-selection call and only generated answers when the planner judged evidence sufficient. On the first 40 temporal-test examples, the multi-step teacher improved citation precision slightly over the prompt-matched teacher slice (75.0% vs. 73.7%), but it over-abstained (60.0% abstention rate), reduced citation recall (38.1% vs. 55.4%), reduced answer token F1 (10.1% vs. 11.7%), reduced abstention accuracy (70.0% vs. 82.5%), and had only 75.0% judged answer support. The run plus judge cost $0.1887948.

Tradeoff: This is an important negative result. It shows that decomposing teacher behavior is not enough; the planner needs recall-oriented calibration and the answer stage needs stronger citation compliance. The next teacher should tune planner sufficiency thresholds or use a retrieve-then-verify loop before using teacher outputs as post-training data.

### D25. Keep the recall-oriented planner profile, but do not promote it as the final teacher

Decision: Add `--planner-profile=recall` to the multi-step teacher runner and run `openai-multistep-teacher-recall-temporal-test-40-v1` on the same 40-example temporal-test slice.

Reason: The strict planner marked 11 answerable examples insufficient, often while selecting plausible evidence ids. The recall-oriented profile tells the planner to mark evidence sufficient when a useful answer can be formed, even if the evidence is not exhaustive. It improved over the strict planner on citation recall (49.7% vs. 38.1%), answer token F1 (12.2% vs. 10.1%), abstention accuracy (72.5% vs. 70.0%), and judged answer support (89.5% vs. 75.0%). The run plus judge cost $0.20929515.

Tradeoff: The recall profile still trails the prompt-matched `gpt-4o` teacher on the same slice for citation recall, abstention accuracy, and inline citation compliance. The next multi-step improvement should add answer-stage verification and repair rather than only changing planner prompting.

### D26. Keep verify-and-repair as the best current multi-step teacher component

Decision: Add `--repair=true` to the multi-step teacher runner and run `openai-multistep-teacher-recall-repair-temporal-test-40-v1` on the same 40-example temporal-test slice.

Reason: The recall planner still had missing inline citations and unsupported claims. The repair stage rewrites the draft answer using only planner-selected evidence, drops unsupported claims, and enforces inline citations. Compared with the recall-only multi-step teacher, repair improves citation precision (74.8% vs. 73.1%), citation recall (53.5% vs. 49.7%), answer token F1 (13.0% vs. 12.2%), abstention accuracy (75.0% vs. 72.5%), inline citation rate (72.2% vs. 68.4%), judged answer support (94.4% vs. 89.5%), and overall judged correctness (97.5% vs. 95.0%). The repair run plus judge cost $0.2745655.

Tradeoff: Repair adds cost and still does not beat the prompt-matched `gpt-4o` teacher on abstention accuracy or inline citation compliance on this slice. It is the best current multi-step teacher component, but the next question is whether it scales and whether its outputs actually improve a cheaper student when used as post-training data.

### D27. Scale the repair-stage teacher by offset instead of rerunning examples

Decision: Add `--offset` to the multi-step teacher and judge runners, then run `openai-multistep-teacher-recall-repair-temporal-test-40-80-v1` and its judge on examples 41-80 of `temporal_test`.

Reason: Rerunning the first 40 examples would waste budget and blur the evidence. Offset support lets the experiment scale while keeping the ledger auditable. The second 40-example slice is stronger than the first: 88.5% citation precision, 75.3% citation recall, 21.5% answer token F1, 87.5% abstention accuracy, and 100.0% judged correctness. Combined over the first 80 examples, the repair-stage teacher has 82.9% citation precision, 64.6% citation recall, 17.4% answer token F1, 81.3% abstention accuracy, 97.7% judged answer support, and 98.8% overall judged correctness. The two teacher slices plus judges cost $0.56758475.

Tradeoff: The 80-example repair teacher is high precision and strongly judged, but it is still more expensive than prompt-matched `gpt-4o`, has weaker inline citation compliance, and does not beat the `gpt-4o-mini` student on answer F1 or abstention accuracy. The next step should use repair-stage teacher outputs as candidate post-training labels and test whether filtering them improves a cheaper student, rather than assuming the teacher itself is the final inference policy.

### D28. Treat in-context teacher demonstrations as a scaffold diagnostic, not amortized distillation

Decision: Add `--offset`, `--demo-runs`, `--demo-judge-runs`, and `--demo-limit` to the OpenAI student runner, then run `openai-student-teacher-demo-temporal-test-80-120-v1` on examples 81-120 of `temporal_test` using six judge-filtered repaired-teacher demonstrations from the first 80 examples.

Reason: This tests whether teacher-generated labels can improve a cheaper model without spending on a new teacher slice. On the held-out 40-example slice, the demo scaffold matches the direct mini student on answer-type and abstention accuracy (77.5%), improves citation precision (80.4% vs. 74.1%), inline citation rate (100.0% vs. 79.0%), judged answer support (95.7% vs. 92.6%), and overall judged correctness (97.5% vs. 95.0%). It also answers fewer examples (23 vs. 27), reducing citation recall (53.6% vs. 60.7%) and answer token F1 (18.1% vs. 21.4%). The run plus judge cost $0.0428712, bringing total tracked OpenAI spend to $1.71184505 across 1419 calls.

Tradeoff: In-context teacher demonstrations are not truly amortized: they increase per-query input cost by about 4.1x versus the direct mini baseline on this slice. The result is still useful because it shows judge-filtered teacher labels can steer the student toward safer, more citation-compliant answers. The next paper-relevant experiment should turn these labels into offline post-training data or a compact learned filter and measure amortized cost over repeated inference.

### D29. Export only strict repaired-teacher labels for offline post-training

Decision: Add `grounded-qa-distillation-export-teacher-labels.mjs` and export `teacher-repair-temporal-test-0-80-v1` as the first offline teacher-label packet.

Reason: The previous demo scaffold paid for teacher examples inside every inference prompt, so it was not actually amortized. The export converts the first 80 repaired multi-step teacher predictions plus their judge results into SFT-style labels and rejected audit rows. The strict filter accepts answered labels only when the judge marks them supported, citation ids valid, and every cited id appears inline in the answer; it accepts abstentions only when the judge marks the abstention supported. This yields 65 accepted labels and 15 rejected labels. The rejected rows expose a concrete teacher weakness: 14 answered labels were semantically supported but lacked inline citation ids, and 1 answered label was unsupported.

Tradeoff: This is still a data artifact, not a trained student. Its value is that it creates the right offline object for amortized distillation: a reusable, judge-filtered post-training packet whose $0.56758475 label-generation cost breaks even against the in-context demo scaffold after about 798 future queries if inference can return to direct mini-student cost. The next step should train or fit a compact student/filter on this packet and evaluate on held-out examples 81-172.

### D30. Reject a local keep-answer gate as the amortized student

Decision: Add `grounded-qa-distillation-teacher-label-filter.mjs` and run `teacher-label-filter-temporal-test-80-172-v1`, but do not promote the local filter as the distilled policy.

Reason: The filter trains a logistic keep/force-abstain gate from the first-80 strict teacher-label packet and applies it to held-out direct mini-student predictions on examples 81-172. It makes no LLM calls and therefore preserves direct mini inference cost, but it can only suppress answers, not recover missed answers. On held-out examples, it improves citation precision (78.4% vs. 76.9%) and inline citation rate (92.0% vs. 82.1%), but it forces 7 additional abstentions and degrades answer-type accuracy (77.2% vs. 80.4%), citation recall (56.5% vs. 63.5%), answer F1 (19.8% vs. 22.6%), kept-answer support (91.4% vs. 92.3%), and hybrid judged-support/gold-abstention correctness (79.3% vs. 84.8%).

Tradeoff: This negative result is useful because it rules out a cheap post-hoc abstention gate as the core amortization mechanism. The accepted teacher labels need to train answer generation or citation formatting directly, not only suppress risky mini-student answers.

### D31. Prepare fine-tune JSONL, but require a launch controller before spending

Decision: Add `grounded-qa-distillation-openai-finetune-prep.mjs` and run `openai-finetune-prep-teacher-repair-0-80-v1` without launching a hosted fine-tune job.

Reason: The strict repaired-teacher label packet is now converted into OpenAI chat-format JSONL with 52 training rows and 13 validation rows. The prep estimates about 57,104 train tokens, 10,429 validation tokens, and $0.85656 training cost for 3 epochs of `gpt-4.1-mini-2025-04-14` using the current official fine-tuning price of $5 / 1M training tokens. The project budget has $98.28815495 remaining, so the training estimate is affordable.

Tradeoff: The job is not launched yet because the current runner does not upload files, poll job status, record fine-tune job ids, or append actual training spend to the ledger. Launching without that controller would violate the project's key-budget discipline even if the estimate is small. The next step is a budget-tracked fine-tune launcher that reserves estimated cost, records every OpenAI file/job API call, polls completion, and then evaluates the resulting model on examples 81-172.

### D32. Treat OpenAI self-serve fine-tuning as unavailable for this account

Decision: Extend the fine-tune prep script into a launcher and run `openai-finetune-teacher-repair-0-80-v1`, but do not continue trying OpenAI-hosted self-serve fine-tuning on this key/account.

Reason: The launcher uploaded the train and validation JSONL files, then OpenAI rejected job creation with `training_not_available`: the organization can no longer create new fine-tuning training jobs while OpenAI winds down the fine-tuning platform. No fine-tune job id was created, no training spend was reserved in the ledger, and the uploaded files were deleted after the failed launch. The ledger remains $1.71184505 across 1419 calls, because upload/delete/job-create control-plane calls have no token usage and no fine-tune training occurred.

Tradeoff: This blocks the most direct hosted SFT experiment on the current OpenAI account, but it clarifies the path. The strict teacher-label packet remains valid; the next amortized-student experiment should use a locally trainable/Hugging Face model or another supervised-training backend that can run within the $100 budget and produce a real held-out student evaluation.

### D33. Reject the tiny local teacher-label extractor as the amortized student

Decision: Add `grounded-qa-distillation-teacher-label-scaffold.mjs` and run `teacher-label-scaffold-temporal-test-80-172-v1`, but do not promote it as the distilled student.

Reason: The script trains a local evidence selector, sufficiency model, and span selector using only the 65 strict repaired-teacher labels. It is a true zero-LLM amortized scaffold, but it overfits the first-80 label packet. On held-out temporal-test examples 81-172, it answers only 22 of 92 examples, with 48.9% answer-type accuracy, 56.8% citation precision, 10.9% citation recall, 3.3% answer F1, and 100.0% inline citation rate. The direct mini student on the same held-out slice is much stronger on answer-type accuracy, citation recall, and answer F1.

Tradeoff: This is a useful failure. It shows that the strict teacher labels teach citation formatting and abstention conservatism, but 65 examples are not enough to train a non-generative extractor that replaces a small model. The next step should either produce more repaired-teacher labels or run a real generative SFT/LoRA backend that can learn answer synthesis from the label packet.

### D34. Scale strict labels to 109, but reject the larger local extractor too

Decision: Run the repaired multi-step teacher on temporal-test examples 81-132, judge the outputs, export `teacher-repair-temporal-test-0-132-v1`, and evaluate a larger zero-LLM teacher-label scaffold on examples 133-172.

Reason: The hidden OpenAI key is saved in `~/.codex/secrets.env` with `0600` permissions, so the project is not blocked on secrets. The new teacher slice made 106 ledgered OpenAI calls and cost $0.3703100; the judge pass made 52 calls and cost $0.00694755. Total tracked OpenAI spend is now $2.08910260 across 1577 ledgered calls, leaving $97.91089740 under the $100 cap. The combined strict export now contains 109 accepted labels from 132 repaired-teacher examples: 48 answered labels and 61 abstentions, with 23 rejected answered labels. Despite the larger label pool, `teacher-label-scaffold-temporal-test-132-172-v1` answers only 5 of 40 held-out examples, with 42.5% answer-type accuracy, 90.0% citation precision, 6.5% citation recall, 4.1% answer F1, and 100.0% inline citation rate.

Tradeoff: More strict labels improved label coverage and amortization evidence, but it did not fix answer synthesis for the local extractor. This strengthens the conclusion that the next student experiment needs a generative SFT/LoRA backend or a substantially different learned scaffold, not more hand-built logistic extraction on the same compact evidence format.

### D35. Prepare a Hugging Face LoRA student path before spending GPU time

Decision: Add `grounded-qa-distillation-hf-sft-prep.mjs` and generate `hf-sft-prep-teacher-repair-0-132-qwen05b-v1` as the first Qwen 0.5B LoRA SFT job packet.

Reason: OpenAI self-serve fine-tuning is unavailable on this account, and the zero-LLM extractor failed twice. The next credible amortized student must train generation/citation behavior directly. The HF packet converts the 109 strict teacher labels into 92 train rows and 17 validation rows, preserves 40 future temporal-test prompts for evaluation, emits a TRL/PEFT/Trackio training script, and estimates a bounded `t4-small` job at $0.5625 for a 45-minute timeout. It makes no OpenAI calls and leaves the OpenAI ledger unchanged at $2.08910260. A first attempt to upload the dataset to a Hugging Face dataset repo failed with 403 because the local HF CLI token lacks dataset-create rights. Private GitHub raw URLs were also unavailable to the HF data loader, so the packet now uses a public gist data base: `https://gist.github.com/rprend/6b46b4b77d7f328cd4e6964884013abe`. The generated CPU validator passes against the public gist URLs. Remote HF Jobs submission is still blocked because the CLI token lacks `job.write` and the MCP-authenticated account reports `402 Payment Required` for insufficient prepaid Jobs credits.

Tradeoff: This is a launch-ready training packet, not a trained student yet. It avoids additional OpenAI spend and records the exact HF account blockers. The next execution step is operational rather than methodological: run the prepared CPU validation and GPU LoRA job with a Hugging Face token/account that has `job.write` and prepaid Jobs credits, or switch to a different training backend.

### D36. Reject the teacher-label rubric scaffold as an amortized win

Decision: Add `--scaffold=teacher-label-rubric` to the OpenAI student runner and run `openai-student-teacher-rubric-temporal-test-132-172-v1` plus `openai-judge-student-teacher-rubric-temporal-test-132-172-v1` on future temporal-test examples 133-172.

Reason: HF LoRA training is operationally blocked, so the next runnable student experiment distilled the 109 strict teacher labels into a compact static rubric instead of per-query demonstrations. The rubric captures the teacher label answer rate (44.0%), median citation count (2), median claim count (2), and abstention/citation rules. It made 40 OpenAI student calls costing $0.0087960 and 40 judge calls costing $0.0049242, bringing total OpenAI ledger spend to $2.10282280 across 1657 calls. Compared with the direct mini baseline on the same 40-example slice, the rubric scaffold improves citation precision (86.3% vs. 82.0%), inline citation rate (100.0% vs. 85.7%), answer support (100.0% vs. 92.9%), and overall judged correctness (100.0% vs. 95.0%). But it answers only 17 examples versus 28, reducing answer-type accuracy (67.5% vs. 85.0%), citation recall (39.0% vs. 71.1%), and answer F1 (13.7% vs. 24.3%) while costing slightly more than direct mini prompting.

Tradeoff: This is a useful safety-formatting result but not an amortized grounded-research win. A static rubric can transfer citation discipline from teacher labels, but it mostly does so by over-abstaining. The next student needs either actual generative training, a selective abstention policy that preserves coverage, or a two-stage cheap answer-then-verify scaffold with a tuned coverage target.

### D37. Keep the balanced teacher-label rubric as a partial citation-format control

Decision: Add `--scaffold=teacher-label-balanced-rubric` and run `openai-student-teacher-balanced-rubric-temporal-test-132-172-v1` plus `openai-judge-student-teacher-balanced-rubric-temporal-test-132-172-v1` on the same future 40-example slice.

Reason: The strict rubric proved that teacher labels transfer citation discipline but over-abstain. The balanced variant keeps the inline-citation and claim-table rules while telling the student to answer when evidence directly supports a useful narrow answer. It made 40 OpenAI student calls costing $0.0098970 and 40 judge calls costing $0.00424935, bringing total OpenAI ledger spend to $2.11696915 across 1737 calls. Compared with the strict rubric, it recovers answer coverage (30 answered vs. 17), answer-type accuracy (80.0% vs. 67.5%), citation recall (59.5% vs. 39.0%), and answer F1 (21.4% vs. 13.7%) while preserving 100.0% inline citation rate. Compared with the direct mini baseline, it preserves overall judged correctness (95.0% vs. 95.0%) and improves inline citation rate (100.0% vs. 85.7%), but it loses answer-type accuracy (80.0% vs. 85.0%), citation precision (77.2% vs. 82.0%), citation recall (59.5% vs. 71.1%), and answer F1 (21.4% vs. 24.3%).

Tradeoff: The balanced rubric is a useful ablation: static teacher-label distillation can fix citation format without destroying judged support, but it still does not beat direct mini prompting on answer quality. The next runnable path should target a hybrid policy that applies teacher-label constraints only when they are likely to repair citation format, rather than changing the whole answer/abstention policy.

### D38. Treat local citation-contract repair as necessary but not sufficient

Decision: Add `grounded-qa-distillation-citation-contract-repair.mjs` and run `citation-contract-repair-direct-mini-temporal-test-132-172-v1` plus `openai-judge-citation-contract-repair-direct-mini-temporal-test-132-172-v1`.

Reason: Direct mini prompting has the best answer coverage on the future 40-example slice but misses inline citation markers in some answers. A zero-LLM local repair can preserve the direct answer and citation ids while appending any missing cited ids inline. The repair changed 4 of 40 rows, repaired 8 missing inline citation markers, preserved direct mini answer-type accuracy (85.0%), citation precision (82.0%), citation recall (71.1%), and answer F1 (24.3%), and raised inline citation rate from 85.7% to 100.0% with no additional student-model calls. However, the fresh judge pass dropped answer support from 92.9% to 89.3% and overall judged correctness from 95.0% to 92.5%. A row-level diff shows one changed row became unsupported after appending `[E4]`, while two unchanged rows also flipped verdicts, indicating some judge sensitivity.

Tradeoff: Citation-contract repair is still a required output-normalization component, because the final system must guarantee inline citations. But it cannot by itself prove citation-grounded correctness. The next hybrid should combine local citation repair with a selective verification/abstention step or judge-calibrated confidence model, rather than treating string-level citation insertion as sufficient.

### D39. Treat policy routing over existing scaffolds as an analysis control, not the final student

Decision: Add `grounded-qa-distillation-policy-selector.mjs` and run `policy-selector-temporal-test-132-172-v1` over the already-generated direct mini, strict rubric, balanced rubric, and citation-contract-repair predictions.

Reason: The previous experiments show a three-way tradeoff: direct mini has the best answer quality but weak inline citation compliance, strict rubric is safest but over-abstains, and balanced rubric recovers coverage but loses precision. The selector routes locally with zero new LLM calls: prefer direct mini when it answers with complete inline citations, use balanced rubric when direct mini violates the citation contract or abstains, fall back to strict rubric, then citation repair. It selects direct mini for 24 rows, balanced rubric for 7, and citation repair for 9. The resulting hybrid answers 31 of 40 examples, reaches 82.5% answer-type accuracy, 77.96% citation precision, 70.24% citation recall, 23.36% answer F1, and 100.0% inline citation rate. However, inherited judged correctness is only 92.5%, below the direct mini baseline's 95.0%.

Tradeoff: Routing among existing cheap policies helps recover citation recall while keeping the output contract, but it does not solve support preservation. This is a useful analysis control and suggests the next meaningful selector needs a verifier or confidence model trained on independent support labels, not only deterministic routing rules.

### D40. Reject the first no-leak local verifier selector as insufficient

Decision: Build a clean train/eval candidate-verifier split, add `grounded-qa-distillation-verifier-selector.mjs`, and run `verifier-selector-noleak-temporal-test-80-132-to-132-172-v1`.

Reason: The previous policy selector used only the final 40-example slice, so it could not test whether a support-aware router transfers across KB time. I generated strict-rubric and balanced-rubric student candidates for examples 81-132, added citation-contract repair for the same slice, and judged the three new candidate sets. Together this made 260 ledgered OpenAI calls and moved tracked spend from $2.12155690 to $2.16825880, leaving $97.83174120 under the $100 cap. The verifier trains a zero-call logistic candidate scorer on examples 81-132 using only deployable features: policy id, answer/abstain status, inline-complete flag, citation/claim/answer length, and inter-policy agreement. I explicitly removed an invalid exploratory run that used gold-derived citation precision/recall as features, and the validator now rejects those leakage feature names. On held-out examples 133-172, the clean verifier answers 31 of 40 examples with 82.5% answer-type accuracy, 77.96% citation precision, 68.45% citation recall, 21.03% answer F1, 100.0% inline citation rate, 92.5% inherited judged correctness, and 77.5% target-good rate. It therefore does not beat direct mini's 95.0% judged correctness or the deterministic policy selector's answer F1.

Tradeoff: This is still useful because the oracle over the same candidates reaches 92.5% target-good rate, showing candidate choice matters, but the small no-leak verifier does not learn the right routing rule from one 52-example temporal window. The next selector needs either more train windows, richer non-gold verifier features that inspect evidence/claim alignment, or a cheap learned entailment verifier; simple candidate metadata is not enough.

### D41. Keep evidence-aware verifier features as a partial routing improvement, not a support solution

Decision: Extend `grounded-qa-distillation-verifier-selector.mjs` with deployable evidence-alignment features and run `verifier-selector-evidence-aware-temporal-test-80-132-to-132-172-v1`.

Reason: D40 showed simple metadata and inter-policy agreement were not enough. The new verifier adds no-LLM features that compare the candidate answer and claim table against cited evidence: valid citation rate, retrieval-rank shape, answer unigram/bigram overlap with cited evidence, answer overlap with the full evidence pack, minimum/mean claim overlap with cited evidence, numeric value support, question overlap with cited evidence, and question overlap with the full evidence pack for abstention calibration. These features use only question, candidate output, cited ids, and retrieved evidence; they do not use gold answers, gold evidence roles, or reference citation labels. On examples 133-172, the evidence-aware selector improves over the no-leak metadata selector on answer-type accuracy (85.0% vs. 82.5%), citation precision (80.56% vs. 77.96%), answer F1 (22.28% vs. 21.03%), and target-good rate (80.0% vs. 77.5%), while keeping 100.0% inline citation compliance. It does not improve inherited judged correctness, which remains 92.5%, still below the direct mini baseline's 95.0%.

Tradeoff: Evidence-aware lexical features are directionally useful and cheap, but still too shallow for support preservation. The next verifier should either learn entailment over cited evidence spans or use stronger claim/evidence matching features; lexical overlap alone cannot distinguish supported answers from plausible but wrong cited answers.

### D42. Promote train-calibrated abstention routing as the current best cheap scaffold

Decision: Add an optional train-calibrated abstention override to `grounded-qa-distillation-verifier-selector.mjs` and run `verifier-selector-evidence-aware-abstention-calibrated-temporal-test-80-132-to-132-172-v1`.

Reason: The D41 failure analysis showed that most remaining target failures were answerability errors: answers on counterfactual insufficient-evidence packs, plus two answerable examples where every candidate abstained. The new selector tunes one margin on examples 81-132: if the top ranked candidate is an answer but an abstaining candidate is within the learned rank margin, switch to abstention. The selected margin is 0.15 and the held-out run makes no LLM calls. On examples 133-172, it answers 29 of 40 examples, reaches 87.5% answer-type accuracy, 83.33% citation precision, 68.45% citation recall, 22.28% answer F1, 100.0% inline citation rate, 95.0% inherited judged correctness, and 82.5% target-good rate. This is the first cheap hybrid that matches direct mini's 95.0% judged correctness while fixing its inline citation failures.

Tradeoff: This is the current best scaffold, but still not a paper-grade answer. It improves abstention calibration and output contract compliance, but it does not beat direct mini on answer F1 or citation recall, and target-good remains well below the 92.5% candidate oracle. The next step should attack the two hard limits separately: generate better answer candidates for answerable examples where all policies abstain, and train a stronger evidence-entailment verifier for counterfactual packs where supported-looking distractor evidence fools the answerer.

### D43. Reject answer-recovery as an unfiltered candidate-pool expansion

Decision: Add `--scaffold=answer-recovery` to `grounded-qa-distillation-openai-student.mjs`, run repaired recovery candidates on examples 81-132 and 133-172, judge both windows, and evaluate `verifier-selector-recovery-pool-temporal-test-80-132-to-132-172-v1` with recovery as an opt-in selector candidate.

Reason: D42 showed two answerable held-out examples where every existing policy abstained, so I tested whether an extractive recovery prompt could add useful answer candidates. The recovery student made 92 OpenAI calls and the recovery judge made 92 calls, moving tracked OpenAI spend from $2.16825880 to $2.19895645, leaving $97.80104355 under the $100 cap. The repaired recovery candidate improves held-out answer F1 as a standalone candidate (25.5%) and the recovery-pool selector reaches 23.98% answer F1, higher than the calibrated scaffold's 22.28%. But support and answerability safety collapse: the repaired recovery standalone has only 87.5% judged correctness on examples 133-172, and the recovery-pool selector also drops to 87.5% inherited judged correctness because it over-selects recovery on 27 of 40 rows after seeing 100% train-window judged correctness.

Tradeoff: Recovery prompting is useful as a diagnostic for answer synthesis, but not safe as an unfiltered candidate-pool expansion. The selector overfits the train-window recovery support labels and cannot detect held-out distractor failures. Future recovery candidates need a stronger independent entailment verifier or a much stricter trigger, such as only firing on answerable-looking table/float evidence with no counterfactual withholding signal.

### D44. Keep row-level answerability guard as a high-safety variant, not the default scaffold

Decision: Add a train-calibrated row-level answerability guard to `grounded-qa-distillation-verifier-selector.mjs` and run `verifier-selector-answerability-guard-temporal-test-80-132-to-132-172-v1`.

Reason: The D42/D43 failure analysis showed that the remaining cheap-scaffold errors are mostly answerability mistakes: supported-looking answers on insufficient packs and abstentions on answerable examples. The new guard trains a second zero-call logistic model on examples 81-132 using only deployable row features: top candidate answer/abstain status, verifier score, answer-vs-abstain rank gap, candidate answer consensus, question/evidence overlap, and top-answer evidence-alignment features. It tunes one threshold on the train window and applies it to examples 133-172 by overriding answered selections to an existing abstaining candidate when row answerability is low. It makes no LLM calls. On held-out examples, inherited judged correctness improves from 95.0% to 97.5%, but answered examples drop from 29 to 25, answer-type accuracy falls from 87.5% to 82.5%, citation recall falls from 68.45% to 61.31%, and answer F1 falls from 22.28% to 20.65%.

Tradeoff: This is a useful high-safety operating point for domains where unsupported answers are much more costly than abstentions. It is not the default scaffold because the project goal is amortized grounded QA with useful answer coverage, not maximum abstention. The default remains the evidence-aware + calibrated abstention selector; the next paper-relevant improvement needs to improve support without giving up as much answer coverage.

### D45. Reject coverage-preserving answerability gating as a support improvement

Decision: Add `--answerability-coverage-floor` to `grounded-qa-distillation-verifier-selector.mjs` and run `verifier-selector-answerability-guard-coverage-preserving-temporal-test-80-132-to-132-172-v1` with a 100% train-window answer-coverage floor.

Reason: D44 improved support by lowering answer coverage, so I tested whether the same row-level answerability model could be constrained to preserve the default calibrated selector's train coverage. With the full coverage floor, the tuner selects no answerability threshold and reproduces the D42 default scaffold on held-out examples: 29 of 40 answered, 87.5% answer-type accuracy, 83.33% citation precision, 68.45% citation recall, 22.28% answer F1, 100.0% inline citation rate, 95.0% inherited judged correctness, and 82.5% target-good rate. The run makes no LLM calls and leaves tracked OpenAI spend unchanged at $2.19895645.

Tradeoff: This rules out simple coverage-constrained row answerability gating as the next support fix. The support/coverage tradeoff is real in the current candidate pool: preserving coverage keeps the old errors, while improving judged support requires abstaining more. The next useful step should add better evidence-entailment signals or better candidates, not another threshold on the same row-level features.

### D46. Reject a simple direct-mini policy prior as the missing router

Decision: Add `--rank-direct-inline-bonus` to `grounded-qa-distillation-verifier-selector.mjs` and run `verifier-selector-direct-prior-temporal-test-80-132-to-132-172-v1` with a small 0.02 rank bonus for inline-complete direct-mini candidates.

Reason: Failure inspection showed that the calibrated selector never chose the direct-mini candidate on examples 133-172 even though direct-mini was often an oracle-good candidate. The direct-prior ablation tests whether the verifier's learned policy weights were over-preferring citation repair and rubric candidates. The run makes no LLM calls. It shifts the held-out policy mix from 25 citation-repair / 11 strict-rubric / 4 balanced-rubric to 26 direct / 9 strict-rubric / 4 balanced-rubric / 1 citation-repair while preserving 100.0% inline citation rate. However, the quality metrics are effectively unchanged: 29 of 40 answered, 87.5% answer-type accuracy, 83.33% citation precision, 68.45% citation recall, 22.38% answer F1, 95.0% inherited judged correctness, and 82.5% target-good rate.

Tradeoff: The direct prior is a useful control because it proves the current plateau is not just an arbitrary preference for repaired outputs. Direct-mini and repaired/rubric candidates fail on different rows, and the selector needs a stronger evidence-entailment signal to choose between them. Keep the option as an ablation knob, but do not promote it as the default scaffold.

### D47. Reject local citation-window features as the missing entailment verifier

Decision: Add stricter local citation-window and claim-nearest-citation features to `grounded-qa-distillation-verifier-selector.mjs` and run `verifier-selector-local-entailment-temporal-test-80-132-to-132-172-v1`.

Reason: D46 showed the plateau is not just a policy prior, and failure inspection showed some candidates cite globally plausible evidence while the local answer claim is not actually supported. The new features remain deployable and no-leak: local citation-window token coverage, claim-to-nearest-citation coverage, citation marker density, and citation-order monotonicity. They make no LLM calls and use only the candidate answer, claim table, cited ids, question, and retrieved evidence. On the held-out examples 133-172, the selector's behavior is unchanged from D42: 29 of 40 answered, 87.5% answer-type accuracy, 83.33% citation precision, 68.45% citation recall, 22.28% answer F1, 100.0% inline citation rate, 95.0% inherited judged correctness, and 82.5% target-good rate.

Tradeoff: This closes another cheap-feature avenue. Local lexical citation windows are too weak to act as an entailment verifier; they do not distinguish direct, repaired, and rubric candidates on the hard rows. The next paper-relevant verifier step should use a learned entailment model, a stronger independent LLM verifier with budgeted calls, or a different candidate generator, rather than more handcrafted token-overlap features.

### D48. Treat the stronger judge as a warning against mini-judge-only claims

Decision: Run `gpt-4o` as a stronger independent judge on the current default calibrated selector and the high-safety answerability-guarded selector: `openai-judge-gpt4o-verifier-selector-calibrated-temporal-test-132-172-v1` and `openai-judge-gpt4o-verifier-selector-answerability-guard-temporal-test-132-172-v1`.

Reason: The previous selector decisions inherited `gpt-4o-mini` judge labels. A stricter independent judge is needed before making paper claims about citation-grounded correctness. The two stronger-judge runs made 80 ledgered OpenAI calls and cost $0.1471475 total, moving tracked spend from $2.19895645 to $2.34610395. I also patched the judge normalizer to map `exactly_supported` and `fully_supported` to `supported`, then repaired the first run's saved judgments from raw responses without extra API calls. Under `gpt-4o`, the default calibrated selector drops from 95.0% inherited mini-judged correctness to 82.5% judged correctness, with 75.9% answer support and 100.0% abstention support. The high-safety answerability guard scores better under the stronger judge: 87.5% overall, 80.0% answer support, and 100.0% abstention support, while answering 25 rather than 29 examples.

Tradeoff: This does not make `gpt-4o` an unquestionable ground truth, but it exposes a real paper risk: the mini judge is too lenient on plausible overclaims. For support-first reporting, the high-safety guard should now be treated as the stronger-judge preferred scaffold. For useful answer coverage, the default calibrated selector remains the balanced scaffold, but its correctness claims must be qualified until judged by a calibrated independent or human verifier.

### D49. Reject one-window stronger-judge selector training as a transfer fix

Decision: Judge the train-window candidate pool with `gpt-4o`, then run `verifier-selector-gpt4o-train-temporal-test-80-132-to-132-172-v1` and judge its held-out selected outputs with `gpt-4o`.

Reason: D48 showed that the mini judge is too lenient, so I tested whether training the selector target on stricter train-window labels improves held-out support. I judged the four train-window candidate policies with `gpt-4o`: direct mini, strict rubric, balanced rubric, and citation-contract repair. The train candidate judging plus held-out selected-output judging made 248 new ledgered OpenAI calls and cost $0.4954775, bringing tracked spend to $2.84158145. On the train window, the strict rubric has the best `gpt-4o` overall correctness at 82.7%, direct and citation repair are both 80.8%, and balanced rubric is 75.0%. The resulting selector mostly routes to direct mini on held-out examples, answering 28 of 40 with 100.0% inline citation compliance. But under the held-out `gpt-4o` judge it reaches only 77.5% overall judged correctness and 67.9% answer support, worse than both the default calibrated selector (82.5%) and the high-safety answerability guard (87.5%).

Tradeoff: Stronger labels are necessary for evaluation, but one 52-example temporal train window is not enough to train a robust stronger-judge router. It overfits policy preferences and does not learn transferable support signals. The next step should either collect more temporally diverse stronger-judge training windows, use a real learned entailment model, or improve answer candidates so the selector is not choosing among several overclaiming answers.

### D50. Reject quote-extractive prompting as a support-preserving candidate fix

Decision: Add `--scaffold=quote-extractive` to `grounded-qa-distillation-openai-student.mjs`, run `openai-student-quote-extractive-temporal-test-132-172-v1`, repair its citation contract, and judge the repaired outputs with `gpt-4o`.

Reason: Stronger-judge failures are mostly plausible overclaims, so I tested whether a stricter prompt that asks for quote-near, one-evidence answers would improve candidate quality. The quote-extractive student made 40 `gpt-4o-mini` calls, the stronger judge made 40 `gpt-4o` calls, and the local citation repair made no calls. This added $0.0780571 and moved tracked spend to $2.91963855. The repaired quote-extractive candidate answers 26 of 40 examples, reaches 85.0% answer-type accuracy, 87.18% citation precision, 52.38% citation recall, 24.10% answer F1, and 100.0% inline citation rate. That is the best answer F1 among current safe-format candidates, but `gpt-4o` judges only 65.4% of answered predictions supported and 77.5% overall correct.

Tradeoff: Quote-extractive prompting improves lexical answer overlap and citation precision, but it still overclaims under a stronger support judge. It is useful as an answer-quality diagnostic candidate, not a support-preserving replacement for the high-safety guard. The next candidate-generation step needs either claim-level answer pruning/verification or teacher-generated labels that explicitly remove unsupported subclaims.

### D51. Treat claim pruning as teacher-label construction, not a deployable support fix

Decision: Add `grounded-qa-distillation-openai-claim-pruner.mjs`, run claim-pruning over the repaired quote-extractive candidate with both `gpt-4o-mini` and `gpt-4o`, repair the citation contract locally, and judge both repaired outputs with `gpt-4o`.

Reason: D50 showed that quote-near prompting improves lexical answer quality but leaves many plausible overclaims. The new pruner receives the question, source prediction, and compact evidence pack, then must drop unsupported claims or abstain. The mini pruner made 26 calls and cost $0.0052359; after local citation repair, its stronger-judge pass cost $0.07063 and scored 80.0% overall with 68.0% answer support. The `gpt-4o` pruner also made 26 calls and cost $0.078995; after local citation repair, its stronger-judge pass cost $0.07178 and scored 82.5% overall with 70.8% answer support. Total new ledgered spend was $0.2266409, moving tracked spend to $3.14627945 across 2761 OpenAI calls.

Tradeoff: Stronger claim pruning is directionally useful: the `gpt-4o` pruner reaches the best answer F1 in this slice (26.39%) and the best citation precision among answer-rich candidates (90.28%). But it still trails the high-safety answerability guard's 87.5% `gpt-4o` judged correctness, and it is itself an expensive teacher/verifier pass. Use it to construct stricter teacher labels or failure cases for a future student, not as the amortized scaffold.

### D52. Export claim-pruned labels with full upstream cost accounting

Decision: Extend `grounded-qa-distillation-export-teacher-labels.mjs` with `--extra-cost-runs`, export `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1`, and prepare `hf-sft-prep-teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-qwen05b-v1`.

Reason: D51 said the `gpt-4o` claim pruner is not a deployable scaffold but is useful for teacher-label construction. The export converts the repaired `gpt-4o` claim-pruner outputs plus `gpt-4o` judgments into 33 strict SFT labels from 40 examples: 17 answered labels and 16 abstentions, with 7 rejected answered rows. I added explicit upstream cost accounting because the local citation-repair run costs $0 while the actual label construction depends on the upstream pruner. The packet now records $0.078995 for the pruner, $0.07178 for the judge, $0.150775 total labeling cost, and a 212-query break-even against the in-context demo scaffold if downstream inference returns to direct-student cost. The generated HF LoRA prep has 28 train rows, 5 validation rows, and 40 same-window eval prompts; the local dataset validator passes and makes no OpenAI calls.

Tradeoff: This is a better post-training artifact, not a new held-out quality result. The packet uses the final available temporal-test window, so its eval prompts are useful for overfit/reproduction checks but not for paper-grade generalization. The next data step should create a new later temporal/private-KB snapshot or reserve a fresh benchmark window before training on these labels.

### D53. Build an extended paper-disjoint future holdout before training on claim-pruned labels

Decision: Add pagination and non-destructive output prefixes to `grounded-qa-distillation-build.mjs`, add output prefixes to `grounded-qa-distillation-temporalize.mjs`, add `grounded-qa-distillation-carve-holdout.mjs`, and generate `extended_temporal_future_holdout`.

Reason: D52 created claim-pruned labels from the last 40 examples in the original temporal-test slice, so using that same slice for evaluation would not support paper-grade generalization claims. The original seed corpus used only 40 source QASPER rows per split, but Hugging Face reports 1,585 QASPER rows total. I built an extended corpus from all available source rows exposed by the Dataset Viewer: 5,628 derived examples across `extended_train`, `extended_validation`, and `extended_test`. Chronological temporalization gives `extended_temporal_test` with 2,682 examples on 520 papers from 2019-08 through 2020-04. I then carved a fresh March-April 2020 holdout while excluding all 7 papers and 40 examples from the claim-pruned teacher-label packet. The resulting `extended_temporal_future_holdout` has 389 examples on 77 papers: 254 answerable and 135 abstentions. I also exported it to SFT format and prepared `hf-sft-prep-teacher-repair-claim-pruner-gpt4o-quote-extractive-future-holdout-qwen05b-v1`, which trains on the 33 claim-pruned labels and evaluates on all 389 future holdout prompts. This made no OpenAI calls and leaves tracked spend at $3.14627945.

Tradeoff: This fixes the immediate label/eval overlap problem for the claim-pruned training path, but it is still a QASPER/arXiv-date proxy, not a true private evolving KB. The paper still needs either trusted document timestamps or a private-KB update stream, plus an actual trained/evaluated compact student on this future holdout.

### D54. Reject static claim-pruned rubric distillation on the fresh future holdout

Decision: Run a bounded 80-example `extended_temporal_future_holdout` comparison between direct `gpt-4o-mini` prompting and a `teacher-label-balanced-rubric` student distilled from `teacher-repair-claim-pruner-gpt4o-quote-extractive-132-172-v1`, repair inline citation contracts locally, and judge both repaired outputs with `gpt-4o`.

Reason: D53 created a paper-disjoint future holdout, so the next question was whether the 33 claim-pruned labels transfer as a cheap static rubric. The direct mini run made 80 calls and cost $0.0176652. The claim-pruned rubric run made 80 calls and cost $0.0207288. The two `gpt-4o` judge passes made 160 calls and cost $0.3102875. Total new ledgered OpenAI spend was $0.3486815, moving tracked spend to $3.49496095 across 3081 calls. After local citation repair, direct mini answers 63 of 80 with 76.3% answer-type accuracy, 66.1% citation precision, 68.8% citation recall, 25.7% answer F1, and 100.0% inline citation rate. The claim-pruned rubric answers 61 of 80 with 71.3% answer-type accuracy, 65.6% citation precision, 60.6% citation recall, 23.5% answer F1, and 100.0% inline citation rate. Under `gpt-4o`, both reach only 72.5% overall judged correctness; direct mini has 65.1% answer support and the rubric has 63.9%.

Tradeoff: Static rubric distillation transfers formatting discipline but not support-preserving reasoning on a fresh future holdout. The result strengthens the case that the post-training object must be an actual trained/fitted student or verifier, not a prompt summary of teacher labels. The next step should train the prepared Qwen LoRA or build a learned selector over future-holdout candidates, then judge on the same paper-disjoint split.

### D55. Reject a two-policy future-holdout selector as the fitted verifier

Decision: Attempt the prepared Hugging Face Qwen 0.5B LoRA job, then fall back to a zero-call learned selector over future-holdout candidates after HF Jobs returned `402 Payment Required` for insufficient prepaid credits. I added `--policy-set` to `grounded-qa-distillation-verifier-selector.mjs`, generated and repaired direct-mini and claim-pruned-rubric candidates for `extended_temporal_future_holdout` examples 81-160, judged both repaired candidate sets with `gpt-4o`, and trained `verifier-selector-future-holdout-direct-vs-claim-rubric-0-80-to-80-160-v1` on examples 1-80 before evaluating on examples 81-160.

Reason: D54 showed static rubric distillation does not transfer support-preserving reasoning, so the next available fitted object was a selector trained on stronger-judge labels from one future-holdout window. The new candidate and judge runs made 320 ledgered OpenAI calls and cost $0.341271, moving tracked spend to $3.83623195 across 3401 calls. On the disjoint eval window, direct mini plus citation repair answers 58 of 80 with 86.3% answer-type accuracy, 68.97% citation precision, 73.04% citation recall, 23.94% answer F1, 100.0% inline citation rate, 70.7% answer support, and 78.75% `gpt-4o` overall judged correctness. The claim-pruned rubric plus repair answers 57 of 80 with 85.0% answer-type accuracy, 69.30% citation precision, 62.75% citation recall, 23.66% answer F1, 100.0% inline citation rate, 61.4% answer support, and 72.5% overall judged correctness. The selector chooses direct on 71 examples and balanced rubric on 9, answers 56, reaches 88.75% answer-type accuracy, 70.54% citation precision, 73.04% citation recall, 24.63% answer F1, 100.0% inline citation rate, but only 77.5% inherited judged correctness.

Tradeoff: This is a useful amortization control but not a support improvement. The learned router slightly improves answer-type accuracy and answer F1 over direct-only on the second future slice, but it loses overall stronger-judged correctness. The oracle target-good rate is 78.75%, barely above the direct candidate, so this two-policy pool has little remaining routing headroom. The next paper-relevant step should either unblock true LoRA/generative student training, add materially different candidates, or collect a larger/diverse stronger-judged training set before claiming a learned verifier transfers over evolving KB snapshots.

### D56. Treat mini claim pruning as positive teacher-label construction, not amortized inference

Decision: Add `grounded-qa-distillation-failure-analysis.mjs`, run `failure-analysis-future-holdout-direct-vs-claim-rubric-0-160-v1`, then run `gpt-4o-mini` claim pruning over the direct repaired future-holdout examples 81-160 as `openai-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1`. I repaired the pruned outputs locally and judged them with `gpt-4o`.

Reason: The failure analysis found that direct and claim-pruned-rubric candidates have limited routing headroom on the first 160 future-holdout examples: 104 rows both correct, 17 direct-only correct, 12 rubric-only correct, and 27 rows where both are wrong. The wrong cases are unsupported answers, not unsupported abstentions: direct has 39 unsupported answered predictions and zero wrong abstentions; the rubric has 44 unsupported answered predictions and zero wrong abstentions. That makes answer recovery the wrong next move and points to claim pruning or support gating. The mini claim-pruner made 58 OpenAI calls for answered direct predictions and passed through 22 abstentions at no cost, adding $0.0134595. The stronger judge pass made 80 `gpt-4o` calls and cost $0.14925. Total new spend was $0.1627095, moving tracked spend to $3.99894145 across 3539 calls. After local citation repair, the pruned candidate answers 58 of 80, preserves 86.3% answer-type accuracy, raises answer F1 from direct repair's 23.94% to 28.04%, and reaches 80.0% `gpt-4o` judged correctness with 72.4% answer support, compared with direct repair's 78.75% judged correctness and 70.7% answer support on the same examples.

Tradeoff: This is the first positive support movement on the second future-holdout slice, and it gives a better label-construction path than static rubric transfer. It is not a final amortized scaffold because it adds a per-query pruner pass and still leaves 20.0% of rows judged incorrect. The next aligned step is to export accepted pruned labels from the future windows into a larger strict SFT packet or train a support-risk gate from these pruner/judge traces, while preserving a later untouched future window for evaluation.

### D57. Export future-window claim-pruned labels and reserve a later eval window

Decision: Run `gpt-4o-mini` claim pruning on direct repaired future-holdout examples 1-80, repair its citation contract locally, judge the repaired output with `gpt-4o`, then export a combined strict label packet from claim-pruned future-holdout examples 1-160 as `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`. I also updated `grounded-qa-distillation-export-teacher-labels.mjs` so cost accounting can use explicit baseline/demo slices, and prepared `hf-sft-prep-claim-pruner-mini-direct-future-holdout-0-160-to-160-240-qwen05b-v1` with examples 161-240 held out for evaluation.

Reason: D56 showed mini claim pruning can improve answer F1 and stronger-judge correctness on the second future window, but the paper needs post-training data rather than another per-query verifier. On examples 1-80, mini claim pruning made 63 calls and cost $0.01466475; the `gpt-4o` judge made 80 calls and cost $0.147715. After citation repair, the first-window pruned candidate reaches 75.0% `gpt-4o` judged correctness and 68.3% answer support, versus the direct repaired candidate's 72.5% judged correctness and 65.1% answer support. Combining the first and second future windows yields 160 candidate labels, of which the strict export accepts 124: 85 answered and 39 abstentions, rejecting 36 unsupported answered labels. The total offline labeling cost for the packet is $0.32508925, counting the two mini-pruner runs plus two `gpt-4o` judge runs. This turn added $0.16237975 and moved tracked OpenAI spend to $4.16132120 across 3682 calls.

Tradeoff: This creates the first future-window post-training packet with enough accepted labels to make a small SFT/LoRA experiment plausible, while preserving a later disjoint future window for evaluation. It is still not paper-complete: HF Jobs remains blocked by account credits, and the packet comes from a QASPER/arXiv temporal proxy rather than a true private evolving KB. The next step should train/evaluate the prepared Qwen LoRA or, if HF compute stays blocked, build a no-GPU fitted risk gate from these 124 labels and test it on examples 161-240.

### D58. Keep the future-window support-risk gate as a high-safety scaffold

Decision: Add `grounded-qa-distillation-risk-gate.mjs` and run `risk-gate-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` on the untouched future-holdout examples 161-240. The gate trains only on the accepted/rejected answered-label traces from `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`, then applies a local logistic support-risk score to direct mini plus citation-repair predictions.

Reason: HF LoRA training remains blocked by prepaid Jobs credits, so the next available fitted experiment was a no-GPU verifier scaffold. The gate uses only deployable lexical, citation, claim, numeric, and evidence-alignment features; it makes zero LLM calls at inference and only converts low-score answers to abstentions. On training traces, the selected threshold preserves 70.6% accepted-label recall with 85.7% precision. On future examples 161-240, direct mini plus local citation repair answers 64 of 80 examples and reaches 73.75% `gpt-4o` judged correctness with 67.2% answer support. The risk gate answers 42 of 80 examples and reaches 88.75% `gpt-4o` judged correctness with 83.3% answer support and 94.7% abstention support. The actual run added 240 ledgered OpenAI calls for the direct mini baseline plus two stronger-judge passes, costing $0.32946030 and moving tracked OpenAI spend to $4.49078150 across 3922 calls.

Tradeoff: This is the strongest future-holdout support result so far, and it is genuinely amortized after the offline label/judge cost because the gate itself is local. It is not a default answer-quality student: it drops answer coverage from 64 to 42 answers, answer-type accuracy from 77.5% to 60.0%, citation recall from 61.7% to 46.9%, and answer F1 from 26.1% to 19.8%. Treat it as a high-safety operating point and as evidence that strict teacher-label traces can train a useful support-risk filter. The paper still needs either a trained generative student or a less conservative verifier that preserves more coverage.

### D59. Add an inherited-judge sweep and promote threshold 0.65 as the balanced risk-gate point

Decision: Add `grounded-qa-distillation-risk-gate-sweep.mjs`, replay lower risk-gate thresholds using existing paid `gpt-4o` judgments, and materialize `risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1` at threshold 0.65.

Reason: D58 established that threshold 0.70 is a strong support-first result, but it over-abstains. A lower-threshold sweep can be evaluated without new LLM calls because kept answers inherit the direct-repair judge labels and any abstention made by a lower threshold is a subset of the already-judged threshold-0.70 abstentions. The sweep shows a smooth precision/coverage tradeoff: direct repair at threshold 0.20 answers 64 examples with 73.75% judged correctness; threshold 0.55 answers 57 with 80.0%; threshold 0.65 answers 48 with 85.0%; threshold 0.70 answers 42 with 87.5%. The materialized 0.65 run makes zero LLM calls, gates 16 risky answers, and improves local citation precision from 59.8% to 68.3% while preserving more answer coverage, citation recall, and answer F1 than the high-safety 0.70 run. The OpenAI ledger remains unchanged at $4.49078150 across 3922 calls.

Tradeoff: The 0.65 point is the best current balanced operating point, but it still gives up substantial coverage versus direct mini repair and its correctness is inherited from existing judgments rather than a fresh independent pass. This is acceptable for threshold selection because every row-level decision is covered by existing paid judgments, but paper reporting should present both points: 0.65 for balanced amortized operation and 0.70 for support-first operation.

### D60. Treat the balanced risk gate as transferring, but still coverage-limited

Decision: Evaluate the fixed threshold-0.65 balanced risk gate on the next untouched future-holdout window, examples 241-320, and judge both direct repair and the gated predictions with `gpt-4o`.

Reason: D59 selected threshold 0.65 using inherited judgments on examples 161-240, so the next question was whether the operating point transfers to a later future snapshot. The direct `gpt-4o-mini` student made 80 ledgered calls costing $0.01720035, then local citation repair and the risk gate made zero calls. The two `gpt-4o` judge passes made 160 calls costing $0.31442250. Total tracked OpenAI spend moved from $4.49078150 to $4.82240435 across 4162 calls, leaving $95.17759565 under the $100 cap. On examples 241-320, direct repair answers 64 of 80 examples and reaches 71.25% `gpt-4o` judged correctness with 64.1% answer support. The fixed balanced gate answers 46 of 80 examples and reaches 80.0% judged correctness with 69.6% answer support and 94.1% abstention support. It also enforces 100.0% inline citation compliance while improving local citation precision from 60.5% to 64.7%.

Tradeoff: This is real transfer evidence for amortizing teacher/judge traces into a local support-risk scaffold: the fixed gate improves stronger-judged correctness on a later window without per-query model calls. But it is not enough for a final paper claim. The correctness gain is smaller than on the threshold-selection window, answer support remains below 70%, and coverage drops from 64 to 46 answers. The next technical target should be a generative student or a two-stage policy that recovers answerable examples after support gating, not further threshold tuning on the same risk score.

### D61. Reject same-feature support gating trained on more direct-judge labels

Decision: Export `judge-support-direct-repair-future-holdout-0-320-v1` from existing `gpt-4o` judgments over direct mini plus citation-repair predictions, train `risk-gate-judge-support-direct-repair-future-holdout-320-389-v1`, and compare it against the earlier claim-pruner-label gate on the final untouched future-holdout tail, examples 321-389.

Reason: D60 showed that the claim-pruner-label gate transfers, but it is coverage-limited. A natural next test was whether the same local feature family improves when trained on more examples that match the direct-student deployment distribution. The export reuses existing paid judgments and makes no LLM calls, producing 249 answered support labels from examples 1-320: 167 supported and 82 rejected. On examples 321-389, direct mini made 69 calls costing $0.01467270; the three `gpt-4o` judge passes over direct repair, the old gate, and the new judged-support gate cost $0.41515000. Total tracked OpenAI spend moved to $5.25222705 across 4438 calls. Direct repair answers 53 of 69 and reaches 72.46% `gpt-4o` judged correctness. The old claim-pruner-label gate answers 44 and reaches 79.71% correctness with 70.45% answer support. The new judged-support gate answers 41 and also reaches 79.71% correctness, but with lower answer support at 68.29%.

Tradeoff: More on-policy stronger-judge labels did not improve this logistic lexical support gate. The result points away from collecting more of the same direct-judge labels for this feature family. The next meaningful step should change the model class or candidate generation: either a generative SFT/LoRA student, a learned entailment verifier over cited evidence, or an answer-recovery stage that is filtered by a stronger verifier.

### D62. Use the risk gate as an aggregate support result, not the final student

Decision: Add `grounded-qa-distillation-synthesize-risk-gate-transfer.mjs` and synthesize the two true transfer windows after threshold selection, examples 241-389.

Reason: Individual windows were noisy, and the paper needs a stable statement about the amortized scaffold. The synthesis makes no LLM calls and aggregates already-paid `gpt-4o` judgments. Across examples 241-389, direct mini plus citation repair answers 117 of 149 examples, has 64.1% answer support, and reaches 71.8% `gpt-4o` judged correctness. The balanced claim-pruner-label risk gate answers 90 of 149 examples, has 70.0% answer support, and reaches 79.9% judged correctness. This is the cleanest positive transfer result so far: +8.1 percentage points overall judged correctness and +5.9 percentage points answer support with zero per-query verifier calls.

Tradeoff: The same aggregate also shows why the current scaffold is not enough for a NeurIPS-grade paper claim. The gate loses 27 answers, drops citation recall by 14.2 percentage points, and lowers answer F1 by 5.5 percentage points. The contribution can be framed as a support/coverage tradeoff from amortized teacher-label traces, but the next system needs either a generative student or a verifier-plus-recovery policy that recovers answerable cases without reintroducing unsupported answers.

### D63. Prioritize retained unsupported answers over answer recovery

Decision: Add `grounded-qa-distillation-risk-gate-tradeoff.mjs` and classify row-level direct-to-gate changes across the true transfer windows, examples 241-389.

Reason: D62 showed the aggregate support/coverage tradeoff but did not identify the next failure mode. The row-level analysis reuses existing `gpt-4o` judgments and makes no LLM calls. Across 149 transfer examples, the gate retains 64 supported answers, retains 26 unsupported answers, effectively suppresses 15 unsupported direct answers, ineffectively suppresses 1 unsupported direct answer, harmfully suppresses only 2 supported direct answers, and has 9 ambiguous suppressions where the direct answer and the abstention were both judged acceptable. The current gate is correct on 119 of 149 examples. Recovering only the 2 harmful false suppressions would raise correctness to 81.2%, while suppressing the 26 retained unsupported answers would raise it to 97.3% under an oracle.

Tradeoff: The next system should not be recovery-first. Answer recovery has little headroom unless paired with a stronger verifier. The main bottleneck is retained unsupported answers that score high under the lexical logistic gate, so the next aligned experiment should use a different verifier class, such as an entailment model over claim/evidence pairs or a stronger learned claim-pruning stage distilled into a local model.

### D64. Target claim-level entailment for retained unsupported answers

Decision: Add `grounded-qa-distillation-retained-unsupported-analysis.mjs` and classify the 26 unsupported answers retained by the balanced risk gate across transfer examples 241-389.

Reason: D63 showed that suppressing retained unsupported answers has far more headroom than recovering supported false suppressions, but it did not say what the surviving errors are. This follow-up makes no LLM calls and reuses existing risk-gate predictions plus existing `gpt-4o` judge notes. The retained unsupported answers have high support-risk scores: min 0.678, median 0.787, and max 0.873; 12 of 26 score at least 0.800. The primary failure taxonomy is 18 numeric or comparative overclaims, 5 scope or overgeneralization errors, 2 citation contract gaps, and 1 method-result confusion. As any-match signals, scope or overgeneralization appears in 22 rows and method-result confusion in 10 rows.

Tradeoff: The current lexical support-risk score is missing high-confidence entailment failures rather than merely setting the threshold too low. The next experiment should explicitly score claim/evidence entailment, especially numeric, comparative, and scoped claims, before answer recovery. Another scalar threshold over the same features is unlikely to address the dominant retained-error class.

### D65. Keep a conservative claim-entailment guard as a small positive diagnostic

Decision: Add `grounded-qa-distillation-claim-entailment-guard.mjs` and run `claim-entailment-guard-balanced-risk-gate-240-389-v1`, a deterministic post-gate guard that suppresses answers with unsupported numeric tokens, unsupported comparative or superlative terms, or unsupported quantifiers relative to cited evidence.

Reason: D64 identified numeric and comparative overclaims as the dominant retained-error class. The first broad guard also included a question-focus miss heuristic, but inspection showed it over-suppressed supported answers, so I narrowed the default guard to cited-evidence numeric/comparative checks and normalized obvious numeric variants such as `113k` versus `113,000`. The final run makes no LLM calls and reuses existing `gpt-4o` judgments for support-oracle accounting. Across transfer examples 241-389, it fires on 5 of the balanced gate's 90 answered rows, suppresses 4 unsupported answers and 1 supported answer, reduces answer coverage from 90 to 85 answers, and raises inherited support-oracle correctness from 119/149 (79.9%) to 122/149 (81.9%). Answer support among remaining answers rises to 72.9%.

Tradeoff: This is positive evidence that the retained-overclaim analysis can translate into a cheap verifier feature, but the effect size is small and the evaluation is inherited rather than freshly judged. The guard should be treated as a conservative diagnostic layer and a feature candidate for a learned entailment verifier, not as the final amortized scaffold. The next meaningful step is to validate a stronger claim/evidence verifier on a fresh or separately judged slice, preferably with a learned entailment model or a small LLM-distilled verifier that can catch more than 5 retained answers without suppressing supported numeric claims.

### D66. Fresh stronger judging confirms the claim-entailment guard, but only as a narrow layer

Decision: Run `openai-judge-gpt4o-claim-entailment-guard-balanced-risk-gate-240-389-v1` and synthesize it with `claim-entailment-guard-validation-240-389-v1`.

Reason: D65 depended on inherited support-oracle accounting for the five new guard abstentions. A fresh `gpt-4o` pass over all 149 guarded transfer examples made 149 ledgered OpenAI calls and cost $0.3042625, moving tracked spend from $5.25222705 to $5.55648955. Under fresh judging, the guard answers 85 examples, reaches 74.1% answer support, 95.3% abstention support, and 83.2% overall judged correctness. Compared with the balanced support-risk gate on the same examples, this is +3.4 percentage points overall correctness and +4.1 percentage points answer support, with 5 fewer answers, -1.1 percentage points citation recall, and -0.7 percentage points answer F1.

Tradeoff: The fresh judge validates the direction: a deterministic claim/evidence guard can improve support beyond the learned lexical risk gate at zero inference-time LLM cost. The effect is still too narrow for a final paper system. The next system should learn a broader entailment verifier over cited claims, using the guard signals and existing `gpt-4o` judgments as labels, then test whether it catches more retained unsupported answers without losing the direct student's useful answer coverage.

### D67. Reject cross-window logistic entailment gating on current local features

Decision: Add `grounded-qa-distillation-learned-entailment-gate.mjs` and run `learned-entailment-gate-cross-window-240-389-v1`, a leave-window-out local logistic gate trained on existing `gpt-4o` support judgments for balanced-gate answered predictions.

Reason: D66 showed that one deterministic numeric/comparative guard transfers, but it catches only five answers. The next obvious no-cost extension was a broader learned local gate over upstream support score, answer/cited-evidence lexical coverage, claim coverage, numeric support, unsupported comparative and quantifier counts, question overlap, answer length, citation count, and claim count. To avoid leakage, the script trains on one future transfer window and evaluates on the other, then aggregates both directions. It makes no LLM calls. The result is negative: compared with the balanced support-risk gate's 119/149 support-oracle correctness (79.9%) and 90 answered examples, the cross-window learned gate reaches only 113/149 (75.8%) and 84 answered examples. It fires 6 times, suppresses zero unsupported answers, and harmfully suppresses 6 supported answers. Both folds fail in the same way despite in-sample train suppressions looking useful.

Tradeoff: The current local lexical/logistic entailment feature family does not transfer as a broader verifier. Keep the deterministic numeric/comparative guard because fresh judging validated it, but do not generalize it with this simple learned gate. The next meaningful verifier experiment needs a different model class, such as a claim/evidence cross-encoder, NLI model, or small LLM-distilled verifier, or a return to true generative SFT once compute is available.

### D68. Use mini verifier negatives as high-precision labels, not as a calibrated judge

Decision: Run `gpt-4o-mini` through the existing OpenAI judge runner on the two balanced risk-gate transfer windows and synthesize `mini-verifier-gate-balanced-risk-gate-240-389-v1`.

Reason: D67 rejected the current local logistic verifier, and no local NLI/cross-encoder stack is available in the workspace. A cheap small-LLM verifier is a different model class and can also generate labels for a future local verifier. The two mini judge runs made 149 ledgered calls and cost $0.01805595, moving tracked OpenAI spend to $5.57454550. As a judge, mini is too optimistic: it marks 96.6% of rows correct while `gpt-4o` marks 79.9%, with only 83.2% agreement. But using only mini's rare negative judgments as a keep/abstain verifier is useful: it suppresses 4 answers, all unsupported under `gpt-4o`, and raises strong correctness from 119/149 (79.9%) to 123/149 (82.6%). Unioning those suppressions with the deterministic numeric/comparative guard gives the best current support-first scaffold: 125/149 (83.9%), with 8 suppressions, 7 unsupported and 1 harmful.

Tradeoff: This is not yet the final amortized scaffold because it adds per-query `gpt-4o-mini` verifier calls. The actionable result is label construction: mini negative judgments are high-precision hard-negative signals, while mini positive judgments are not trustworthy. The next step should distill mini-negative plus `gpt-4o` support labels into a local verifier or use the combined policy as the teacher for a trained verifier/student.

### D69. Export combined mini-negative and deterministic-guard teacher labels

Decision: Add `grounded-qa-distillation-export-combined-verifier-labels.mjs` and materialize `teacher-combined-mini-det-guard-future-holdout-240-389-v1`.

Reason: D68 produced the strongest current support-first policy, but it still depends on per-query `gpt-4o-mini` verifier calls. This export converts that policy into post-training artifacts with no additional LLM calls: 125 accepted SFT labels, 24 rejected audit rows, and 149 verifier labels with 119 `keep` targets and 30 `suppress` targets. The source mini verifier calls cost $0.01805595, already recorded in the ledger, while the combined policy reaches 83.9% strong support-oracle correctness on examples 241-389 versus 79.9% for the balanced risk gate alone.

Tradeoff: This is a useful distillation object, not a final held-out result. The packet is built on the same transfer windows used to identify the combined policy, and suppressed unsupported answers are accepted by support-oracle conversion rather than a fresh abstention judge. The next step should train or evaluate a local verifier/student from these labels, or reserve a new slice for a fresh policy-confirmation pass.

### D70. Reject shallow local distillation of the combined verifier labels

Decision: Add `grounded-qa-distillation-local-verifier-from-combined-labels.mjs` and run `local-verifier-from-combined-labels-240-389-v1`.

Reason: D69 exported verifier labels, but the paper claim needs an amortized verifier that does not call `gpt-4o-mini` per query. This run trains a local logistic verifier cross-window from the exported labels using only deployable answer/evidence features: upstream support score, answer and claim overlap with cited evidence, pack overlap, numeric support, unsupported comparative and quantifier counts, a recomputed deterministic-guard bit, question/citation overlap, and length/count features. It makes no LLM calls. Training directly on the stronger support target performs worse than the balanced gate: 116/149 support-oracle correct (77.9%) versus 119/149 (79.9%), with 9 suppressions that catch only 3 unsupported answers and harmfully suppress 6 supported answers. Training to imitate the combined teacher action is high precision but too low recall: it fires only twice, catches 1 unsupported answer, harmfully suppresses 1 supported answer, and ties the balanced gate at 119/149 (79.9%) while missing the combined teacher's 125/149 (83.9%).

Tradeoff: The combined labels remain useful as a training/evaluation asset, but another shallow lexical/logistic verifier is not the amortized solution. The next verifier experiment should change model class, for example a local NLI/cross-encoder or compact sequence classifier over claim/evidence pairs, or move back to a generative SFT/LoRA student when compute is available.

### D71. Reject local TF-IDF text verifier as the stronger verifier class

Decision: Add `grounded-qa-distillation-text-verifier-from-combined-labels.py` and run `text-verifier-from-combined-labels-240-389-v1`.

Reason: D70 ruled out the compact hand-feature logistic gate, but it was still possible that a higher-dimensional local text model could capture support failures from the answer, claims, cited evidence, question, and metadata. This run uses word 1-2 gram and character 3-5 gram TF-IDF features plus numeric metadata in a cross-window logistic verifier. It makes no LLM calls. The result is also negative. Training on the strong support target reaches only 106/149 support-oracle correct (71.1%), firing 17 times but suppressing only 2 unsupported answers while harmfully suppressing 15 supported answers. Training to imitate the combined teacher action learns the majority keep behavior and fires zero times on transfer, tying the balanced gate at 119/149 (79.9%) and missing all 8 combined-teacher suppressions.

Tradeoff: This closes the bag-of-words local verifier path for the current labels. The next meaningful verifier must use a pretrained entailment/cross-encoder model over claim/evidence pairs, collect a larger labeled verifier corpus, or train a generative student rather than adding more local lexical variants.

### D72. Keep pretrained NLI as a modest verifier signal, not the final scaffold

Decision: Add `grounded-qa-distillation-pretrained-nli-verifier.mjs` and run `pretrained-nli-verifier-combined-labels-240-389-v1` with `cross-encoder/nli-distilroberta-base`.

Reason: D71 ruled out local bag-of-words verifier variants, so I tested an off-the-shelf entailment cross-encoder over concatenated cited evidence as premise and the candidate answer plus claim-table claims as hypotheses. The run makes no OpenAI calls; it downloads and runs the Hugging Face model locally, then tunes only a threshold on one future window and evaluates on the other. This is the first local verifier after the deterministic guard that moves in the right direction: 120/149 support-oracle correct (80.5%) versus 119/149 (79.9%) for the balanced gate. It fires 3 times, suppressing 2 unsupported answers and 1 supported answer, with answer support improving from 70.0% to 71.3%. It still misses most of the combined teacher's high-precision suppressions: the combined teacher is 125/149 (83.9%) with 7 useful and 1 harmful suppression.

Tradeoff: Pretrained NLI is worth keeping as a feature or candidate verifier because it is a different model class and gives a small positive transfer result without per-query LLM calls. It is not a paper-grade amortized scaffold by itself: the effect is narrow, one fold fires zero times, and the support gain is much smaller than the mini-negative plus deterministic teacher. The next experiment should combine pretrained NLI with the deterministic guard or train a small verifier on a larger labeled corpus.

### D73. Combine NLI with deterministic guard only as a local diagnostic

Decision: Add `grounded-qa-distillation-synthesize-nli-guard.mjs` and run `nli-det-guard-synthesis-240-389-v1`.

Reason: D72 showed pretrained NLI catches a few unsupported retained answers, while D65/D66 showed the deterministic numeric/comparative guard catches a different narrow class. This synthesis makes no LLM calls and no new model calls; it combines existing predictions. The signals are complementary: NLI fires on 3 answers, deterministic guard fires on 5, and they have zero overlap. Their union reaches 123/149 support-oracle correct (82.6%), improving over deterministic guard alone at 122/149 (81.9%) and NLI alone at 120/149 (80.5%). The union suppresses 6 unsupported answers and 2 supported answers, raising answer support from 70.0% to 74.4% while reducing answered examples from 90 to 82. The intersection fires zero times.

Tradeoff: The local union is now the best zero-LLM verifier-only scaffold, but it still trails the mini-negative plus deterministic teacher at 125/149 (83.9%), which suppresses 7 unsupported and only 1 supported answer at the same answer coverage. Keep NLI as a useful local feature, but do not promote the NLI/guard union as the final system without either training a larger verifier corpus or validating on a fresh later slice.

### D74. Reject fixed NLI/guard union as robust across judged windows

Decision: Add `grounded-qa-distillation-nli-guard-retrospective.mjs` and run `nli-det-guard-retrospective-160-240-v1`.

Reason: D73 was positive on examples 241-389, but those are the same transfer windows used for recent verifier analysis. There is no later QASPER future slice in the current extended corpus, so I ran a retrospective robustness check on the earlier judged balanced-gate window, examples 161-240. The run makes no OpenAI calls, uses a fixed NLI threshold from D72 rather than tuning on this window, and recomputes the deterministic guard. The result is negative for the union: the balanced gate is 66/80 support-oracle correct (82.5%), deterministic guard alone drops to 65/80 (81.3%) with 2 useful and 3 harmful suppressions, fixed NLI ties the balanced gate at 66/80 with 1 useful and 1 harmful suppression, and the NLI OR deterministic union also drops to 65/80 with 3 useful and 4 harmful suppressions. Answer support rises from 72.9% to 75.6%, but only by over-suppressing supported answers.

Tradeoff: The NLI/guard union is not robust enough to be the default amortized scaffold. Keep NLI as a feature candidate and keep the deterministic guard as a validated narrow layer, but the next paper-relevant step should either train a verifier on a larger temporally diverse label set or create a genuinely later/private-KB evaluation slice before claiming transfer.

### D75. Reject broader learned NLI-plus-deterministic verifier on current labels

Decision: Add `grounded-qa-distillation-learned-nli-det-verifier.mjs` and run `learned-verifier-nli-det-features-160-389-v1`, a zero-call leave-window-out logistic verifier over the three judged balanced-gate windows from examples 161-389.

Reason: D74 showed that the fixed NLI/guard union was not robust across windows, so I tested whether the same signals become useful when learned over a broader, temporally diverse label set. The script consumes existing cached NLI scores only, recomputes deterministic guard features locally, trains on two windows, evaluates on the held-out window, and never calls OpenAI or reruns the NLI model. The result is negative. Across 229 judged examples, the balanced support-risk gate is 185/229 support-oracle correct (80.8%) with 138 answers. The learned NLI+det verifier drops to 179/229 (78.2%) with 122 answers, firing 16 times but suppressing only 5 unsupported answers while harmfully suppressing 11 supported answers. Simpler baselines are better but still modest: deterministic guard alone and fixed NLI OR deterministic guard both reach 187/229 (81.7%), a +2 row gain over balanced, while fixed NLI alone ties balanced at 185/229.

Tradeoff: The current supervised local-verifier path is still not the amortized scaffold. NLI and deterministic features remain useful diagnostics, and deterministic/NLI-union baselines give a small support-first operating point, but learning a shallow verifier from 229 current labels overfits supported answers and loses coverage. The next paper-relevant verifier step should change either the data scale or the model class: collect a larger temporally diverse verifier corpus, train a claim/evidence sequence classifier, or return to generative SFT/LoRA once compute is available.

### D76. Promote mini-negative labels over deterministic-guard union on the broader judged range

Decision: Run `gpt-4o-mini` as a ledgered verifier over the earlier balanced-gate window `risk-gate-balanced-claim-pruner-mini-labels-direct-repair-future-holdout-160-240-v1`, synthesize `mini-verifier-gate-balanced-risk-gate-160-389-v1`, and export `teacher-mini-negative-future-holdout-160-389-v1`.

Reason: D75 showed that local supervised learning from current NLI/deterministic features does not transfer, but D68's mini-negative signal had only been tested on examples 241-389. I extended the same cheap verifier to examples 161-240 with 80 ledgered `gpt-4o-mini` calls costing $0.00983565, moving tracked spend from $5.57454550 to $5.58438115 under the $100 cap. Across the full judged range 161-389, the balanced gate is 185/229 support-oracle correct (80.8%). Mini-negative-only suppression reaches 192/229 (83.8%) by firing 7 times, all 7 on answers that the stronger `gpt-4o` judge marked unsupported. The deterministic guard is weaker on this broader range at 186/229 (81.2%), with 7 useful and 6 harmful suppressions. The mini-plus-deterministic union is therefore no longer best: it reaches 191/229 (83.4%) because deterministic suppressions add harmful errors. The export converts the mini-negative policy into 192 accepted SFT labels, 37 rejected audit rows, and 229 verifier labels with 185 keep targets and 44 suppress targets.

Tradeoff: This is the strongest support-oracle teacher-label construction result so far and it is stable across all three judged future windows. It is still not the final amortized scaffold because using mini as a per-query verifier is an LLM call. The immediate value is dataset distillation: rare mini-negative judgments are high-precision hard-negative labels for post-training or verifier training, while deterministic guard signals should be treated as auxiliary diagnostics rather than unioned by default on the broader corpus.

### D77. Reject shallow distillation of the broader mini-negative teacher

Decision: Re-run the local hand-feature verifier and the TF-IDF text verifier against `teacher-mini-negative-future-holdout-160-389-v1`, producing `local-verifier-from-mini-negative-labels-160-389-v1` and `text-verifier-from-mini-negative-labels-160-389-v1`.

Reason: D76 produced the strongest teacher-label object so far, but the paper needs the expensive mini verifier behavior amortized into a cheaper scaffold or model. Both follow-up runs make no LLM calls and use leave-window-out evaluation across examples 161-389. The hand-feature logistic verifier still fails to recover the teacher: training on the strong support target drops to 182/229 support-oracle correct (79.5%), while training to imitate the mini-negative policy only ties the balanced gate at 185/229 (80.8%) with 10 suppressions, 5 useful and 5 harmful. The TF-IDF text verifier is also negative: the strong-support target collapses to 166/229 (72.5%) with 28 harmful suppressions, and the policy-imitation target fires zero times, exactly reproducing the balanced gate at 185/229 while missing all 7 mini-negative teacher suppressions.

Tradeoff: The broader mini-negative packet is valuable for dataset distillation, but not enough for shallow local classifiers. The hard-negative behavior appears sparse and semantically specific; bag-of-words and hand-engineered lexical/citation features do not learn it from 229 labels. The next credible amortization route needs a different model class, such as a claim/evidence sequence classifier initialized from an entailment model, a generative SFT/LoRA student, or a larger/private evolving-KB label corpus before claiming local verifier distillation.

### D78. Reject frozen pretrained sequence embeddings as the mini-negative distiller

Decision: Add `grounded-qa-distillation-sequence-verifier-from-mini-negative-labels.py` and run `sequence-verifier-from-mini-negative-labels-160-389-v1`, a zero-OpenAI-call verifier that embeds cited-evidence/candidate-answer pairs with `cross-encoder/nli-distilroberta-base` and trains a small logistic head in leave-window-out evaluation.

Reason: D77 ruled out hand-engineered and TF-IDF local classifiers, so I tested a stronger pretrained sequence representation without spending API budget. The model consumes the cited evidence as premise and the candidate answer plus claim-table claims as hypothesis, then uses the frozen final hidden-state CLS embedding plus NLI logits. This still fails to amortize the mini-negative teacher. Training on strong `gpt-4o` support labels reaches 178/229 support-oracle correct (77.7%), with 8 useful but 15 harmful suppressions. Training to imitate the exported mini-negative policy reaches 182/229 (79.5%), with 7 useful but 10 harmful suppressions. Both are below the balanced gate's 185/229 (80.8%) and far below the exported mini-negative teacher's 192/229 (83.8%).

Tradeoff: A frozen pretrained sequence representation is not enough. The failure mode is still sparse hard-negative transfer: the model finds some unsupported answers but suppresses too many supported ones. The next credible routes are either actual supervised fine-tuning of a sequence classifier with more labels, generative SFT/LoRA using the accepted SFT packet, or expanding to a larger/private evolving-KB corpus before trying to learn the verifier.

### D79. Treat supervised sequence fine-tuning as a modest diagnostic, not the amortized verifier

Decision: Add `grounded-qa-distillation-finetuned-sequence-verifier-from-mini-negative-labels.py` and run `finetuned-sequence-verifier-from-mini-negative-labels-160-389-v1`, a zero-OpenAI-call leave-window-out supervised fine-tune of `cross-encoder/nli-distilroberta-base` into a binary keep/suppress verifier over cited evidence and candidate answers.

Reason: D78 showed that frozen sequence embeddings are not enough, but it left open whether task-specific gradient updates could recover the mini-negative teacher's sparse hard negatives. This run fine-tunes the sequence classifier on two future windows and evaluates on the held-out window, repeating for all three judged windows and for both strong `gpt-4o` support labels and exported mini-negative teacher actions. The strong-support objective is the first learned local sequence verifier to beat the balanced support-risk gate, but only barely: 186/229 support-oracle correct (81.2%) versus 185/229 (80.8%), with 19 suppressions, 10 useful and 9 harmful. The teacher-policy objective fails to beat balanced, reaching 184/229 (80.3%) with 5 useful and 6 harmful suppressions. Both remain well below the exported mini-negative teacher's 192/229 (83.8%) and reduce answer coverage substantially.

Tradeoff: Supervised sequence fine-tuning is a stronger diagnostic than frozen embeddings and gives a small positive support-first signal, but the current 229-label corpus is too small and imbalanced for a robust amortized verifier. The next paper-relevant move should expand temporally diverse verifier labels or train a generative SFT/LoRA student from accepted labels; more threshold tuning on this fine-tuned verifier would mostly trade coverage for support without approaching the teacher.

### D80. Reject simple synthetic hard-negative augmentation for the sequence verifier

Decision: Extend `grounded-qa-distillation-finetuned-sequence-verifier-from-mini-negative-labels.py` with opt-in train-only hard-negative augmentation and run `finetuned-sequence-verifier-hard-negative-augmentation-160-389-v1`.

Reason: D79 suggested that sparse suppress labels might be the blocker. This ablation adds synthetic negatives only to the training folds, never to threshold tuning or held-out evaluation: cited-evidence shuffles, numeric perturbations, and claim-support broadening rows generated from supported training answers. The full six-epoch augmented run was too slow on local CPU and was stopped before writing artifacts, so I ran a bounded two-epoch diagnostic with the same leave-window-out protocol. Each training fold received 126-134 synthetic hard negatives, but real-row threshold tuning selected zero suppressions on every held-out window. Both the strong-support and teacher-policy objectives exactly reproduce the balanced gate at 185/229 support-oracle correct (80.8%), miss all seven exported-teacher suppressions, and remain 7 rows behind the mini-negative teacher's 192/229.

Tradeoff: Naive synthetic negatives do not solve the sparse hard-negative transfer problem. They may teach obvious mismatches, but those mismatches do not calibrate to the real mini-negative teacher errors under temporal holdout. The next data-scale move should use real teacher/judge labels from additional temporally separated examples or a generative SFT/LoRA student, not synthetic verifier negatives alone.

### D81. Prepare a leakage-safe temporal generative SFT packet from mini-negative labels

Decision: Add `grounded-qa-distillation-hf-sft-temporal-prep.mjs` and materialize `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1`.

Reason: The verifier route has repeatedly failed to amortize the mini-negative teacher, and existing HF SFT prep packets split accepted labels alphabetically rather than by evolving-KB time. This run prepares the generative SFT route in a leakage-safe form: accepted mini-negative labels from judged windows 161-240 and 241-320 become train/validation rows, examples in the later 321-389 window become prompt-only eval rows, and any earlier labels from eval-window papers are excluded. The packet has 113 train rows, 19 validation rows, 69 later eval prompts, 57/56 answered/abstained train balance, 9/10 answered/abstained validation balance, and zero train/validation overlap with eval examples or eval papers. The local dataset validator passes. It makes no OpenAI calls and estimates the later Qwen 0.5B LoRA HF job at $0.5625, separate from the OpenAI key budget.

Tradeoff: This is still a launch-ready training packet, not a trained student. It fixes a methodological leak in the generative SFT path and gives a clean future-window evaluation target, but the paper claim still needs the LoRA job to run and the trained adapter to be evaluated against direct mini, balanced gate, and mini-negative teacher baselines. If HF Jobs remains operationally unavailable, the next fallback should be a local/alternative backend that consumes this exact temporal packet rather than returning to non-temporal SFT splits.

### D82. Record the temporal SFT launch blocker before spending GPU time

Decision: Add `grounded-qa-distillation-hf-sft-launch-preflight.mjs`, run `hf-sft-launch-preflight-mini-negative-temporal-qwen05b-v1`, and extend the artifact validator to cover launch-preflight runs.

Reason: D81 produced the right temporal SFT packet, but launching a GPU job without an account/runtime preflight would risk silent failure or wasted setup time. I first attempted a tiny Hugging Face Jobs CPU auth preflight with the authenticated `rprendergast` account and `HF_TOKEN` secret path. The job API returned `402 Payment Required` with the message that the prepaid credit balance is insufficient. The local packet checks are otherwise good: the temporal dataset validator passes, the generated TRL/LoRA training script compiles, and the OpenAI ledger is untouched. Local training is also not immediately available because the current Python runtime has `torch` and `transformers` but lacks `datasets`, `accelerate`, `peft`, `trl`, and `trackio`.

Tradeoff: The generative SFT path is methodologically ready but operationally blocked on compute credits or a local/alternative training environment. Do not spend OpenAI budget to work around this. The next SFT step is to add HF Jobs prepaid credits or run the same packet on a backend with TRL/PEFT dependencies, then evaluate the adapter on the 321-389 temporal eval prompts.

### D83. Establish a weak zero-LLM local control for the temporal SFT packet

Decision: Add `grounded-qa-distillation-temporal-packet-scaffold.mjs`, run `temporal-packet-scaffold-mini-negative-161-320-to-321-389-v1`, and extend the artifact validator to cover temporal packet scaffold runs.

Reason: D82 blocks the actual Qwen LoRA launch, but the temporal packet can still support a zero-call local control. This scaffold trains an evidence selector and sufficiency model on the D81 train rows, tunes an abstention threshold on the D81 validation rows, and evaluates on the untouched 321-389 prompt rows. It makes no LLM calls. The result is weak: on 69 later eval prompts it answers 22, abstains 47, reaches 68.1% answer-type accuracy, 63.6% citation precision, 21.6% citation recall, 6.1% answer token F1, and 100.0% inline citation rate. Validation tuning selected a high threshold of 0.65 because lower thresholds improved answer F1 but damaged citation precision.

Tradeoff: Accepted labels alone plus a local extractive scaffold do not replace a generative student. This is a useful floor and leak-free control, not a viable paper system. The result strengthens the case that the next meaningful experiment is still the temporal Qwen LoRA SFT run or an equivalent generative backend that can synthesize concise cited answers from the packet.

### D84. Synthesize the final temporal-window comparison before launching SFT

Decision: Add `grounded-qa-distillation-synthesize-temporal-window-comparison.mjs`, run `temporal-window-comparison-321-389-v1`, and extend the artifact validator to cover temporal-window comparison runs.

Reason: D83 produced a leak-free local control, but the paper trail needed a same-window comparison across the actual candidates on examples 321-389 before spending compute on the temporal SFT packet. This synthesis makes no LLM calls and does not mix metric families: it separately reports QASPER reference-overlap metrics, existing `gpt-4o` judge metrics, and inherited support-oracle metrics. Direct mini plus citation repair remains the strongest answer-quality baseline on this final window, with 53 answered examples, 32.2% answer F1, 77.3% citation recall, and 72.5% `gpt-4o` judged correctness. The balanced local risk gate improves judged correctness to 79.7% and answer support to 70.5%, but answers only 44 examples and lowers answer F1 and citation recall. The mini-negative verifier teacher reaches 57/69 support-oracle correct (82.6%) with two useful and zero harmful suppressions, while the best 321-389 sequence-verifier policy reaches 56/69 (81.2%) and the temporal extractive scaffold is much weaker at 22 answered examples, 6.1% answer F1, and 21.6% citation recall.

Tradeoff: This locks the current interpretation: rare mini-negative judgments are valuable post-training labels, but the existing zero-call local distillers do not yet amortize them. The next meaningful experiment is still the generative temporal SFT/LoRA run using `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1`, or an equivalent backend that consumes the same packet. More local verifier tuning would mostly re-test a now well-documented failure mode.

### D85. Reject trained answer-span extraction as the temporal SFT substitute

Decision: Add `grounded-qa-distillation-temporal-span-scaffold.mjs`, run `temporal-span-scaffold-hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1`, judge it with `gpt-4o` as `openai-judge-gpt4o-temporal-span-scaffold-mini-negative-161-320-to-321-389-v1`, and fold the result into `temporal-window-comparison-321-389-v1`.

Reason: Local Qwen/LoRA training is still blocked by missing runtime dependencies, and OpenAI hosted fine-tuning is unavailable on this account, so I tested the strongest immediately executable zero-LLM generator control: train a span selector from the accepted temporal SFT labels, tune abstention on validation, and emit the selected answer span with one inline citation. The local scaffold itself makes no LLM calls. It improves over the previous extractive floor on reference metrics, answering 52 of 69 final-window examples with 88.4% answer-type accuracy, 58.0% citation recall, 13.8% answer F1, and 100.0% inline citation rate. But a fresh `gpt-4o` judge pass made 69 ledgered calls costing $0.14113750, moving tracked OpenAI spend from $5.58438115 to $5.72551865, and found only 19.2% answer support and 39.1% overall judged correctness. The dominant failure is selecting a relevant cited sentence that is true but does not answer the question.

Tradeoff: Span supervision is a better extractive baseline, not a grounded QA distillation answer. The result rules out another cheap local substitute for generative SFT: copying an evidence span can look good under reference answer-type and token-overlap metrics while failing citation-grounded correctness. The next paper-relevant move should restore a real generative training backend or collect more hard-negative support labels; it should not further optimize extractive span selection as the main amortized system.

### D86. Establish a runnable but negative local Qwen LoRA SFT diagnostic

Decision: Add `grounded-qa-distillation-local-generative-sft.py` and run `local-generative-sft-compact-mini-negative-temporal-qwen05b-64train-321-389-v1`, a local MPS LoRA SFT diagnostic over compact prompts from the temporal mini-negative packet.

Reason: D85 rejected extractive span selection, so the next necessary step was to make the generative SFT path executable locally instead of waiting on HF Jobs credits. The script uses `uv`, `transformers`, and `peft`, masks loss to assistant tokens, formats compact evidence prompts, trains a Qwen 0.5B LoRA adapter locally, and evaluates on the 321-389 final window. This made no OpenAI calls and left the ledger unchanged at $5.72551865. A smoke run exposed prompt truncation into raw evidence JSON; I fixed the script to use compact prompts. A full 113-row, 2-epoch attempt at 1536 tokens was stopped after 16 minutes with no artifacts because it was still in backprop. The bounded completed diagnostic used the first 64 train rows for one epoch at 768 tokens and evaluated all 69 final-window prompts. It was runnable but negative: 0 answered examples, 36.2% answer-type accuracy, 53.6% valid JSON, and 0 answer F1/citation recall.

Tradeoff: This is the first executable local generative student path, but it is not a viable student result. The bounded run undertrained and collapsed to abstention despite a roughly balanced 31/33 answered/abstained train subset. The result narrows the engineering gap: the paper path needs either a longer local training budget with progress/checkpointing and faster generation settings, a smaller/easier base model for local iteration, or restored remote LoRA compute. It should not be presented as evidence that generative SFT fails in principle.

### D87. Use answered-only local SFT to isolate answer synthesis, and reject a paid judge pass

Decision: Extend `grounded-qa-distillation-local-generative-sft.py` with `--train-filter`, run `local-generative-sft-answered-only-mini-negative-temporal-qwen05b-161-320-to-321-389-v1`, and fold it into `temporal-window-comparison-321-389-v1`.

Reason: D86's all-abstain result did not show whether local Qwen LoRA could synthesize cited answers at all. I therefore trained only on the 57 answered labels from the temporal mini-negative packet for two epochs and evaluated the same 69 final-window prompts. This made no OpenAI calls and left the ledger unchanged. The answer-only run did emit answers on 36 of 69 prompts, with 13.7% answer F1, but output control was too weak for a support judge: valid JSON was only 53.6%, inline citation compliance was 22.2%, citation precision was 21.8%, and citation recall was 13.1%. It also answered counterfactual-insufficient rows because abstention behavior was removed from the training subset.

Tradeoff: This isolates the bottleneck. Local Qwen LoRA can move from abstention collapse to answer generation, but the current setup does not learn the citation contract or abstention calibration. A paid `gpt-4o` judge pass would be wasteful on outputs with this much format and citation failure. The next local generative step should add format/citation-constrained decoding or stronger supervised formatting before spending judge budget.

### D88. Repair local SFT inline citations, but still reject a paid judge pass

Decision: Run the zero-call `grounded-qa-distillation-citation-contract-repair.mjs` scaffold over `local-generative-sft-answered-only-mini-negative-temporal-qwen05b-161-320-to-321-389-v1` as `citation-contract-repair-local-generative-sft-answered-only-mini-negative-temporal-qwen05b-321-389-v1`, then fold the repaired row into `temporal-window-comparison-321-389-v1`.

Reason: D87 showed that answered-only local Qwen LoRA can emit answers, but most cited evidence ids were not present inline in the answer text. The repair pass appends missing cited ids locally, makes no LLM calls, and raises inline citation compliance from 22.2% to 100.0% on the 36 answered final-window examples. It changes 28 rows and repairs 30 missing inline markers. The substantive metrics are unchanged: answer-type accuracy remains 39.1%, answer F1 remains 13.7%, citation precision remains 21.8%, and citation recall remains 13.1%. OpenAI ledger spend remains $5.72551865 of the $100 cap.

Tradeoff: This separates two failure modes. Output-contract repair can make local SFT answers syntactically citation-compliant, but it cannot make weak citations correct or restore abstention behavior removed by answered-only training. A paid `gpt-4o` judge pass is still not justified. The next local generative experiment should target constrained JSON generation plus citation selection/abstention training before using judge budget.

### D89. Reject cheap lexical contract gating as the local SFT support fix

Decision: Add `grounded-qa-distillation-local-generative-contract-gate.mjs`, run `local-generative-contract-gate-answered-only-repair-qwen05b-321-389-v1` over the repaired answered-only local Qwen outputs, and fold it into `temporal-window-comparison-321-389-v1`.

Reason: D88 fixed inline citation syntax but not grounded correctness, so I tested a zero-call deployable gate before spending judge budget. The gate uses only the generated answer, cited evidence ids, and retrieved evidence text: it abstains when an answer has no citations, is yes/no-only, cites ids absent from the pack, or has unique answer-token overlap with cited evidence below a fixed 0.4 threshold. It suppresses 26 of the 36 generated answers and raises citation precision from 21.8% to 33.3% while preserving 100.0% inline citation compliance. But the cost is too high: answered examples fall to 10 of 69, answer-type accuracy falls to 33.3%, citation recall falls to 6.3%, and answer F1 falls to 3.0%. No OpenAI calls were made, and ledger spend remains $5.72551865 of the $100 cap.

Tradeoff: Lexical overlap is useful as a cheap precision diagnostic, but it is not the amortized grounded-QA system. It suppresses some bad local generations and makes retained citations less random, yet it cannot detect counterfactual-insufficient packs reliably or recover missing answer content. The next useful move is no longer local post-processing of this weak answered-only adapter; it is either stronger constrained generative training with abstention labels or expanding real teacher/judge labels across additional temporal windows.

### D90. Reject the current full balanced local Qwen SFT configuration

Decision: Run `local-generative-sft-balanced-full-mini-negative-temporal-qwen05b-113train-2epoch-321-389-v1`, a full 113-row balanced local LoRA SFT diagnostic over the temporal mini-negative packet, and fold it into `temporal-window-comparison-321-389-v1`.

Reason: D86 undertrained a 64-row balanced subset and collapsed to abstention, while D87 answered only after removing abstention labels. I therefore ran the full leakage-safe temporal packet with compact 768-token prompts for two epochs on local MPS. The run completed in 925.4 training seconds with 30 optimizer steps, mean loss 0.8715, last loss 0.4130, and no OpenAI calls. It improved valid JSON generation from 53.6% to 91.3%, but still answered 0 of 69 final-window prompts. Answer-type accuracy is therefore just the abstention base rate, 36.2%, with 0 citation recall and 0 answer F1. The OpenAI ledger remains unchanged at $5.72551865 of the $100 cap.

Tradeoff: This clarifies that the local Qwen 0.5B setup can learn the output schema and abstention default, but not the balanced answer/abstain decision from 113 compact rows. The answered-only run proves answer synthesis is possible; the balanced full run proves naive mixed SFT over the current packet drives the model back to safe abstention. The next generative route needs data construction changes, not more post-hoc repair: for example answer/abstention curriculum, loss weighting, more answer examples from additional temporal windows, or a stronger training backend/model.

### D91. Answer oversampling improves local SFT coverage but fails support judging

Decision: Extend `grounded-qa-distillation-local-generative-sft.py` with `--answer-repeat`, run `local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-170train-1epoch-321-389-v1`, repair its citation contract as `citation-contract-repair-local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-321-389-v1`, judge the repaired outputs with `gpt-4o` as `openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1`, and test the lexical contract gate as `local-generative-contract-gate-answer-repeat2-repair-qwen05b-321-389-v1`.

Reason: D90 showed that balanced local SFT overfits to abstention, so I tested the smallest data-construction change that keeps abstention labels while increasing answer gradients: repeat answered train rows twice. The materialized local train set has 170 rows, still derived only from the leakage-safe 113-row temporal packet. The one-epoch local run makes no OpenAI calls, completes in 458.9 training seconds, answers 40 of 69 final-window prompts, reaches 56.5% answer-type accuracy, 33.1% citation precision, 30.7% citation recall, 13.9% answer F1, and 72.5% valid JSON. Zero-call citation repair fixes 52 missing inline markers and raises inline citation compliance to 97.5%. This is the best local generative reference-metric result so far, so I spent a fresh `gpt-4o` judge pass: 69 calls costing $0.152805, moving ledger spend from $5.72551865 to $5.87832365. The judge finds only 5.0% answer support, 93.1% abstention support, and 42.0% overall correctness. The deterministic contract gate improves citation precision to 38.3% but suppresses 25 answers, leaving only 15 answered examples, 13.1% citation recall, and 3.7% answer F1.

Tradeoff: Answer oversampling is a useful data-construction knob because it avoids all-abstain collapse and improves local reference metrics, but it does not preserve citation-grounded correctness. This is strong evidence that the paper system needs support-aware training data, not just more answer examples: claim-level support labels, negative citation/claim examples, or a stronger teacher/student backend that can learn evidence-conditioned generation. Do not promote answer-repeat local SFT as the amortized system.

### D92. Export local SFT support contrasts and diagnose the failure mode

Decision: Export the judged answer-repeat local SFT answers as `judge-support-local-sft-answer-repeat2-final-window-v1` and add `grounded-qa-distillation-support-failure-analysis.mjs`, materializing `support-failure-analysis-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1`.

Reason: D91 showed the scalar support result was bad, but the next data-construction step needs the shape of the negatives. The zero-call export reuses the existing `gpt-4o` judge pass and produces only 2 accepted supported answers and 38 rejected answered rows, matching the 5.0% answer-support rate. This export is final-window diagnostic/support-contrast data, not a leakage-safe training set for the same 321-389 evaluation. The failure analysis tags the 38 unsupported answers: 24 missing-direct-evidence failures, 16 unsupported task/experiment claims, 13 partial-support cases, 12 answers on counterfactual-insufficient packs, 10 unsupported context/annotation claims, 6 unsupported comparison/baseline claims, 4 too-short yes/no-style answers, and 3 invalid-citation-id cases. It makes no new LLM calls and leaves tracked spend at $5.87832365.

Tradeoff: This changes the next training target. The weak local student is not mainly failing because it omits citation brackets; it is learning plausible scientific QA priors that are not directly entailed by the cited evidence. The next support-aware packet should include rejected answer contrasts or claim-level negative labels, while preserving an untouched future window for evaluation.

### D93. Materialize a leakage-safe support-contrast training packet

Decision: Add `grounded-qa-distillation-support-contrast-prep.mjs` and run `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`, then extend `grounded-qa-distillation-validate.mjs` to validate support-contrast prep artifacts.

Reason: D92 used final-window local SFT failures only as diagnostics, so those rows cannot train a student evaluated on the same 321-389 examples. The new packet instead reuses the earlier `judge-support-direct-repair-future-holdout-0-320-v1` export, which contains existing `gpt-4o` support judgments over direct-mini plus citation-repair answers before the final eval window. It makes zero new OpenAI calls and keeps tracked spend at $5.87832365. The emitted training surface has 126 supported-answer SFT train rows, 38 supported-answer validation rows, 59 train preference rows, 21 validation preference rows, and 69 final-window eval prompts. Preference rows use a judged unsupported answer as the rejected response and an evidence-insufficient abstention as the chosen response. Five validation candidates that shared final-window papers were excluded, leaving zero emitted train or validation rows sharing papers with the final eval prompts.

Tradeoff: This is the right next data-construction artifact, not evidence that the amortized student now works. Abstention-as-chosen contrasts directly target unsupported answer generation, but they may over-teach abstention if mixed naively with SFT. The next model run should consume this packet with an explicit support-aware objective or curriculum and report both answer coverage and judged support on the untouched final window.

### D94. Reject a shallow support-contrast gate as the payoff

Decision: Extend `grounded-qa-distillation-risk-gate.mjs` with `--support-contrast-run`, run `support-contrast-gate-direct-repair-0-240-val-240-320-to-321-389-v1`, and add validator coverage for `support-contrast-gate-*` artifacts.

Reason: D93 produced the right leakage-safe contrast surface, so the next question was whether a cheap learned scaffold could consume it. The new run trains the existing hand-feature logistic support gate only on D93's examples 1-240 rows, tunes the threshold on examples 241-320, and evaluates on the untouched 69-prompt final window. It makes zero OpenAI calls and leaves tracked spend at $5.87832365. The train split reaches 81.7% precision and 81.7% accepted-answer recall; validation reaches 77.5% precision and 81.6% accepted-answer recall. But inherited final-window judging is negative: direct citation-repair answers 53 examples with 64.2% answer support and 72.5% overall judged correctness, while the support-contrast gate answers 42 examples with 69.0% retained-answer support but only 66.7% inherited overall correctness. It makes 6 useful suppressions and 5 harmful suppressions, and some new abstentions are unsupported because the final evidence pack actually is sufficient.

Tradeoff: The support-contrast packet is useful, but a shallow answer/evidence feature gate is not the amortized system. The failure mode is now clearer: suppressing unsupported answers is not enough unless the gate can distinguish bad answers from answerable rows where abstention is itself wrong. The next attempt should move the support contrasts into model-side preference learning or claim-level supervision, or train a verifier that explicitly predicts both answer support and abstention support.

### D95. Split support errors into answer, repair, and abstention actions

Decision: Add `grounded-qa-distillation-abstention-support-error-analysis.mjs` and run `abstention-support-error-analysis-support-contrast-gate-321-389-v1`, then extend the validator to cover abstention-support error-analysis artifacts.

Reason: D94's inherited judge score made the gate look bad, but the next system needs to know why. The zero-call analysis reuses the final-window direct-repair predictions, the support-contrast gate outputs, and existing `gpt-4o` judgments. It corrects an important accounting issue: suppressing an unsupported answer is only a true win when the row is unanswerable. On the 69-example final window, the gate has 3 true useful suppressions on unanswerable rows, 3 suppressions of unsupported answers on answerable rows that needed repair/regeneration, 5 suppressions of supported answers, 13 retained unsupported answers, and 2 source abstentions on answerable rows. It makes no OpenAI calls and keeps tracked spend at $5.87832365.

Tradeoff: This resolves the next design decision. The project should stop treating "support risk" as a one-dimensional suppress/keep threshold. The next paper-relevant system needs a joint action policy: keep supported answers, repair unsupported answers when evidence is sufficient, and abstain only when the compact pack is insufficient. Given the earlier local Qwen 0.5B failures, this likely requires GPU-backed 3B-8B model-side training or a substantially richer verifier, with frontier-model or human-calibrated labels remaining the label authority.

### D96. Prepare GPU-scale joint-action training under the total budget

Decision: Add `grounded-qa-distillation-total-budget.mjs` and `grounded-qa-distillation-joint-action-gpu-prep.mjs`, run `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`, and extend validation for total spend plus joint-action GPU prep artifacts.

Reason: The user clarified that the $100 cap covers Prime Intellect GPU spend as well as OpenAI calls. I therefore added `spend/budget.json` and `spend/ledger.jsonl` as the total experiment budget layer, currently showing $5.87832365 actual OpenAI spend, $0 external compute spend, and $94.12167635 remaining. The new GPU prep converts the D93 support-contrast packet into a joint-action training surface for a Qwen 2.5 3B LoRA run: 185 SFT train rows, 59 SFT validation rows, 59 DPO train rows, 21 DPO validation rows, and 69 final-window eval prompts. The DPO preferences choose either a reference-supported repair/regeneration or a justified abstention over a judged unsupported answer. It also emits a dataset validator, a TRL SFT-plus-DPO UV training script, and a Prime GPU launch plan. This prep makes zero OpenAI calls and estimates a $12 GPU run.

Tradeoff: I did not launch the paid Prime job because the local Prime CLI is installed but the saved API key is unauthorized. The right next move is to refresh Prime auth through the hidden-input flow or `prime login --headless`, verify live L4/A10G pricing, ledger the planned spend, and then launch only if the estimated total remains under $100. This is now an execution blocker for the GPU run, not a research-design blocker.

### D97. Attempt GPU launch and preserve the spend invariant

Decision: Attempt a bounded GPU smoke launch for `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`, materialize `gpu-launch-attempt-joint-action-qwen3b-smoke-v1`, and record both attempted backends in `spend/ledger.jsonl` with zero actual cost.

Reason: The next research step is the GPU-scale joint-action student, so I tried the two available remote-compute paths. Hugging Face Jobs was authenticated but rejected the L4 smoke job before creation with `402 Payment Required` because the account lacks prepaid credits. Prime Intellect is installed locally, but `prime whoami` reports the saved API key is unauthorized; `prime login --headless` starts a browser challenge and cannot complete without refreshed user-side authentication. No GPU job was created, no external compute ran, and total actual spend remains $5.87832365 out of the $100 cap.

Tradeoff: This is a real execution blocker, not evidence against the training plan. The validated dataset and training script are ready; the next step is credential/credit repair for Prime or HF Jobs, then rerun the bounded smoke before committing to a full GPU run.

### D98. Diagnose Prime as an auth blocker, not a funds blocker

Decision: Materialize `prime-auth-diagnosis-2026-06-26-v1` after inspecting the local Prime CLI config and trying the browser-login repair path.

Reason: The local Prime config is present and includes a saved API key plus a `Dolphin Made` team context, so this is not a missing-install or no-config problem. `prime whoami`, `prime teams list`, and `prime availability gpu-types` all fail before account or pricing access with `API key unauthorized`. A browser-login challenge was opened, but it did not complete during the run. Therefore the current Prime blocker is an expired, revoked, or insufficiently-permissioned API key. Prime balance and live GPU pricing remain unknown because the CLI cannot query them until auth succeeds. This diagnosis makes zero OpenAI calls, creates no GPU job, and leaves total actual spend at $5.87832365.

Tradeoff: I cannot fix this entirely without a valid browser session or a new Prime token, but the next step is now precise: refresh/create a Prime token, install it via hidden input or `prime config set-api-key`, verify `prime whoami`, then check funds/pricing before launching any bounded GPU run.

### D99. Make the joint-action GPU launch bounded before spending

Decision: Add `grounded-qa-distillation-joint-action-launch-preflight.mjs`, patch the joint-action GPU training script to honor `MAX_SFT_STEPS`, `MAX_DPO_STEPS`, `PUSH_TO_HUB`, and `REPORT_TO`, and run `joint-action-launch-preflight-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`.

Reason: Prime auth is blocked, so the useful zero-cost work is to remove launch risk before paid compute is available. The preflight validates the joint-action dataset, compiles the emitted Python training script, checks whether the training command is externally bounded, profiles prompt lengths against the 1536-token and 1280-token limits, and checks local training dependencies. The dataset validator and Python compile both pass. Prompt lengths fit the configured limits: SFT full max is about 1533 tokens, DPO prompt max about 1116 tokens, DPO full max about 1519 tokens, and eval prompt max about 1138 tokens. The local Python environment has `torch` but lacks `transformers`, `datasets`, `accelerate`, `peft`, and `trl`, so local dry-run training is not available without dependency installation. The remote smoke contract is now explicit: `MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none`. This makes zero OpenAI calls, creates no GPU job, and leaves total actual spend at $5.87832365.

Tradeoff: This still does not produce model-quality results; it hardens the execution path so the next Prime/HF run spends money only on a bounded smoke. The next step remains Prime token refresh or HF credit repair, followed by a ledgered remote launch under the $100 cap.

### D100. Record a budget-gated Prime smoke launch plan

Decision: Add `grounded-qa-distillation-joint-action-launch-plan.mjs`, run dry launch plans for Prime and Hugging Face Jobs, and record the Prime bounded-smoke plan in `spend/ledger.jsonl` with `status=planned`, `estimated_cost_usd=4`, and `cost_usd=0`.

Reason: D99 made the training script bounded, but the paid launch still needed a reproducible final gate that checks the current total spend before any backend command is run. The new launch-plan script loads the joint-action packet and preflight artifact, sums actual OpenAI plus actual external compute spend, verifies the estimated smoke stays under the $100 cap, verifies dataset/script/safety/length preflight checks, emits the exact bounded command, and idempotently records a planned external-compute row. The Prime plan passes: actual spend remains $5.87832365, estimated total if launched would be $9.87832365, and the bounded command is `MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none ... train_joint_action_lora_uv.py`. This makes zero OpenAI calls, creates no GPU job, and keeps actual external spend at $0.

Tradeoff: A planned ledger row is not a run result; it is a spend-control invariant. The remaining blocker is still Prime credential refresh or HF credits. Once auth succeeds, the next action should be to verify live pricing, then execute the bounded command and append an actual-cost completion or failed-creation row.

### D101. Narrow the novelty claim after June 2026 literature pressure

Decision: Add `grounded-qa-distillation-novelty-watchlist.mjs`, run `novelty-watchlist-2026-06-26-v1`, update `RELATED_WORK_NOTES.md`, and extend validation for novelty-watchlist artifacts.

Reason: The goal requires a June 2026 novelty check before any paper-complete claim. The structured watchlist confirms that several broad claims are already occupied: DRAG covers RAG-to-SLM distillation; Generate-then-Ground covers multi-step grounding and smaller-model grounding distillation; Rationale Distillation covers rationale/support-document distillation; LongCite covers synthetic citation SFT data; DynaQuest covers dynamic QA under real-world knowledge updates; GRACE covers grounded response plus abstention under contextual evidence; WriteBack-RAG covers a competing amortization route through evidence write-back; and LIT-RAGBench covers generator benchmarking for RAG with evidence integration and abstention. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Tradeoff: The novelty hypothesis is now narrower but more defensible: a data-construction and evaluation recipe for amortizing expensive grounded research behavior over evolving private/domain KBs, preserving inline citation support and abstention calibration under update splits. Before paper claims, we still need the bounded Qwen 3B joint-action run, comparisons against generic RAG distillation/citation-SFT framings, a KB write-back baseline or explicit scope exclusion, and a trusted dated/private KB snapshot beyond arXiv-id-inferred temporal splits.

### D102. Make paper-readiness blockers executable

Decision: Add `grounded-qa-distillation-paper-readiness-gate.mjs`, run `paper-readiness-gate-2026-06-26-v1`, and validate paper-readiness gate artifacts.

Reason: The novelty watchlist created a prose list of required work, but the project needs an auditable gate before any NeurIPS-level claim. The new gate reads the current run inventory, budget files, novelty watchlist, decision log, and temporal manifests. It reports 6 of 12 requirements passing: novelty watchlist, budget under cap, joint-action packet, bounded preflight, budgeted Prime launch plan, and narrowed claims. It reports 6 blockers: no trained Qwen 3B joint-action eval result, no grounded-correctness judge pass for that student, no DRAG-like generic RAG distillation comparison, no LongCite-style citation-SFT comparison, no WriteBack-RAG-style KB amortization baseline or scoped exclusion, and no trusted dated/private KB snapshot beyond inferred arXiv/paper-id temporalization. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Tradeoff: This is deliberately a failing gate. It prevents accidental paper-complete claims while making the remaining work concrete and evidence-linked. The next highest-leverage research action remains the bounded Qwen 3B run once Prime or HF execution is unblocked.

### D103. Add a LongCite-style citation-SFT support comparison

Decision: Add `grounded-qa-distillation-citation-sft-comparison.mjs`, run `longcite-style-citation-sft-comparison-2026-06-26-v1`, validate the artifact, and rerun `paper-readiness-gate-2026-06-26-v1`.

Reason: LongCite-style citation SFT is a close related-work neighbor, so the paper cannot rely on inline citation formatting metrics alone. The comparison reuses existing prediction and `gpt-4o` judge artifacts without new API calls. It shows that citation syntax compliance is not a proxy for grounded correctness: the local Qwen 0.5B answer-repeat student reaches 97.5% inline citation compliance after zero-call citation repair, but only 5.0% of answered predictions are judged supported. The stronger direct-mini citation-repair run reaches 100.0% inline citation compliance and 64.2% answer support, so the relevant distinction is support-preserving answer/evidence selection, not bracket syntax. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Result: The paper-readiness gate now reports 7 of 12 requirements passing and 5 blockers remaining: no trained Qwen 3B joint-action eval result, no grounded-correctness judge pass for that student, no DRAG-like generic RAG distillation comparison, no WriteBack-RAG-style KB amortization baseline or scoped exclusion, and no trusted dated/private KB snapshot beyond inferred arXiv/paper-id temporalization.

Tradeoff: This is a framing comparison, not a full LongCite reproduction. It is enough to retire the missing citation-SFT-comparison blocker, but it does not replace the needed Qwen 3B joint-action run or the stronger evolving-KB evidence requirement.

### D104. Add a DRAG-like generic RAG distillation comparison

Decision: Add `grounded-qa-distillation-drag-style-comparison.mjs`, run `drag-like-rag-distillation-comparison-2026-06-26-v1`, validate the artifact, and rerun `paper-readiness-gate-2026-06-26-v1`.

Reason: DRAG-like RAG-to-small-language-model distillation is the closest broad related-work family. The comparison should not pretend to be a full DRAG reproduction, but it should make the generic-RAG baseline pressure explicit. The new artifact reuses existing final-window predictions and `gpt-4o` support judgments. The closest generic direct-mini RAG student plus citation repair reaches 72.5% judged correctness and 64.2% answer support. A zero-call risk gate over that student improves judged correctness to 79.7% and answer support to 70.5%, but suppresses answers and lowers reference recall/F1. The local extractive and span scaffolds are cheaper but underpowered, and the local Qwen 0.5B answer-repeat SFT run shows the generic-SFT failure mode: 97.5% inline citation compliance with only 5.0% answer support. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Result: The paper-readiness gate now reports 8 of 12 requirements passing and 4 blockers remaining: no trained Qwen 3B joint-action eval result, no grounded-correctness judge pass for that student, no WriteBack-RAG-style KB amortization baseline or scoped exclusion, and no trusted dated/private KB snapshot beyond inferred arXiv/paper-id temporalization.

Tradeoff: This is a same-window framing and non-comparability artifact, not a faithful DRAG reproduction. It is enough to remove the missing generic-RAG-distillation comparison blocker, but a true DRAG reproduction may still be needed for a paper if reviewers demand apples-to-apples protocol matching.

### D105. Scope out WriteBack-RAG until trusted dated KB snapshots exist

Decision: Add `grounded-qa-distillation-writeback-scope.mjs`, run `writeback-kb-amortization-scoped-exclusion-2026-06-26-v1`, validate the artifact, and rerun `paper-readiness-gate-2026-06-26-v1`.

Reason: WriteBack-RAG is a competing amortization family: instead of distilling behavior into a student/scaffold, it writes derived evidence, summaries, or answers back into a memory/KB so later queries retrieve the augmented corpus. The current experiment does not implement that. Existing exports are answer labels, verifier labels, support-contrast preferences, and joint-action SFT/DPO rows. They train or evaluate a model/scaffold, but they do not create a persistent derived-memory index used by retrieval. A write-back baseline built from final-window judged outputs would leak evaluation facts into retrieval, and a fair version needs trusted dated/private KB snapshots so records can be written only from prior knowledge states. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Result: The paper-readiness gate now reports 9 of 12 requirements passing and 3 blockers remaining: no trained Qwen 3B joint-action eval result, no grounded-correctness judge pass for that student, and no trusted dated/private KB snapshot beyond inferred arXiv/paper-id temporalization.

Tradeoff: This is a scoped exclusion, not a baseline win. It is acceptable for the current paper framing only if the claim remains about post-training data/scaffold distillation over fixed evidence packs. A future stronger version should implement a train-window-only write-back memory with provenance and compare it under the same support/citation judge.

### D106. Upgrade the future holdout to trusted arXiv API dates

Decision: Add `grounded-qa-distillation-trusted-date-snapshot.mjs`, run `trusted-dated-kb-snapshot-arxiv-api-2026-06-26-v1`, validate the artifact, and rerun `paper-readiness-gate-2026-06-26-v1`.

Reason: The paper-readiness gate correctly rejected the previous temporal evidence because the split manifests relied on arXiv-id-prefix parsing. The new snapshot queries the arXiv API for every paper in `extended_temporal_future_holdout` and records authoritative `published` dates plus source URLs without using any final-window answers or judgments. Coverage is complete: 77 of 77 future-holdout papers have trusted dates. Three papers have trusted publication months that differ from the inferred id-prefix month, which confirms that the API snapshot is a real upgrade over string parsing. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365.

Result: The paper-readiness gate now reports 10 of 12 requirements passing and 2 blockers remaining: no trained Qwen 3B joint-action eval result and no grounded-correctness judge pass for that student.

Tradeoff: This is a trusted dated public arXiv snapshot, not a private KB. It supports stronger evolving-KB claims than id-prefix inference, but a private enterprise KB claim would still need a private/versioned corpus.

### D107. Probe whether local Qwen 3B training can replace blocked GPU rental

Decision: Patch the joint-action Qwen 3B training script to support `MODEL_DEVICE_MAP`, add `grounded-qa-distillation-joint-action-local-probe.mjs`, and materialize `joint-action-local-qwen3b-feasibility-probe-2026-06-26-v1`.

Reason: Prime remains blocked by an unauthorized API key and HF Jobs remains blocked by prepaid credits, so I tested whether the bounded Qwen 2.5 3B joint-action smoke could run locally without spending from the $100 budget. The local `uv` path can resolve the TRL/PEFT/Transformers stack and the Mac can load the model. The default `device_map=auto` path reaches tokenization but fails on the first SFT backward pass with a meta/MPS gradient mismatch caused by disk/meta offload. The `MODEL_DEVICE_MAP=none` path avoids offload and starts the first SFT backward pass on MPS, but it does not complete one bounded step after about five minutes. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365 with $0 external compute.

Result: Local Mac training is not a practical substitute for the remote GPU smoke. The paper-readiness gate stays at 10/12; the remaining blockers are still the trained Qwen 3B joint-action result and a grounded-correctness judge pass for that student.

Tradeoff: This does not produce model-quality results, but it removes an ambiguity in the execution plan. The training script remains remote-friendly because `MODEL_DEVICE_MAP` defaults to `auto`, while future local probes can opt into `none` explicitly.

### D108. Make the Qwen 3B smoke produce judge-ready predictions

Decision: Patch the joint-action Qwen 3B trainer to always save the final DPO adapter locally, add `eval_joint_action_adapter_uv.py` to the packet, add `grounded-qa-distillation-joint-action-eval-prep.mjs`, and materialize `joint-action-eval-prep-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`.

Reason: The bounded paid smoke will run with `PUSH_TO_HUB=false` to avoid avoidable side effects, but the prior trainer only saved the SFT adapter unconditionally and relied on Hub push for the final DPO model. That would have made the expensive run harder to evaluate. The trainer now writes `joint-action-dpo-adapter`, and the evaluator loads that PEFT adapter to produce `predictions.jsonl`, `result.json`, and `report.md` for the 69 final-window prompts. Both train and eval scripts compile. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend at $5.87832365 with $0 external compute.

Result: Once Prime auth or HF credits are repaired, the next remote command can train the bounded adapter and immediately run the adapter evaluator. The remaining paid OpenAI step is the grounded-correctness judge over those predictions.

Tradeoff: This is still not a trained-model result. It reduces execution risk and spend risk by ensuring the next GPU run produces the exact artifact needed for the readiness gate rather than an unevaluated checkpoint.

### D109. Preflight the final Qwen 3B grounded-correctness judge

Decision: Add `grounded-qa-distillation-joint-action-judge-plan.mjs`, materialize `joint-action-judge-plan-joint-action-qwen3b-smoke-eval-v1`, and validate judge-plan artifacts.

Reason: The readiness gate will still fail after GPU training unless the trained student predictions are judged for answer support, citation support, and abstention support. The existing OpenAI judge runner can perform that evaluation, but the Qwen 3B path needed a budget-gated launch plan that points at the future `joint-action-qwen3b-smoke-eval-v1` prediction run and the `extended_temporal_future_holdout` split. The plan estimates the full 69-example `gpt-4o` judge at $0.467165 using full evidence packs and reference answers as stand-ins before model predictions exist. This would keep total actual spend at about $6.3455 before GPU compute, well under the $100 cap. The plan makes zero OpenAI calls, appends no ledger rows, and records that predictions do not exist yet.

Result: The post-GPU sequence is now explicit: run adapter eval to create `predictions.jsonl`, run the dry judge command, then run the paid `gpt-4o` judge only if the budget gate still passes. The paper-readiness blockers remain unchanged until those artifacts exist.

Tradeoff: The estimate is a pre-prediction upper-bound style plan, not actual judge spend. Actual cost must still be ledgered by `grounded-qa-distillation-openai-judge.mjs` after Qwen 3B predictions exist.

### D110. Keep readiness gates from counting plans as results

Decision: Patch `grounded-qa-distillation-paper-readiness-gate.mjs` so `grounded_correctness_eval_for_student` requires an actual `openai-judge-*` run whose result has positive `calls_made`, positive `metrics.examples_judged`, and a Qwen 3B joint-action prediction run.

Reason: The new judge-plan artifact intentionally contains the words `judge`, `joint-action`, and `qwen3b`, which exposed a readiness-gate bug: the old regex treated plan artifacts as if grounded-correctness judging had already happened. That would have hidden one of the two true paper blockers. The gate now distinguishes launch plans from completed paid judgment artifacts. The corrected readiness run is back to 10/12, with both the trained Qwen 3B result and grounded-correctness judge pass still failing. This makes zero OpenAI calls and creates no GPU job.

Tradeoff: The gate is stricter and may ignore malformed or partially completed judge attempts. That is intentional for paper-readiness: only completed judged examples should satisfy the requirement.

### D111. Reduce the remote GPU smoke to one command

Decision: Add executable `run_joint_action_smoke.sh` to the joint-action Qwen 3B packet, add `grounded-qa-distillation-joint-action-remote-smoke-plan.mjs`, materialize `joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`, and update the Prime GPU plan to point at the runner.

Reason: The launch plan had been hardened in pieces, but a remote pod still required a human to run validate, train, eval, and manifest steps separately. That increases the chance of spending GPU money and ending with no judge-ready predictions. The new runner validates the dataset, runs bounded SFT/DPO with `MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none`, evaluates `joint-action-dpo-adapter` into `runs/joint-action-qwen3b-smoke-eval-v1/`, and writes `smoke_manifest.json` with the expected artifacts and judge next-step. The remote-smoke plan verifies the runner is executable, passes Bash syntax, includes dataset validation, bounded training, adapter eval, and manifest writing. This makes zero OpenAI calls and creates no GPU job.

Result: After Prime auth or HF credits are repaired, the paid path is one command followed by the already budgeted judge plan. The combined planned GPU smoke plus `gpt-4o` judge estimate would bring total actual spend to about $10.3455, still under the $100 cap.

Tradeoff: This does not remove the backend-auth blocker or produce model results. It reduces operational risk so the next paid run is much more likely to generate the exact prediction artifacts needed by the readiness gate.

### D112. Diagnose Prime as an auth blocker, not a proven funds blocker

Decision: Treat the current Prime failure as an API-key authorization blocker until a replacement key is installed through the hidden secret prompt and `prime whoami` succeeds.

Reason: `prime whoami` fails with `API key unauthorized`, and no Prime environment variable is exported in the current shell. The CLI is reading `/Users/ryanprendergast/.prime/config.json`, whose saved `pit_...` key was last written in March 2026. I changed the config file mode from `0644` to `0600` but did not print or commit the key. Because Prime rejects the token before account/team inspection, this result cannot distinguish an expired/revoked key from missing key permissions, and it cannot prove whether the account has enough funds. The hidden macOS prompt for `PRIME_API_KEY` timed out without a replacement key, so no Prime balance or GPU launch can be verified yet. This makes zero OpenAI calls, creates no GPU job, and leaves actual spend unchanged.

Result: The next unblock step is to enter a fresh Prime key in the hidden prompt, update only the local Prime config secret field, run `prime whoami`, then run non-launching Prime account/availability checks before any paid pod creation. The $100 total budget still includes future Prime GPU spend.

Tradeoff: This is operational diagnosis, not experimental progress. It prevents incorrectly blaming account funds when the observable failure is still authentication.

### D113. Align the budgeted Prime launch plan with the train-plus-eval smoke runner

Decision: Patch `grounded-qa-distillation-joint-action-launch-plan.mjs` so its bounded command uses `run_joint_action_smoke.sh`, add `estimated_launch_cost_usd` to the budget block, and allow the script to update an existing zero-cost planned ledger row when the planned command changes.

Reason: The newer remote smoke plan correctly reduced the paid path to one command that validates the dataset, trains the bounded SFT/DPO adapter, evaluates the saved DPO adapter, and writes judge-ready predictions. The older budgeted launch plan still emitted the direct train-only command, which meant the spend gate and the operational command disagreed. Regenerating the Prime launch plan rewrote only the planned zero-cost Prime ledger row to point at the train-plus-eval runner; it did not touch any actual spend row, make any OpenAI calls, create any GPU job, or change total actual spend. Actual spend remains $5.87832365 with $0 external compute.

Result: After Prime auth is repaired, the budgeted Prime command and the remote smoke packet now both run `RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none .../run_joint_action_smoke.sh`. This should produce the prediction artifact needed by the remaining grounded-correctness judge gate if the GPU run succeeds.

Tradeoff: This still does not unblock Prime credentials or produce the Qwen 3B result. It removes an avoidable operational mismatch before any paid GPU minutes are used.

### D114. Add a pre-judge integrity gate for Qwen 3B predictions

Decision: Add `grounded-qa-distillation-qwen3b-prediction-integrity-gate.mjs`, materialize `qwen3b-prediction-integrity-gate-joint-action-qwen3b-smoke-eval-v1`, and patch the Qwen 3B judge plan to require this gate before any paid OpenAI judging.

Reason: The remaining paid OpenAI step should only run after the remote GPU smoke produces complete, schema-valid, citation-valid predictions. The new gate reads the expected 69 eval prompts and the future Qwen 3B prediction artifacts, then checks row count, unique ids, reference consistency, local score/result consistency, JSON parse errors, citation ids against each compact evidence pack, inline citation coverage warnings, and smoke manifest bounds. Because the prediction artifacts are still absent, the current gate status is `waiting_for_qwen3b_predictions`. This makes zero OpenAI calls, launches no GPU jobs, and leaves total actual spend at $5.87832365 with $0 external compute.

Result: The post-GPU sequence is now explicit and fail-closed: run the one-command smoke, run the integrity gate, run the dry judge, then run the paid grounded-correctness judge only if integrity and budget gates pass.

Tradeoff: This does not produce model results while Prime/HF execution is blocked. It protects the remaining budget from being spent on malformed or incomplete prediction artifacts once GPU execution is available.

### D115. Add a guarded post-smoke judge pipeline

Decision: Add `grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs`, materialize `qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1`, and update the Qwen 3B judge plan to point at this pipeline as the canonical post-GPU command.

Reason: After a successful GPU smoke, the project still needed several manual steps: rerun the prediction integrity gate, run the dry judge, inspect that all 69 examples are accounted for, then run the paid judge with the OpenAI key and budget cap loaded. The new pipeline sequences those steps and fails closed. In default mode it runs only zero-cost steps; it runs the paid `gpt-4o` judge only with `--run-paid=true`, after integrity passes, dry judge coverage matches the expected final-window size, `OPENAI_API_KEY` is present, and the OpenAI judge script's budget guard still passes. Running it now records `waiting_for_qwen3b_predictions`, makes zero OpenAI calls, launches no GPU jobs, and leaves total actual spend at $5.87832365 with $0 external compute.

Result: Once Prime or HF execution is repaired, the operational path is now two commands: run the bounded Qwen 3B smoke, then run the guarded post-smoke pipeline first without `--run-paid=true` and then with it if the dry run and budget gate are acceptable.

Tradeoff: This still does not remove the remote GPU auth/credit blocker. It reduces the chance that the first successful training run stalls before the judged result needed by the paper-readiness gate.

### D116. Add a manuscript evidence map to prevent overclaiming

Decision: Add `grounded-qa-distillation-manuscript-evidence-map.mjs`, materialize `manuscript-evidence-map-2026-06-26-v1`, and validate the artifact as a zero-cost paper-claims map.

Reason: The project now has many result and comparison artifacts, but a paper draft needs a single auditable map from run IDs to claims, tables, blocked claims, and manuscript sections. The evidence map reads the readiness gate, dated snapshot, scaffold-transfer results, deterministic guard validation, mini-verifier synthesis, DRAG-like comparison, LongCite-style comparison, WriteBack scoped exclusion, Qwen 3B launch plan, and budget artifacts. It explicitly says the project is not paper-ready, keeps the Qwen 3B trained-student and grounded-judge claims blocked, and separates currently claimable scaffold/related-work results from claims that would overstate the evidence. This makes zero OpenAI calls, launches no GPU jobs, and leaves total actual spend at $5.87832365 with $0 external compute.

Result: A manuscript can now be drafted against an evidence map that reports 10/12 readiness requirements passing, identifies the two missing Qwen 3B artifacts, and preserves the public-dated-KB caveat rather than claiming private-KB proof.

Tradeoff: This is a paper-readiness and claim-control artifact, not a new empirical result. It does not replace the remote Qwen 3B smoke or the required grounded-correctness judge.

### D117. Generate a conservative manuscript draft skeleton

Decision: Add `grounded-qa-distillation-manuscript-draft.mjs`, materialize `manuscript-draft-2026-06-26-v1`, and validate the draft as a zero-cost not-submission-ready artifact.

Reason: The evidence map makes claim boundaries explicit, but the project also needs an actual manuscript scaffold that can absorb the final Qwen 3B result once it exists. The draft generator reads the evidence map and readiness gate, then writes `manuscript.md`, `report.md`, and `result.json` with sections for introduction, task/protocol, data construction, experiments, related work, and limitations. It includes current scaffold-result tables and Qwen 3B TODO tables, but marks the abstract/final result as blocked and repeats the claims-to-avoid list. This makes zero OpenAI calls, launches no GPU jobs, and leaves total actual spend at $5.87832365 with $0 external compute.

Result: The paper is easier to finish once the remote Qwen 3B smoke and judge artifacts exist, while the generated draft itself cannot be mistaken for a completed NeurIPS-ready manuscript.

Tradeoff: This is writing infrastructure, not evidence of trained-student success. It should not be used to claim completion until the readiness gate passes and the final novelty audit is refreshed.

### D118. Add a reviewer-risk audit before spending on final evidence

Decision: Add `grounded-qa-distillation-reviewer-risk-audit.mjs`, materialize `reviewer-risk-audit-2026-06-26-v1`, and validate reviewer-risk audit artifacts.

Reason: The manuscript scaffold and evidence map make the project easier to finish, but they could still hide rejection risks if treated as enough for a conference claim. The reviewer-risk audit names the most likely reviewer objections before the next paid run: the missing trained Qwen 3B result, the missing grounded-correctness judge, private-KB overclaiming from a public dated proxy, novelty pressure from generic RAG distillation and citation SFT, model-judge reliability, coverage/support tradeoffs, and remote compute/auth reproducibility. It records the exact acceptance path from Prime/HF repair through bounded Qwen 3B smoke, integrity/dry judge, paid judge, novelty refresh, and manuscript regeneration. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The paper-readiness surface now has an enforceable risk audit that remains `not_submission_ready` and preserves both critical Qwen 3B blockers.

Tradeoff: This is still paper-risk control, not new empirical evidence. It does not replace the GPU smoke or the paid grounded-correctness judge; it reduces the chance that the project overclaims before those artifacts exist.

### D119. Refresh novelty pressure with current citation-RAG and grounded-index neighbors

Decision: Update `grounded-qa-distillation-novelty-watchlist.mjs`, regenerate `novelty-watchlist-2026-06-26-v1`, update `RELATED_WORK_NOTES.md`, and require refreshed web-source provenance in validation.

Reason: The goal requires current paper/internet checks before any NeurIPS-ready claim. A fresh June 26, 2026 source pass adds two relevant neighbors that sharpen the claim boundary: KohakuRAG pressures citation-ready hierarchical RAG with abstention-aware voting, and GROUNDEDKG-RAG pressures grounded graph/index construction as a lower-cost alternative to model/scaffold distillation. Together with DRAG, LongCite, GRACE, WriteBack-RAG, DynaQuest, and RAG generator benchmarks, these works confirm that the defensible contribution is not citation RAG, dynamic QA, abstention training, grounded retrieval, or generic RAG distillation. It must be the data-construction and evaluation recipe for amortizing expensive grounded research behavior into cheaper models/scaffolds under update-heldout KB states. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The novelty watchlist now records refreshed queries and web sources, includes ten close neighbors, and keeps the paper-readiness gate blocked only on the trained Qwen 3B result and grounded-correctness judge.

Tradeoff: This is still a novelty-pressure artifact, not a full related-work section or empirical result. A final search must be rerun immediately before any submission-ready claim.

### D120. Add a zero-cost judge calibration audit queue

Decision: Add `grounded-qa-distillation-judge-calibration-audit.mjs`, materialize `judge-calibration-audit-2026-06-26-v1`, and validate judge-calibration audit artifacts.

Reason: The reviewer-risk audit correctly flagged model-judge reliability as open. The current evidence relies on `gpt-4o` support judgments, so the paper needs an auditable path to inspect hard cases before treating those numbers as conference-grade evidence. The calibration audit reads existing local judge outputs only: direct mini repair, balanced risk gate, and claim-entailment guard over the 240-389 transfer/final windows. It loads 447 judgments across 149 unique examples, records source-run metrics, and writes a 26-row `audit_queue.jsonl` with unsupported answers, questionable abstentions, correct-abstention sanity checks, and cross-policy disagreements. This makes zero new OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The project now has a concrete spot-check queue for judge calibration. The manuscript should still call the current metrics model-judged until that queue is manually adjudicated or independently judged.

Tradeoff: This mitigates judge-reliability risk but does not close it. It is not a human audit, and it does not replace the missing Qwen 3B trained-student judge pass.

### D121. Join judge audit rows into a human-adjudication packet

Decision: Add `grounded-qa-distillation-judge-adjudication-packet.mjs`, materialize `judge-adjudication-packet-2026-06-26-v1`, and validate judge-adjudication packet artifacts.

Reason: The judge calibration audit identified hard cases, but an actionable reliability check needs each sampled row to include the original question, compact evidence pack, document metadata, reference output, policy prediction, and judge verdict in one place. The new packet joins the 26 calibration rows back to `extended_temporal_future_holdout.jsonl` and the relevant prediction runs, then writes `adjudication_packet.jsonl` with a blank adjudication form for human or independent second-judge review. All 26 rows join cleanly with no missing evidence or predictions. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The judge-reliability risk is now operationally actionable: a reviewer can adjudicate sampled unsupported answers, questionable abstentions, correct-abstention sanity checks, and cross-policy disagreements without searching run directories.

Tradeoff: This still does not produce independent labels. It prepares the adjudication surface; someone or a separate judged pass must fill it before claiming calibrated judge reliability.

### D122. Add a cost/coverage/support Pareto audit

Decision: Add `grounded-qa-distillation-cost-coverage-pareto.mjs`, materialize `cost-coverage-support-pareto-2026-06-26-v1`, validate it, and wire it into the reviewer-risk audit.

Reason: The strongest completed support gains are vulnerable to a reviewer objection that the system is buying correctness by abstaining more. The Pareto artifact reads existing judged outputs and comparison artifacts only, then places direct mini repair, balanced risk gate, claim-entailment guard, mini-verifier gate, and local zero-call scaffold anchors on one table with answer rate, answer support, judged correctness, citation recall, and online OpenAI calls per query. This makes the coverage/support/cost tradeoff explicit before spending on the final Qwen 3B evidence. It makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The project now has an auditable paper table showing that claim-entailment is the best zero-extra-call support-first point so far, while the mini-verifier has stronger correctness but violates the desired amortized low-cost shape by adding a per-query LLM verifier. The Qwen 3B joint-action smoke and grounded-correctness judge remain required final evidence.

Tradeoff: This is not new empirical evidence and mixes aggregate 149-example judged policies with final-window local anchors. It is a risk-control and reporting artifact, not a substitute for the missing trained-student result.

### D123. Recheck Prime auth after upgrading the CLI

Decision: Upgrade the local Prime CLI from `0.5.44` to `0.6.15`, add `grounded-qa-distillation-prime-cli-auth-recheck.mjs`, materialize `prime-cli-upgrade-auth-recheck-2026-06-26-v1`, and validate the recheck artifact.

Reason: Prime was blocking the paper-critical Qwen 3B smoke with `API key unauthorized`, but the installed CLI was behind the latest advertised version. Before requiring another secret or spending on another backend, I tested the no-spend repair path: upgrade the CLI and rerun authenticated `whoami`, `teams list`, and `availability list` checks. The upgraded CLI still rejects the saved key on all authenticated checks, so stale CLI version is unlikely to be the root cause. Because Prime rejects the token before account/team/availability access, this still cannot prove whether the account has sufficient funds. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: The current Prime blocker is still token validity or permissions. The next GPU step remains: install a valid Prime key through the hidden-input helper or complete browser login, rerun the auth recheck, verify live pricing/balance, then launch the bounded Qwen 3B smoke only if the total budget remains under `$100`.

Tradeoff: This is operational evidence, not a model result. It prevents wasting time on an old-CLI hypothesis, but it does not remove the need for a valid Prime token or HF credits.

### D124. Prepare a blind second-pass judge reliability plan

Decision: Add `grounded-qa-distillation-judge-reliability-second-pass-plan.mjs`, materialize `judge-reliability-second-pass-plan-2026-06-26-v1`, validate it, and wire it into the reviewer-risk audit.

Reason: The judge calibration audit and adjudication packet made model-judge reliability inspectable, but they still required a manual reader to decide the next action. The new plan converts the 26-row adjudication packet into blind second-pass request rows that hide the original `gpt-4o` verdicts while preserving the question, compact evidence pack, reference answerability, and policy predictions. It covers 42 policy cases across unsupported answers, questionable abstentions, correct-abstention sanity checks, and cross-policy disagreements, and estimates a later `gpt-4o-mini` second pass at about `$0.0148`. The plan makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend unchanged.

Result: Judge reliability now has an executable low-cost next step: run the blind second-pass requests, join by `packet_id` and `case_id`, and report agreement/disagreement by audit type before using model-judged support numbers as paper-grade evidence.

Tradeoff: This still does not produce independent labels. It prepares the request set and budget gate; a human adjudicator or explicit paid second-pass judge run is still required to close the reliability risk.

### D125. Run the blind second-pass judge and keep the diagnostic rerun

Decision: Add `grounded-qa-distillation-judge-reliability-second-pass-runner.mjs`, execute the blind second-pass judge with `gpt-4o-mini`, materialize `judge-reliability-second-pass-run-2026-06-26-v1` and `judge-reliability-second-pass-run-2026-06-26-v2`, and validate completed second-pass run artifacts.

Reason: The second-pass plan was cheap enough to run under the `$100` cap, and model-judge reliability is a real reviewer risk. The first paid run made 42 calls and cost `$0.0075324`, but it exposed a prompt/schema ambiguity: the second-pass judge sometimes returned abstention verdicts for answered predictions. I kept that run as a diagnostic spend artifact, tightened the prompt to remove reference-answer leakage and forbid answer-type-incompatible verdicts, then reran v2. The v2 run made 42 calls, cost `$0.00724395`, had zero schema violations, and reached 32/42 exact agreement (76.2%) with the original `gpt-4o` judge on deliberately hard calibration rows. All 84 calls are recorded in `llm-calls/ledger.jsonl`; total actual spend is now `$5.8931`, still under budget.

Result: The paper can now report a concrete judge-reliability spot check rather than only a plan. The result supports the unsupported-answer and correct-abstention sanity-check portions of the current judge, but it also flags abstention-boundary cases as unstable: the questionable-abstention bucket has 0/6 exact agreement. The manuscript should present model-judged support metrics with this caveat and disagreement examples.

Tradeoff: This still does not create human labels, and `gpt-4o-mini` is not a gold adjudicator. It is a low-cost independent model check that improves transparency but does not fully close the reliability risk.

### D126. Convert second-pass disagreement into abstention-boundary constraints

Decision: Add `grounded-qa-distillation-abstention-boundary-reliability-audit.mjs`, materialize `abstention-boundary-reliability-audit-2026-06-26-v1`, validate it, and wire it into the evidence map, manuscript draft, and reviewer-risk audit.

Reason: The blind second-pass judge result is useful only if it changes the paper's claims. Overall agreement is 76.2%, and unsupported-answer plus correct-abstention sanity buckets look comparatively stable, but the questionable-abstention bucket has 0/6 exact agreement. That means the current support-aware gates can be defended as reducing unsupported answers, but abstention-boundary calibration remains uncertain. The new audit makes that distinction explicit and adds manuscript constraints: call metrics model-judged, report answer rate with support, do not claim abstention calibration is solved, and use disagreement examples to motivate the joint-action Qwen 3B objective. This makes zero new OpenAI calls and leaves actual spend at `$5.8931`.

Result: The manuscript draft now contains the concrete second-pass reliability caveat instead of generic judge-risk language. The reviewer-risk audit now records abstention-boundary instability as an explicit remaining risk rather than hiding it behind the aggregate 76.2% agreement number.

Tradeoff: This makes the claims narrower and more conservative. It improves paper defensibility but does not produce the missing trained-student result or human adjudication.

### D127. Add a fail-closed final-evidence checklist

Decision: Add `grounded-qa-distillation-final-evidence-checklist.mjs`, materialize `final-evidence-checklist-qwen3b-2026-06-26-v1`, validate it, and wire it into the reviewer-risk audit.

Reason: The project now has a ready Qwen 3B packet, remote smoke command, post-smoke judge pipeline, budget tracking, and judge-reliability audits, but the final evidence path still needs a single fail-closed checklist that prevents a partial GPU run or partial judge run from being mistaken for a paper-ready result. The checklist recomputes current actual spend after the second-pass reliability work (`$5.8931`), adds the planned `$4` GPU smoke and `$0.467165` Qwen judge estimates, and confirms the final evidence path is still under the `$100` cap at about `$10.3603`. It lists the exact missing artifacts: Qwen predictions/result/report/smoke manifest, integrity gate, dry judge, paid judge, Pareto-table update, regenerated manuscript/risk artifacts, and final novelty refresh. This makes zero OpenAI calls and launches no GPU jobs.

Result: The remaining blockers are now executable acceptance criteria rather than prose. The paper cannot claim a trained smaller model preserves citation-grounded correctness until this checklist passes.

Tradeoff: This does not repair Prime auth or create the Qwen 3B result. It reduces the chance of wasting the next GPU/auth window on incomplete evidence.

### D128. Tighten the June 2026 novelty watchlist around updated-corpus and agentic RAG neighbors

Decision: Refresh `grounded-qa-distillation-novelty-watchlist.mjs`, regenerate `novelty-watchlist-2026-06-26-v1`, update `RELATED_WORK_NOTES.md`, and propagate the stricter novelty constraints through the readiness gate, manuscript evidence map, manuscript draft, reviewer-risk audit, and final-evidence checklist.

Reason: A final paper cannot be framed as generic RAG distillation, citation SFT, dynamic QA, or grounded abstention. The refreshed literature pass adds DRAGOn (`https://arxiv.org/abs/2507.05713`) for periodically updated-corpus RAG evaluation, DRAGON (`https://arxiv.org/abs/2505.10989`) for domain-specific automatic RAG data generation, and Search-P1 (`https://arxiv.org/abs/2602.22576`) for agentic-RAG training with path rewards. These are close enough that the paper must explicitly avoid claiming updated-corpus benchmarking, domain RAG data generation, or agentic trajectory training as the contribution.

Result: The current defensible novelty hypothesis is narrower: a data-construction and evaluation recipe for amortizing expensive grounded research behavior into a cheaper citation-faithful model/scaffold over evolving domain KB states, measured with answer support, citation support, abstention support, coverage, and cost. The readiness gate remains 10/12 and still fails on the missing Qwen 3B smoke and missing grounded-correctness judge for that trained student.

Tradeoff: This improves reviewer defensibility but raises the bar for the final result. The final paper now needs to show the effect is not explainable as updated-corpus benchmark construction, domain RAG data generation, generic citation SFT, generic RAG-to-SLM distillation, or online agentic-RAG training. This refresh made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

### D129. Add a historical post-training data policy ablation

Decision: Add `grounded-qa-distillation-post-training-policy-ablation.mjs`, materialize `post-training-policy-ablation-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map and reviewer-risk audit.

Reason: The paper question is not just whether a cheap system can answer with citations; it asks how post-training data should be constructed so a cheaper model/scaffold preserves citation-grounded correctness. Existing artifacts had many individual runs, but no single table comparing direct compact-RAG labels, claim-pruned labels, support-risk gated labels, and local/tiny SFT anchors across judged windows. The new ablation reuses historical judge outputs only, so it costs nothing and does not depend on Prime auth.

Result: Direct compact-RAG/citation-repair labels cover 389 examples with 77.6% answer rate, 66.2% answer support, and 73.8% overall judged correctness. Support-risk gated labels are the strongest current direction, with 74.2% answer support and 83.0% overall judged correctness, but answer only 57.6% of rows. Claim pruning alone is not enough, and local/tiny SFT anchors remain too weak. The Qwen 3B joint-action run should therefore use support-risk contrast and answer/abstain supervision, and it must improve support/correctness without collapsing coverage to the gate floor.

Tradeoff: This is a historical ablation over non-identical windows, not a definitive leaderboard. It strengthens the data-construction argument and Qwen 3B acceptance criteria, but it does not replace the missing trained Qwen 3B result or the paid grounded-correctness judge for that result. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

### D130. Add a coverage-constrained support frontier for Qwen 3B acceptance

Decision: Add `grounded-qa-distillation-coverage-constrained-frontier.mjs`, materialize `coverage-constrained-support-frontier-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map and reviewer-risk audit.

Reason: The policy ablation showed support-risk gating is the best current direction, but it could still win by suppressing too many answers. The paper needs a coverage-constrained target so a trained student cannot be counted as successful merely for imitating a low-coverage abstention gate. The new replay uses existing gate scores and already-paid direct/gate judge labels over future windows 160-389, with no new model calls.

Result: The direct baseline answers 79.0% of rows with 65.2% answer support and 72.5% overall judged correctness. The best 70% answer-rate operating point is threshold `0.55`, answering 72.1% of rows with 68.5% answer support and 77.3% judged correctness. The support-first `0.65` threshold reaches 82.1% judged correctness, but answers only 60.3% of rows. The Qwen 3B joint-action student should therefore be judged against both the direct baseline and the 70% coverage-constrained frontier.

Tradeoff: This is an inherited-judgment replay, not a fresh judge pass. It is appropriate for setting acceptance targets and reviewer-risk controls, but it does not replace the missing Qwen 3B training run or final paid grounded-correctness evaluation. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

### D131. Add a Qwen 3B joint-action packet quality audit

Decision: Add `grounded-qa-distillation-joint-action-packet-quality-audit.mjs`, materialize `joint-action-packet-quality-audit-2026-06-26-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, and reviewer-risk audit.

Reason: Before spending any GPU budget, the paper-critical Qwen 3B packet needed an explicit pre-launch audit tied to the new 70% coverage-constrained frontier. The packet should not merely contain citation-format SFT rows; it must encode both supported answer repair/regeneration and abstention preferences over judged unsupported answers, while preserving final-window paper separation.

Result: The audit passes. It verifies 244 SFT rows and 80 DPO rows; SFT includes 220 grounded-answer targets and 24 abstentions; DPO includes 56 chosen grounded repairs and 24 chosen abstentions; all 80 rejected DPO outputs are grounded answers; grounded chosen/SFT targets have no missing inline citations; and train/eval paper overlap is zero. The final-evidence checklist now has a passed `packet_quality_ready` criterion, while auth/pricing, smoke artifacts, integrity, dry judge, paid judge, Pareto update, manuscript regeneration, and final novelty refresh remain failing until the actual Qwen 3B run exists.

Tradeoff: This proves launch readiness of the packet, not model quality. It does not remove the Prime/HF auth blocker and does not justify any trained-student claim. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

### D132. Add a zero-cost Qwen 3B smoke script contract audit

Decision: Add `grounded-qa-distillation-joint-action-script-contract-audit.mjs`, materialize `joint-action-script-contract-audit-2026-06-26-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: The packet quality audit proved the SFT/DPO data was launch-ready, but the next paid GPU window still needed a no-spend check that the actual smoke runner would compile, validate the packet, keep bounded settings, run eval, and produce the artifacts required by the integrity and judge gates. The new audit runs `python3 -m py_compile` on the train and eval scripts, executes the local packet validator, checks `bash -n` for the runner, and verifies the script contract for bounded `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, `REPORT_TO=none`, local DPO adapter saving, judge-ready prediction artifacts, and no OpenAI API call sites in the evaluator. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend at `$5.8931`.

Result: The audit passes with status `script_contract_ready_for_paid_smoke`. The final-evidence checklist now has both `packet_quality_ready` and `script_contract_ready` passing, but it still fails on auth/pricing, Qwen 3B smoke artifacts, integrity, dry judge, paid judge, Pareto update, post-judge manuscript regeneration, and final novelty refresh.

Tradeoff: This is stronger launch evidence, not a model result. The project remains not paper-ready until the actual Qwen 3B predictions exist and a paid grounded-correctness judge evaluates them under the `$100` total budget.

### D133. Add a post-smoke external compute ledger finalizer

Decision: Add `grounded-qa-distillation-joint-action-smoke-ledger-finalizer.mjs`, materialize `joint-action-smoke-ledger-finalizer-joint-action-qwen3b-smoke-eval-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: The launch plan had a planned external-compute ledger row, but the paper-critical run also needs a fail-closed way to record actual GPU spend after backend execution. The finalizer inspects the expected Qwen 3B smoke artifacts, checks the `$100` total budget gate using current OpenAI plus external-compute spend, and only appends a nonzero actual external-compute row when explicitly run with `--record=true` after a terminal backend status. For `--status=completed`, it refuses to record unless `predictions.jsonl`, `result.json`, `report.md`, and `smoke_manifest.json` are all present. The dry run records no spend and currently reports `waiting_for_smoke_artifacts`.

Result: The final-evidence checklist now has `actual_compute_ledger_ready` passing alongside packet quality and script-contract readiness. Actual spend remains `$5.8931`, actual external compute remains `$0`, and the remaining blockers are still Prime/HF auth, the actual Qwen 3B smoke artifacts, integrity/dry/paid judge, Pareto update, post-judge manuscript regeneration, and final novelty refresh.

Tradeoff: This improves spend accountability and reproducibility, but it still does not create the trained student result. The next paid GPU run must still be launched only after backend auth/pricing are verified and total estimated spend remains under `$100`.

### D134. Add a Prime-specific Qwen 3B smoke runbook and pod bootstrap

Decision: Add `grounded-qa-distillation-prime-smoke-runbook.mjs`, materialize `prime-qwen3b-smoke-runbook-2026-06-26-v1`, write executable pod-side bootstrap script `run_prime_qwen3b_smoke_on_pod.sh` into the Qwen packet, validate the runbook, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: Prime auth is still blocked, but the next successful auth window should not require reconstructing a remote execution procedure by hand. The runbook checks the local Prime CLI surface without authenticated calls: pod creation supports noninteractive flags, availability supports JSON price fields, and pod status supports JSON metadata capture. It then gives a guarded sequence for Prime auth, live L4 price query, bounded pod creation, pod status capture, repo sync without secrets, pod-side bootstrap, prediction artifact fetch, actual-cost finalization, and pod termination. The bootstrap installs `uv` if missing, records remote environment/GPU metadata, runs the existing bounded Qwen smoke runner, and writes a remote bootstrap manifest. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend at `$5.8931`.

Result: The runbook passes with status `ready_after_prime_auth_and_live_price`; the final-evidence checklist now marks `prime_runbook_ready` as passing. The auth/pricing gate still fails because the saved Prime key remains unauthorized and HF credits are insufficient.

Tradeoff: This removes operational ambiguity from the paid run, but it is not authorization and not a model result. The Qwen 3B smoke still cannot run until a valid backend credential or credits are available and live pricing keeps total spend under `$100`.

### D135. Add a fail-closed Qwen 3B result integration gate

Decision: Add `grounded-qa-distillation-qwen3b-result-integration.mjs`, materialize `qwen3b-result-integration-joint-action-smoke-2026-06-26-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: After the Qwen 3B smoke and paid judge exist, the project needs an executable decision point rather than a manual interpretation step. The integration gate reads the future prediction result and `gpt-4o` judge result, computes answer rate, answer support, abstention support, overall judged correctness, citation recall, and answer F1, compares those metrics against the direct baseline and the 70% coverage-constrained frontier, and emits the exact Qwen row that should be added to the cost/coverage/support Pareto table. It defines the minimum acceptance target as answer rate at least 70%, answer support above the direct baseline, and overall judged correctness above the direct baseline, while separately reporting whether Qwen also beats the 70% frontier.

Result: The current artifact correctly reports `waiting_for_qwen3b_predictions`, makes zero OpenAI calls, launches no GPU jobs, and records no spend. The final-evidence checklist now fails explicitly on `qwen3b_result_integrated` until real Qwen predictions and a paid judge are available.

Tradeoff: This does not remove the backend-auth blocker and does not add model evidence. It prevents future overclaiming by forcing the Qwen result to be classified as strong positive, minimum positive, or negative before updating the Pareto table or manuscript.

### D136. Make Prime auth and live pricing an executable gate

Decision: Add `grounded-qa-distillation-prime-auth-price-gate.mjs`, materialize `prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: The final checklist should not hardcode the Prime/HF auth blocker. After a valid secret is installed, the project needs a repeatable no-spend check that proves Prime identity, wallet access, live L4 availability/pricing, and total-budget headroom before creating any pod or recording external compute.

Result: The current artifact fails closed with `auth_or_price_blocked`: `prime whoami` returns unauthorized, so wallet and live GPU pricing remain unverified. The estimated total budget check still passes under the `$100` cap. The gate makes zero OpenAI calls, launches no GPU jobs, and records no spend.

Tradeoff: This is still not a trained-model result or a backend repair by itself. It makes the blocker auditable and gives the next valid-key attempt a deterministic pass/fail gate before any Prime spend.

### D137. Treat tiny/local students as negative controls and keep the bounded Qwen 3B smoke as the next model run

Decision: Add `grounded-qa-distillation-model-scale-adequacy-audit.mjs`, materialize `model-scale-adequacy-audit-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, reviewer-risk audit, and README.

Reason: The project needed a concrete answer to whether the current tiny/local models are already too small and whether the next spend should be a GPU rental, a cutting-edge large model, or more tiny-model distillation. Existing evidence was scattered across local SFT, direct mini RAG, risk-gate, and coverage-frontier artifacts.

Result: The audit rejects tiny models as final students or ground-truth labelers. Qwen 0.5B SFT reaches 97.5% inline citation compliance but only 5.0% judged answer support and 42.0% overall judged correctness; another compact Qwen 0.5B path collapses to all abstentions. The next minimum credible trained-student experiment remains the bounded Qwen 3B joint-action smoke under the `$100` total cap, gated by Prime auth/live pricing. The audit does not recommend an open-ended cutting-edge GPU run before the Qwen 3B result is known.

Tradeoff: This does not replace the missing Qwen 3B predictions or paid grounded-correctness judge. It prevents wasting budget on too-small labelers or premature large-model escalation while keeping the final trained-student claim blocked until real Qwen 3B evidence exists.

### D138. Make the public-proxy versus private-KB boundary executable

Decision: Add `grounded-qa-distillation-corpus-realism-audit.mjs`, materialize `corpus-realism-private-kb-gap-audit-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, reviewer-risk audit, and README.

Reason: The motivating frame is evolving private knowledge bases, but the current corpus is QASPER/arXiv. The project needed a fail-closed artifact that says exactly what the current data proves and what it does not, instead of relying on prose caveats.

Result: The audit passes the current setup as a public, dated, domain-specific QASPER/arXiv proxy with trusted arXiv API dates for all 77 final-holdout papers, answerable/abstention supervision, and counterfactual insufficiency cases. It explicitly fails private-enterprise KB proof, mutable access-controlled KB modeling, and WriteBack-memory baseline coverage. It lists the requirements for a future private-KB upgrade: immutable snapshots, timestamped provenance, natural stale/missing-evidence cases, snapshot-specific retrieval packs, leak-safe write-back provenance, and no committed private data. This makes zero OpenAI calls, launches no GPU jobs, and records no spend.

Tradeoff: This improves reviewer honesty but narrows the current claim. Until a versioned private or enterprise-like corpus exists, the manuscript must claim an evolving public domain-KB proxy, not proof over private enterprise KBs.

### D139. Fixture-test the Qwen 3B result integration decision logic

Decision: Add `grounded-qa-distillation-qwen3b-integration-fixture-audit.mjs`, materialize `qwen3b-integration-fixture-audit-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, reviewer-risk audit, and README.

Reason: The post-smoke integration gate will decide whether the future Qwen 3B result is negative, minimum-positive, or strong-positive before the Pareto table and manuscript are updated. That classification logic needed a no-spend regression test before real paid artifacts exist.

Result: The audit creates temporary local synthetic prediction and judge runs for three cases, runs the production `grounded-qa-distillation-qwen3b-result-integration.mjs` script, verifies the expected statuses, and deletes the temporary fixture directories. It confirms `qwen3b_negative_ready_for_pareto_update`, `qwen3b_minimum_positive_ready_for_pareto_update`, and `qwen3b_strong_positive_ready_for_pareto_update` are all classified correctly. This makes zero OpenAI calls, launches no GPU jobs, and records no spend.

Tradeoff: This is not model evidence and does not reduce the need for real Qwen 3B predictions or a paid grounded-correctness judge. It reduces post-run interpretation risk once those artifacts exist.

### D140. Add a remote provenance gate for the Qwen 3B smoke

Decision: Add `grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs`, materialize `qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1`, validate it, and wire it into the final-evidence checklist, manuscript evidence map, reviewer-risk audit, and README.

Reason: After the paid GPU run exists, core prediction files alone will not be sufficient paper evidence. The project needs provider and environment provenance before the Qwen result can be judged or used in Pareto/manuscript claims: Prime pod status, remote environment/GPU metadata, pod-side bootstrap manifest, and the bounded smoke manifest.

Result: The current gate is fail-closed with `waiting_for_smoke_artifacts`, because Prime auth remains unauthorized and no bounded Qwen 3B smoke has run. The final checklist now includes `remote_provenance_ready` and the execution sequence requires this gate before any paid judge or Pareto update. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

Tradeoff: This adds one more blocker before the paid judge, but it prevents a non-reproducible remote run from being treated as paper-grade evidence. It is not model evidence and does not repair Prime auth.

### D141. Prototype a versioned domain-KB extension from git document snapshots

Decision: Add `grounded-qa-distillation-versioned-private-kb-prototype.mjs`, materialize `versioned-private-kb-prototype-git-docs-2026-06-26-v1`, validate it, and wire it into the corpus-realism audit, manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The motivating claim is evolving private knowledge bases, while the current core benchmark is still a public QASPER/arXiv proxy. The project needed a concrete, no-spend path from prose caveat to a versioned domain-KB artifact. Repository-local product and architecture docs have immutable git history, real update times, and domain-specific operational content, so they can prototype snapshot-aware evidence packs and stale-snapshot abstentions without committing secrets or spending budget.

Result: The prototype emits 30 deterministic examples from two immutable git snapshots: 6 stable grounded-answer examples, 12 eval-update grounded-answer examples, and 12 stale train-snapshot abstention examples with line-level citation ids. The corpus-realism audit now records this as a versioned domain-KB extension candidate, while preserving `supports_private_enterprise_kb_claim=false`. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

Tradeoff: The examples are deterministic line-level probes over repo docs, not natural user questions and not private-enterprise proof. This improves the upgrade path and reviewer defensibility but does not replace the QASPER/arXiv result, the missing Qwen 3B smoke, or a licensed/private corpus with access-control semantics.

### D142. Evaluate stale-snapshot behavior on the versioned git-doc KB prototype

Decision: Add `grounded-qa-distillation-versioned-private-kb-eval.mjs`, materialize `versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The versioned git-doc prototype should not just be a dataset artifact; it should demonstrate the evolving-KB failure mode the paper cares about. A naive citation-copy system can produce well-formed citations while answering stale train-snapshot questions from old or neighboring evidence. The evaluator makes that failure measurable without LLM calls or GPU spend.

Result: The naive copy-first-evidence baseline reaches 100.0% inline citation rate but only 50.0% overall correctness and 0.0% correctness on stale-snapshot abstention cases. A snapshot-aware prefix retriever reaches 100.0% correctness on the deterministic 30-example slice by answering stable/update lines and abstaining on stale train-snapshot queries. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

Tradeoff: This is a deterministic diagnostic over generated line-level questions, not a natural private-KB benchmark or trained-student result. It strengthens the evolving-snapshot argument and claim-boundary discipline, but the Qwen 3B smoke plus paid grounded judge remain the paper-critical blockers.

### D143. Add a leak-safe WriteBack diagnostic on the versioned KB prototype

Decision: Add `grounded-qa-distillation-versioned-kb-writeback-diagnostic.mjs`, materialize `versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, validate it, and wire it into the WriteBack scope artifact, manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: WriteBack-RAG-style memory is a close amortization neighbor. The prior scoping artifact correctly rejected a full QASPER WriteBack baseline because final-window memory would leak evaluation facts, but the new versioned git-doc snapshots make a small leak-safe diagnostic feasible: records can be written only from the train snapshot, then compared against live-snapshot retrieval and an intentionally leaky eval-written upper bound.

Result: Leak-safe train-only write-back reaches 60.0% overall correctness by answering stable facts and abstaining on stale train-snapshot requests, but it has 0.0% correctness on eval-update questions. Train write-back plus live snapshot evidence reaches 100.0% correctness on the deterministic 30-example slice. The leaky eval-written upper bound answers 100.0% of stale-snapshot queries with 0.0% correctness, showing why write-back records need snapshot provenance. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

Tradeoff: This is a deterministic toy diagnostic over repository docs, not a full natural QASPER/private-KB WriteBack baseline and not a trained-student result. It strengthens the related-work boundary and leakage argument while keeping the Qwen 3B smoke plus paid grounded judge as the paper-critical blockers.

### D144. Add a naturalness audit for the versioned git-doc KB prototype

Decision: Add `grounded-qa-distillation-versioned-kb-naturalness-audit.mjs`, materialize `versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1`, validate it, and wire it into the corpus-realism audit, manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The versioned git-doc prototype usefully tests immutable snapshots, stale abstentions, line citations, and leak-safe WriteBack behavior, but it could still be overclaimed as a natural private/domain-KB benchmark. A paper-grade benchmark needs natural questions, independent question provenance, snapshot-specific retrieval packs, and private or enterprise-like semantics before carrying that claim.

Result: The audit records `natural_benchmark_gap_measured`: immutable snapshots, stale-snapshot abstentions, and line citations pass, but naturalness fails. 100.0% of questions use deterministic template wording, 100.0% quote the target evidence prefix, 80.0% expose train/eval snapshot labels, and 0.0% require synthesis beyond copying one line. The audit lists the exact upgrade artifacts needed before claiming a natural versioned-KB benchmark. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8931`.

Tradeoff: This narrows the current claim but improves reviewer defensibility. The git-doc artifact remains a deterministic snapshot diagnostic and upgrade path, not a natural private-KB benchmark or a replacement for the missing Qwen 3B trained-student result.

### D145. Run a ledgered natural-question probe for the versioned KB prototype

Decision: Add `grounded-qa-distillation-versioned-kb-natural-question-generator.mjs`, run `versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2`, validate it, and wire it into corpus realism, manuscript evidence, reviewer risk, and README.

Reason: D144 showed that the git-doc prototype was useful but unnatural: deterministic template wording, quoted target-prefix leakage, and snapshot-label exposure. A small question-authoring run can test whether the benchmark can move toward natural user questions while keeping answers, citations, and abstentions tied to deterministic snapshot evidence rather than using an LLM as a ground-truth labeler.

Result: The retained v2 packet rewrites all 30 questions with one `gpt-4o-mini` call costing `$0.0016065`. Template wording falls from 100.0% to 0.0%, snapshot-label exposure falls from 80.0% to 0.0%, and prefix leakage falls from 100.0% to 3.3%. One earlier discarded prompt attempt cost `$0.0016791` and remains in the LLM ledger, so total tracked OpenAI spend is now `$5.8963856` with `$94.1036144` remaining under the `$100` cap.

Tradeoff: This is benchmark-construction evidence, not trained-student evidence. It improves natural question wording over the deterministic prototype, but it still lacks independent user-question provenance, retrieval-built evidence packs, private/enterprise semantics, and the Qwen 3B trained-student result.

### D146. Try Hugging Face Jobs as the Qwen 3B smoke fallback

Decision: Record `joint-action-launch-plan-huggingface-qwen3b-smoke-v2`, attempt the bounded Qwen 3B smoke on Hugging Face Jobs, and materialize `huggingface-qwen3b-smoke-launch-attempt-2026-06-26-v1`.

Reason: Prime auth is still unauthorized, but Hugging Face account discovery succeeds as `rprendergast`. The paper-critical blocker is the actual Qwen 3B trained-student smoke, so the next best path was a bounded alternate backend using the already preflighted packet and exact pushed commit, while preserving the `$100` total budget cap.

Result: The HF plan records an `a10g-large` two-hour estimate of `$3` with zero actual cost. Job creation failed before any backend job was created: Hugging Face returned `403 Forbidden` because the active token is missing `job.write` permission for namespace `rprendergast`. This incurred `$0` external compute spend. Current actual spend remains `$5.8963856`, with `$94.1036144` remaining under the cap.

Tradeoff: This did not produce model predictions, but it sharpened the backend diagnosis. The current HF blocker is token permission, not proven insufficient balance; the Prime blocker remains unauthorized API key. The Qwen 3B smoke and paid grounded judge remain the two paper-readiness blockers.

### D147. Add a backend-agnostic Qwen 3B launch gate

Decision: Add `grounded-qa-distillation-remote-backend-readiness-gate.mjs`, materialize `remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1`, and wire it into the final evidence checklist, reviewer-risk audit, README, and validator.

Reason: The final evidence checklist previously depended on the Prime-only auth/price gate even though Hugging Face Jobs is now a plausible fallback backend. The paper-critical Qwen 3B smoke should have one current, fail-closed launch predicate that combines current budget, Prime auth/live-price evidence, HF auth/permission evidence, and the `$100` cap before any paid compute can start.

Result: The gate makes no model calls and creates no pods/jobs. It reports `remote_backend_blocked`: current tracked spend is `$5.8963856`, Prime CLI auth still fails with `API key unauthorized`, Hugging Face CLI auth passes as `rprendergast`, and the latest HF Jobs attempt still proves missing `job.write` permission. If either backend auth is repaired, both the Prime estimate (`$10.3635506` total with judge) and HF estimate (`$9.3635506` total with judge) remain under the `$100` cap.

Tradeoff: This is operational evidence, not model evidence. It improves launch safety and diagnosis, but the Qwen 3B trained-student predictions and paid grounded-correctness judge remain required before paper-ready claims.

### D148. Run a local Qwen 3B base-model control before spending GPU budget

Decision: Add `grounded-qa-distillation-local-qwen3b-base-control.py`, materialize `local-qwen3b-base-control-joint-action-12-v1`, validate it, and fold it into `model-scale-adequacy-audit-2026-06-26-v1`.

Reason: Prime and Hugging Face remote execution are still auth/permission blocked, but the user asked whether the current models are too small and whether we need GPU rental or cutting-edge models. The existing local probe only showed that Qwen 3B training is impractical on the Mac; it did not show whether Qwen 3B base inference can follow the joint-action evidence/JSON/citation contract before LoRA training.

Result: Local MPS inference for `Qwen/Qwen2.5-3B-Instruct` completed on 12 future-window prompts in 150.1 seconds, about 12.5 seconds/example, with zero OpenAI calls and zero external compute spend. The base model answered 83.3% of prompts and reached 75.0% answer-type accuracy, but only 40.0% citation precision, 71.4% citation recall, 15.0% inline citation rate, and 83.3% valid JSON. The regenerated model-scale audit therefore keeps the bounded Qwen 3B joint-action LoRA smoke as the minimum credible next trained-student experiment and still rejects jumping directly to an open-ended cutting-edge GPU run.

Tradeoff: This is base-model contract evidence, not trained-student evidence and not grounded-judge evidence. It reduces uncertainty about scale and local inference viability, but the paper remains blocked on remote auth, the trained Qwen 3B smoke artifacts, and the paid grounded-correctness judge.

### D149. Add a zero-call citation-repair control for the local Qwen 3B base run

Decision: Add `grounded-qa-distillation-local-qwen3b-citation-repair.mjs`, materialize `local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1`, validate it, and fold it into the model-scale audit, manuscript evidence map, reviewer-risk audit, and README.

Reason: D148 showed weak inline-citation behavior from the local Qwen 3B base model. Before treating that as a model-scale problem, the project needed to separate cheap syntax repair from grounded correctness. If deterministic post-processing can make citations look compliant while leaving support unchanged, the paper should explicitly avoid citing syntax metrics as evidence of grounded correctness.

Result: The zero-call repair changed 9 of 12 rows, appended 13 missing inline citation ids, and raised inline citation rate from 15.0% to 100.0%. It did not change answer type, cited evidence ids, citation precision, citation recall, or support risk; citation precision remains 40.0%, citation recall remains 71.4%, answer-type accuracy remains 75.0%, and answer F1 remains weak. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a useful negative control, not a model improvement. It strengthens the manuscript claim discipline around citation formatting versus support, but the trained Qwen 3B joint-action smoke and paid grounded-correctness judge remain required before any support-preserving distillation claim.

### D150. Fixture-test that perfect citation syntax cannot pass the Qwen integration gate

Decision: Add `grounded-qa-distillation-qwen3b-syntax-only-rejection-audit.mjs`, materialize `qwen3b-syntax-only-rejection-audit-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, reviewer-risk audit, and README.

Reason: D149 proved deterministic repair can raise inline citation rate to 100.0% without improving support. The post-smoke integration gate therefore needs an explicit regression test that perfect citation syntax is insufficient for a positive Qwen result. Otherwise, future manuscript updates could accidentally treat citation formatting as grounded correctness.

Result: The audit creates temporary local prediction and judge fixtures from the repaired local Qwen 3B base-control metrics, sets inline citation rate to 100.0% while keeping synthetic support/correctness weak, invokes the production `grounded-qa-distillation-qwen3b-result-integration.mjs`, observes `qwen3b_negative_ready_for_pareto_update`, and deletes the temporary fixture directories. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a gate-logic test, not a real judge result. It strengthens failure-mode discipline before the paid Qwen run, but it does not replace the trained Qwen 3B smoke or grounded-correctness judge.

### D151. Gate local Qwen controls away from final trained-smoke evidence

Decision: Add `grounded-qa-distillation-qwen3b-local-control-non-substitution-audit.mjs`, materialize `qwen3b-local-control-non-substitution-audit-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, reviewer-risk audit, final evidence checklist, and README.

Reason: The local Qwen 3B base-control and deterministic citation-repair outputs are useful negative controls, but they have prediction artifacts that could be mistaken for the missing trained joint-action smoke if future updates only check for `predictions.jsonl` and `result.json`. The harness needs an explicit regression test proving those local controls cannot satisfy the final-smoke evidence contract.

Result: The audit invokes the production prediction-integrity and remote-provenance gates against both local control runs in temporary directories, observes `refuse_paid_judge_prediction_integrity_failed` and `waiting_for_smoke_artifacts`, then deletes the temporary directories. Both controls are rejected because they lack the canonical final smoke run id, trained adapter, full 69-example final window, smoke manifest, Prime pod status, remote environment, and remote bootstrap manifest. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is evidence-boundary hardening, not new model performance. It reduces the risk of overclaiming local control artifacts while keeping the project blocked on remote backend auth, the trained Qwen 3B smoke, and the paid grounded-correctness judge.

### D152. Evaluate the natural-question versioned-KB diagnostic

Decision: Add `grounded-qa-distillation-versioned-kb-natural-question-eval.mjs`, materialize `versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2`, validate it, and wire it into the corpus-realism audit, manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: D145 made the git-doc versioned-KB questions more natural, but the existing eval still relied on quoted target-prefix questions. The project needed to verify that the evolving-KB stale-snapshot failure mode survives after template/prefix leakage is removed.

Result: The zero-call eval shows naive copy-first-evidence still has perfect inline citation syntax but only 50.0% overall correctness and 0.0% correctness on stale train-snapshot abstentions. A snapshot-aware copy baseline reaches 90.0% overall correctness, and a lexical snapshot-aware retriever reaches 96.7% overall correctness with 100.0% stale-snapshot abstention correctness and one stable-question retrieval miss. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This strengthens the evolving-KB diagnostic after natural-question rewriting, but it is still a 30-example repository-doc snapshot diagnostic. It does not prove private-enterprise KB behavior, replace a natural independently sourced benchmark, or unblock the trained Qwen 3B smoke and paid grounded-correctness judge.

### D153. Taxonomize model-judge disagreements for manuscript constraints

Decision: Add `grounded-qa-distillation-judge-disagreement-taxonomy.mjs`, materialize `judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The blind second-pass judge result gave an overall agreement rate, but the manuscript needs to explain what the disagreements are before using model-judged support/correctness as evidence. A single agreement number hides whether disagreements are mostly answer-support failures, abstention-boundary cases, or partial-support granularity.

Result: The zero-call taxonomy joins the already-paid second-pass results to the adjudication packet and classifies 10 disagreements among 42 compared hard cases: 6 abstention-boundary reversals, 2 partial-vs-supported granularity reversals, and 2 unsupported-to-supported reversals. It adds manuscript constraints requiring model-judged wording, disagreement reporting, and no claim that abstention-boundary calibration is solved. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This improves transparency around judge reliability but does not replace human adjudication. It supports using the current judge as a screening signal, not as human-validated correctness, and the trained Qwen 3B smoke plus paid final judge remain required.

### D154. Make Qwen amortization break-even explicit before spending GPU budget

Decision: Add `grounded-qa-distillation-amortization-break-even.mjs`, materialize `amortization-break-even-qwen3b-2026-06-26-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, final evidence checklist, and README.

Reason: The project claim is amortized grounded QA, but the current Pareto artifact only reported online calls/query. Before renting GPU time, the paper needs explicit accounting for how the planned offline Qwen 3B smoke plus judge cost pays back against repeated API baselines, while preserving the boundary that economics are not evidence of grounded correctness.

Result: The zero-call artifact reads the local LLM ledger and existing Qwen plans. It records `$4.467165` planned offline investment for GPU plus judge, `$5.8963856` current actual spend, and `$10.3635506` estimated total after the Qwen smoke and judge, still under the `$100` cap. Against observed ledger costs, the planned offline investment breaks even after about 15,242 future queries versus the direct `gpt-4o-mini` student, 972 queries versus the direct `gpt-4o` teacher, and 447 queries versus the repaired multi-step teacher slice. This made zero OpenAI calls, launched no GPU jobs, and records no new spend.

Tradeoff: This strengthens the amortization argument and budget discipline, but it is not quality evidence. The trained Qwen 3B smoke, remote provenance, dry judge, paid grounded-correctness judge, Pareto-table update, and novelty refresh still remain required before any paper-ready or NeurIPS-ready claim.

### D155. Refresh novelty pressure around compact agentic RAG and faithful context QA

Decision: Refresh `grounded-qa-distillation-novelty-watchlist.mjs`, regenerate `novelty-watchlist-2026-06-26-v1`, update `RELATED_WORK_NOTES.md`, and propagate the refreshed watchlist through paper readiness, manuscript, reviewer-risk, and final checklist artifacts.

Reason: The goal requires an internet/paper novelty check before any conference-ready claim, and the June 27 search surfaced closer neighbors than the prior watchlist captured: ACL 2026 DGPO for compact agentic-RAG distillation, ICLR 2026 InfoSeek for deep-research data synthesis, EACL 2026 DeepSieve for agentic knowledge routing, OCC-RAG for compact faithful context QA with citations and abstention, AgenticRAG for enterprise knowledge bases, and a distillation-loss accounting paper.

Result: The watchlist now tracks 19 close neighbors and records the new claim boundaries: do not claim compact agentic-RAG transfer, deep-research data synthesis, compact faithful-context-QA specialization, enterprise agentic RAG, or generic evidence-distillation amortization as new. The required paper framing now includes a distillation-loss statement covering answer support, citation support, abstention boundaries, update robustness, coverage, and cost. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This makes the novelty path narrower and more defensible, but it increases the comparison burden. The trained Qwen 3B smoke and paid grounded-correctness judge are still required, and any final submission claim still needs a last novelty refresh at submission time.

### D156. Add distillation-loss accounting before interpreting Qwen results

Decision: Add `grounded-qa-distillation-distillation-loss-accounting.mjs`, materialize `distillation-loss-accounting-2026-06-27-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, final evidence checklist, and README.

Reason: The refreshed novelty watchlist added a concrete requirement from nearby distillation work: a distillation paper must state what capability is preserved and what is lost. The current project could otherwise overclaim because cheap systems can preserve citation syntax or zero-call inference while losing answer support, or preserve support by losing answer coverage.

Result: The zero-cost artifact creates preservation/loss rows for the direct mini repair baseline, claim-entailment guard, zero-call span scaffold, local Qwen 0.5B SFT, final-window risk gate, local Qwen 3B base control, and citation-repaired Qwen 3B control. It sets the final Qwen acceptance contract: answer support, judged correctness, answer rate above 70%, citation support/recall, abstention-boundary caveats, and amortized cost must be reported together. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This strengthens claim discipline and the eventual result table, but it is not a substitute for the trained Qwen 3B smoke or paid grounded-correctness judge. After the real Qwen run, this artifact must be regenerated with the actual trained-student row.

### D157. Add compact faithful-context-QA positioning

Decision: Add `grounded-qa-distillation-faithful-context-qa-comparison.mjs`, materialize `faithful-context-qa-comparison-2026-06-27-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The refreshed novelty watchlist flags OCC-RAG-style compact faithful context QA as a very close final-system baseline family: compact model, context-grounded answers, citations, and safe abstention. Without an explicit comparison artifact, the paper could appear to be claiming novelty on that broader surface rather than on evolving-KB amortization and support/cost preservation.

Result: The zero-cost artifact reads the novelty watchlist, LongCite comparison, Pareto table, distillation-loss accounting, and model-scale audit. It compares current systems across compact evidence-pack QA, judged faithfulness, citation grounding, safe abstention, evolving/update-heldout evaluation, and amortized inference cost. It records the claim boundary: do not claim first compact faithful-context-QA model; a true OCC-RAG-like baseline would need to run on the same compact evidence packs and dated/versioned KB windows with the same answer-support, abstention-support, citation-recall, coverage, and cost metrics. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is related-work positioning, not a true OCC-RAG reproduction. It reduces novelty overclaim risk but adds a potential future baseline if reviewer pressure remains high.

### D158. Add citation-grounding and compact-memory novelty pressure

Decision: Refresh `grounded-qa-distillation-novelty-watchlist.mjs` and `RELATED_WORK_NOTES.md` with three additional 2026 primary-source neighbors: citation-enforced fiscal RAG, legal citation-grounding metrics with temporal validity, and FD-RAG compact QA memories.

Reason: The project's target surface includes citations, conservative abstention, private/domain knowledge, and amortized lower-cost inference. These papers add pressure on exactly those axes: high-stakes citation-enforced RAG, citation grounding as existence/relevance/temporality rather than syntax, and memory-side amortization for fragmented/private RAG.

Result: The watchlist now requires the paper to avoid claiming first citation-enforced domain RAG, first citation-grounding metric, or first compact-memory amortization method. The novelty boundary is narrower: the final claim must be update-heldout model/scaffold-side amortization with answer support, citation support/recall, abstention support, temporal/update validity, coverage, and cost reported together. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This increases the related-work burden and may require an additional memory-side baseline or a scoped non-comparability argument. It improves submission honesty but does not replace the missing trained Qwen 3B smoke or paid grounded-correctness judge.

### D159. Add citation-grounding and compact-memory comparison artifact

Decision: Add `grounded-qa-distillation-citation-grounding-memory-comparison.mjs`, materialize `citation-grounding-memory-comparison-2026-06-27-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: D158 added citation-enforced domain RAG, citation-grounding metrics, and FD-RAG compact QA memories as close novelty pressure, but the paper needed an executable artifact that separates what those neighbors threaten: citation existence, citation support/relevance, temporal validity, and memory-side amortization.

Result: The zero-cost comparison reads existing local artifacts and records the claim boundary: do not claim first citation-enforced RAG, first citation-grounding metric, or first compact-memory amortization method. It uses existing syntax-repair controls, support guards, versioned stale-snapshot diagnostics, and write-back diagnostics to show why inline citation syntax is not support and why compact memory remains a competing amortization path. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is positioning and scoped non-comparability evidence, not a true FD-RAG or legal citation-graph reproduction. If reviewer pressure remains high after the Qwen 3B result, the paper may still need a compact-memory baseline or domain-graph citation-grounding metric on the final update-heldout window.

### D160. Add a fail-closed final-claim acceptance matrix

Decision: Add `grounded-qa-distillation-final-claim-acceptance-matrix.mjs`, materialize `final-claim-acceptance-matrix-2026-06-27-v1`, validate it, and wire it into the manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: The acceptance target for a NeurIPS-grade paper had become distributed across the readiness gate, final checklist, Qwen integration gate, distillation-loss accounting, citation-grounding comparison, Pareto table, and novelty watchlist. A final paper claim needs one executable matrix that says exactly which evidence must exist before support-preserving amortized distillation can be claimed.

Result: The zero-cost matrix tracks trained student predictions, paid grounded-correctness judging, answer support, coverage, citation support versus syntax, temporal/update validity, amortized cost, remote reproducibility, judge caveats, novelty boundaries, and paper-readiness. It currently reports `final_claim_blocked`, with blocking failures including missing trained Qwen predictions, missing paid Qwen judge, missing support/coverage/citation/temporal/cost/provenance evidence, and a non-green paper-readiness gate. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This does not create the missing Qwen result; it makes the required evidence harder to overclaim. After remote auth is repaired and Qwen runs, this matrix must be regenerated and must turn green before any conference-ready claim.

### D161. Treat the current Prime blocker as unauthorized-key evidence only

Decision: Refresh the Prime CLI auth recheck as `prime-cli-auth-recheck-2026-06-27-v1`, patch validation to accept current-key rechecks, and regenerate the Prime auth/price gate plus backend readiness gate before any GPU launch.

Reason: The user asked whether Prime is blocked by a missing key, expired/bad key, or insufficient account funds. The installed Prime CLI and config are present, and the config contains a saved key and team context, but `prime whoami`, `prime teams list`, `prime availability list`, `prime wallet`, and GPU availability probes all fail before account lookup with `API key unauthorized`. A secure hidden-input refresh prompt was opened but no new key was entered, so the local key remains unchanged. Because authentication fails first, Prime balance, team billing, and live GPU pricing are not proven.

Result: The refreshed zero-cost recheck reports `auth_blocked_current_key` on Prime CLI `0.6.15`. The backend gate remains `remote_backend_blocked`: total actual spend is `$5.8963856`, external compute spend is `$0`, Prime auth/live pricing fails, Hugging Face CLI auth passes, and HF Jobs remains blocked by missing `job.write`. No OpenAI calls, pods, jobs, or GPU spend were made.

Tradeoff: This does not unblock Qwen 3B training. It prevents a bad operational conclusion: the current evidence supports "stored Prime key unauthorized" and does not support "Prime account has insufficient funds." The next paid step remains installing a valid Prime key through the hidden-input helper, rerunning the auth/price gate, and launching the bounded smoke only if the total estimated spend remains under `$100`.

### D162. Treat selection-only candidate routing as insufficient for the final target

Decision: Add `grounded-qa-distillation-candidate-pool-oracle.mjs` and materialize `candidate-pool-oracle-final-window-2026-06-27-v1` over the already-judged 69-example final window.

Reason: The current best zero-call systems improve judged correctness mostly by suppressing unsupported answers. Before spending GPU budget, the project needs to know whether a better selector over existing direct/gate/guard candidates could satisfy the final support-preserving coverage target, or whether the Qwen 3B run must learn answer repair/regeneration.

Result: The zero-cost oracle selects a supported answer whenever any current candidate has one, otherwise selects a correct abstention when available. It reaches 76.1% answer support and 84.1% overall judged correctness, but answers only 46 of 69 examples, a 66.7% answer rate. That misses the 70% answer-rate acceptance target even under oracle selection. The current candidate pool has 34 examples with no supported answer candidate.

Tradeoff: This is not deployable because it uses already-paid judge labels as an oracle. Its value is as a negative upper bound: selection-only training over current direct/gate/guard outputs is unlikely to satisfy the paper claim. The Qwen 3B joint-action data should continue to emphasize repair/regeneration versus abstention, not only routing among existing answers.

### D163. Audit repair/regeneration signal before spending GPU budget

Decision: Add `grounded-qa-distillation-repair-regeneration-signal-audit.mjs`, materialize `repair-regeneration-signal-audit-joint-action-qwen3b-2026-06-27-v1`, and validate it as a zero-cost launch-relevance check for the Qwen 3B joint-action packet.

Reason: D162 showed that selection-only routing over existing candidates cannot meet the final 70% answer-rate target while preserving answer support. Before spending Prime/HF GPU budget, the project needed to check whether the current packet actually gives Qwen enough explicit repair/regeneration supervision, or whether the next no-spend action should be data repair instead of remote execution.

Result: The audit passes all checks. The packet has 41 train DPO `prefer_reference_repair_over_unsupported_answer` rows and 15 validation repair rows, compared with the oracle's 34 final-window examples that have no supported-answer candidate. It also has abstention contrasts in train and validation, valid inline citations in grounded chosen outputs, no invalid chosen citation ids, no identical chosen/rejected answer-text repair rows, SFT rows for supported answers, repair, and abstention, and no train/eval or validation/eval paper overlap. This makes zero OpenAI calls, launches no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a data-signal audit, not model evidence. It supports running the bounded Qwen 3B smoke once remote auth is repaired and argues against adding more selection-only routing labels first. It does not prove that Qwen will learn repair/regeneration, meet the 70% answer-rate target, or pass the paid grounded-correctness judge.

### D164. Refresh backend readiness against current Prime auth evidence

Decision: Patch `grounded-qa-distillation-remote-backend-readiness-gate.mjs` to accept and record explicit input run ids, default its Prime input to `prime-auth-price-gate-current-2026-06-27-v1`, regenerate `remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1`, and validate that remote backend gates expose their input artifacts.

Reason: After the current Prime diagnostic, the backend-agnostic gate still hard-coded the older Prime auth/price gate. The result was directionally correct, but the executable launch predicate should not silently use stale auth evidence before a paid GPU run.

Result: The refreshed gate remains `remote_backend_blocked`. It proves the budget is not the blocker: actual spend is `$5.8963856`, external compute spend is `$0`, and the estimated total after bounded Qwen smoke plus judge is `$10.3635506` via Prime or `$9.3635506` via Hugging Face. Prime is blocked because `prime --plain whoami` returns `API key unauthorized`; Hugging Face Jobs is blocked because the active token lacks `job.write`. The gate makes zero OpenAI calls, creates no pods or jobs, and records no new spend.

Tradeoff: This still does not produce the trained Qwen 3B predictions. It prevents a stale-gate launch mistake and narrows the blocker to backend credentials/permissions while preserving the bounded spend path once auth is repaired.

### D165. Add a fail-closed Prime smoke entrypoint before pod creation

Decision: Add `grounded-qa-distillation-prime-guarded-smoke-entrypoint.mjs`, materialize `prime-guarded-smoke-entrypoint-2026-06-27-v1`, and validate it as the local launch predicate for the Prime Qwen 3B smoke.

Reason: The Prime runbook, backend gate, auth/price gate, packet audit, and repair-signal audit were all present, but pod creation still required a human or agent to mentally join them before running a paid command. The next paid action should have a single fail-closed predicate that refuses unless the current backend, Prime auth/price, budget, runbook, packet, and repair-signal checks are all green and `execute=true` is explicit.

Result: The current dry-run artifact correctly refuses pod creation with status `refuse_prime_pod_creation`. It passes budget, projected Prime spend, runbook, repair-signal, and packet checks, but fails `remote_gate_prime_ready`, `prime_auth_price_gate_ready`, and `prime_cli_authenticated_now`. The projected Prime path remains under budget at `$10.3635506` total after smoke plus judge. This makes zero OpenAI calls, creates no pod, launches no GPU job, and leaves actual spend at `$5.8963856`.

Tradeoff: This is launch-safety infrastructure, not model evidence. It reduces the risk of spending GPU money before the gates are green, but the project still needs valid Prime credentials or an HF Jobs token with `job.write`, the actual trained Qwen 3B predictions, and the paid grounded-correctness judge.

### D166. Add a fail-closed Hugging Face Jobs smoke entrypoint

Decision: Add `grounded-qa-distillation-hf-guarded-smoke-entrypoint.mjs`, materialize `hf-guarded-smoke-entrypoint-2026-06-27-v1`, and validate it as the local launch predicate for the Hugging Face Jobs Qwen 3B smoke fallback.

Reason: Prime now has a single fail-closed pod-creation predicate, but Hugging Face Jobs remained a separate fallback path with only a launch plan and a failed permission attempt. Since HF is the other bounded backend under the `$100` cap, it needs the same explicit refusal behavior before any future job creation.

Result: The current dry-run artifact correctly refuses HF job creation with status `refuse_hf_job_creation`. It passes budget, projected HF spend, CLI auth, Jobs CLI availability, launch-plan, repair-signal, and packet checks, but fails `remote_gate_hf_ready` and `hf_job_write_permission_proven` because the latest HF attempt failed before creation with missing `job.write`. The projected HF path remains under budget at `$9.3635506` total after smoke plus judge. This makes zero OpenAI calls, creates no HF job, launches no GPU job, and leaves actual spend at `$5.8963856`.

Tradeoff: This is launch-safety infrastructure, not model evidence. It preserves the HF fallback path while preventing accidental job creation until permission/billing evidence is green; the trained Qwen 3B predictions and paid grounded-correctness judge remain missing.

### D167. Refresh citation/faithfulness novelty pressure

Decision: Refresh `grounded-qa-distillation-novelty-watchlist.mjs`, materialize `novelty-watchlist-2026-06-27-v2`, and update `RELATED_WORK_NOTES.md` plus the README with four additional close neighbors: QDRAG / Faithful in Steps, CiteRAG, faithfulness-aware context ranking, and Generate but Verify.

Reason: The prior watchlist already narrowed claims around compact agentic RAG, faithful context QA, enterprise KB RAG, citation grounding, and compact memory amortization. A fresh citation/faithfulness search surfaced additional pressure directly on citation RAG and verifier/ranking machinery. Those papers threaten any broad claim that citation improvement, answer verification, or faithfulness-aware context selection is novel.

Result: The v2 watchlist now tracks 26 close neighbors and adds claim boundaries: do not claim first query-decomposition or reranking method for citation RAG, first RAG benchmark for scientific/academic citation tasks, or first generate-then-verify / faithfulness-aware ranking strategy for RAG QA. Required paper framing now includes positioning query-decomposition citation RAG and faithfulness-aware ranking as retrieval-side competing strategies, separating answer-support citations from academic citation prediction, and explaining verification as teacher/filtering machinery rather than the final amortized system. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This makes the novelty path narrower. It strengthens submission discipline but adds reviewer-facing comparison burden after the trained Qwen result exists.

### D168. Add citation-faithfulness neighbor comparison

Decision: Add `grounded-qa-distillation-citation-faithfulness-neighbor-comparison.mjs`, materialize `citation-faithfulness-neighbor-comparison-2026-06-27-v1`, and validate it as a zero-cost positioning artifact for QDRAG/Faithful in Steps, CiteRAG, faithfulness-aware context ranking, and Generate but Verify.

Reason: D167 added those works to the watchlist, but the paper needs an executable artifact that translates the threat into concrete claim boundaries and post-Qwen comparison requirements. Otherwise the watchlist could remain a passive bibliography rather than affecting what the result must prove.

Result: The artifact records that retrieval-side decomposition/ranking, academic citation prediction, and generate-then-verify pipelines are not the contribution. It uses the candidate-pool oracle to show why selection-only verification is coverage-limited: even oracle selection over current candidates answers only 46/69 examples, below the 70% target. It uses the repair-signal audit to justify that Qwen 3B must be evaluated for generation/repair beyond verification. It requires any generate-then-verify comparison to report online verification cost separately from amortized student/scaffold cost. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is still positioning, not an implemented QDRAG or faithfulness-ranking baseline. If the trained Qwen result is promising, reviewer pressure may require a retrieval-side decomposition/ranking baseline on the same final window.

### D169. Refresh paper-facing artifacts to v2 novelty pressure

Decision: Patch the final-claim matrix, manuscript evidence map, manuscript draft, and reviewer-risk audit to consume `novelty-watchlist-2026-06-27-v2` and `citation-faithfulness-neighbor-comparison-2026-06-27-v1`, then materialize `manuscript-evidence-map-2026-06-27-v2`, `manuscript-draft-2026-06-27-v2`, and `reviewer-risk-audit-2026-06-27-v2`.

Reason: D167-D168 narrowed the novelty boundary around citation-RAG decomposition/ranking, academic citation prediction, faithfulness-aware context ranking, and generate-then-verify QA, but the paper-facing artifacts still read older evidence-map and novelty runs. That could let a stale manuscript or risk audit omit the latest reviewer pressure.

Result: The final-claim matrix now includes `citation_faithfulness_neighbors_positioned` as a pass requirement and still reports `final_claim_blocked` with 9 blocking failures because trained Qwen predictions, paid grounded judging, provenance, support/coverage metrics, cost accounting, and paper readiness remain missing. The v2 evidence map, draft, and reviewer-risk audit now carry the current claim boundary: do not claim first citation-RAG decomposition/ranking, academic citation prediction, faithfulness-aware ranking, generate-then-verify, compact faithful-context QA, citation-grounding metric, compact-memory amortization, or enterprise agentic RAG. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is claim-control and manuscript hygiene, not new model evidence. It keeps the paper artifacts honest while the real blocker remains backend auth for the bounded Qwen 3B smoke and the paid grounded-correctness judge.

### D170. Enforce v2 novelty pressure in readiness gates

Decision: Patch `grounded-qa-distillation-paper-readiness-gate.mjs` to require `novelty-watchlist-2026-06-27-v2` and an explicit `citation_faithfulness_neighbor_positioning` requirement, patch `grounded-qa-distillation-final-evidence-checklist.mjs` to require citation-faithfulness positioning before final claims, and regenerate the readiness/checklist/final-claim/manuscript artifacts.

Reason: The v2 paper artifacts already carried the latest citation-faithfulness related-work pressure, but the executable readiness gate still accepted the older `novelty-watchlist-2026-06-26-v1`, and the final evidence checklist did not independently require the citation-faithfulness comparison. That left a path where stale related-work gates could pass even if the manuscript was stricter.

Result: The readiness gate now reports 11 of 13 requirements passing, with only the trained Qwen 3B smoke result and its paid grounded-correctness judge still failing. The final evidence checklist now treats citation-faithfulness positioning as a passing prerequisite with three post-Qwen requirements, while still failing on backend readiness, Qwen predictions/provenance, dry/paid judge, Pareto update, manuscript regeneration after Qwen, and final submission novelty refresh. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This does not unblock remote execution. It removes another stale-gate loophole and makes the current blocker more precise: the remaining paper-critical work is the bounded Qwen 3B run plus judge under valid backend credentials.

### D171. Add same-window lexical faithfulness-ranking control

Decision: Add `grounded-qa-distillation-faithfulness-ranking-control.mjs`, materialize `faithfulness-ranking-control-final-window-2026-06-27-v1`, validate the new artifact family, and fold the result into the citation-faithfulness comparison, manuscript evidence map, manuscript draft, reviewer-risk audit, and README.

Reason: D167-D170 identified faithfulness-aware context ranking and citation-RAG retrieval-side methods as close related-work pressure. Before spending GPU budget, the project needed a zero-cost same-window control to test whether simple cited-evidence ranking/filtering explains the remaining support gap, or whether the Qwen 3B joint-action packet still needs repair/regeneration rather than another shallow filter.

Result: The control trains a lexical cited-evidence faithfulness threshold on examples 241-320 using existing direct-repair predictions and existing `gpt-4o` support judgments, then applies the fixed threshold to examples 321-389. The selected train threshold is `0.24`, preserving a 73.8% train answer rate and improving train support-oracle correctness by 5 rows. On the final window it makes 0 suppressions: answer rate stays 76.8%, answer support stays 64.2%, inherited support-oracle correctness stays 50/69, and local task metrics are unchanged from direct repair. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a useful negative retrieval-side control, not a full QDRAG or learned faithfulness-ranking baseline. It narrows the explanation space: simple lexical ranking does not replace the trained Qwen repair/regeneration experiment, but a stronger retrieval-side decomposition/ranking baseline may still be needed if the Qwen result is positive and reviewer pressure remains high.

### D172. Audit unsupported direct answers for repairability

Decision: Add `grounded-qa-distillation-unsupported-answer-repairability-audit.mjs`, materialize `unsupported-answer-repairability-audit-final-window-2026-06-27-v1`, validate the artifact family, patch the repair/regeneration signal audit to consume it, regenerate paper-facing artifacts, and record the finding in the README.

Reason: D171 showed that lexical faithfulness ranking does not improve the final window, but that still left an ambiguity: maybe the missing improvement is a better citation-repair/reranking method rather than answer repair/regeneration. The project needed to inspect unsupported direct answers against the existing compact evidence packs and reference labels before spending GPU budget.

Result: The audit inspects the 19 unsupported answered predictions from direct mini plus citation repair on examples 321-389. Only 1 row is classified as a citation-repair candidate. The remaining rows are 12 answer-repair/regeneration-needed cases and 6 should-abstain counterfactual/insufficient-evidence cases. The regenerated repair/regeneration signal audit now includes this as a passing launch-relevance check: unsupported final-window direct failures are mostly not citation-only defects. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: The classification is lexical and reference-informed, not a human adjudication or fresh judge pass. It is strong enough for launch triage and paper-risk framing, but not a final baseline result. The next paper-critical experiment remains the bounded Qwen 3B joint-action smoke plus paid grounded-correctness judge once backend auth is repaired.

### D173. Promote the repair/abstention curriculum packet as the active Qwen smoke input

Decision: Add `grounded-qa-distillation-joint-action-curriculum-packet.mjs`, materialize `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`, make it the default packet for launch/preflight/judge/provenance gates, regenerate the active Prime/HF launch plans and guarded entrypoints, and harden validation around curriculum invariants.

Reason: D172 showed the unsupported final-window failures are mostly answer repair/regeneration or justified abstention cases, not citation-only repair. The original joint-action packet had the right action types, but the next bounded Qwen run should put more train-time weight on exactly those failures before spending GPU budget.

Result: The active packet keeps the source training pool, validation rows, and 69-prompt final eval window unchanged, while oversampling train-time repair/regeneration and abstention rows. It now contains 244 SFT train rows, 59 SFT validation rows, 118 DPO train rows, 21 DPO validation rows, and 69 eval prompts. The regenerated repair-signal audit reports 82 train repair rows and 36 train abstention DPO choices, packet-quality and script-contract audits pass, the preflight reports zero over-limit prompt rows, and the Prime/HF guarded entrypoints still correctly refuse paid execution until backend credentials are repaired. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a curriculum weighting change, not new supervision or model evidence. Duplicate train rows may overfit the bounded smoke, but that is acceptable for the next diagnostic because validation and final eval remain unchanged and paper claims still require real Qwen predictions plus the paid grounded-correctness judge.

### D174. Extend the local Qwen 3B base-control to the full final window

Decision: Run `grounded-qa-distillation-local-qwen3b-base-control.py` over all 69 active final-window prompts as `local-qwen3b-base-control-joint-action-final-window-v2`, repair citation syntax as `local-qwen3b-citation-repair-local-qwen3b-base-control-final-window-v2`, and update the model-scale and local-control non-substitution audits to consume the full-window controls.

Reason: The prior local Qwen 3B base-control covered only 12 prompts. While that was enough to show local inference feasibility, it was too small to support the paper-facing scale decision. The project needs to know whether the untrained 3B base model already solves the compact evidence/citation contract before spending remote GPU budget on LoRA training.

Result: The full-window local base model answers 53 of 69 examples with 76.8% answer rate, but has only 60.9% answer-type accuracy, 45.5% citation precision, 60.8% citation recall, 23.97% answer F1, 21.7% inline citation rate, and 76.8% valid JSON. Deterministic citation repair changes 39 rows and appends 64 missing inline markers, raising inline citation rate to 94.3% while leaving answer type, cited evidence ids, citation precision, citation recall, and support risk unchanged. The non-substitution audit still rejects both full-window controls as final smoke substitutes because they have no trained adapter, no smoke manifest, no remote provenance, and no paid grounded-correctness judge. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is stronger base-model evidence, but it is still not a trained student and it is not support-judged. It justifies the bounded Qwen 3B LoRA smoke over treating base inference or citation-string repair as the final amortized system.

### D175. Make judge reliability a final claim gate

Decision: Add `grounded-qa-distillation-judge-reliability-claim-gate.mjs`, materialize `judge-reliability-claim-gate-2026-06-27-v1`, and wire it into the final evidence checklist, final claim matrix, manuscript evidence map, draft, reviewer-risk audit, README, and validator.

Reason: The existing blind second-pass judge and disagreement taxonomy showed the model judge is useful but not strong enough to support uncaveated correctness claims. Treating that as a narrative caveat was weaker than the rest of the fail-closed paper gates.

Result: The new gate reuses the existing 42-case second-pass result and creates `priority_adjudication.jsonl` with 10 rows: 6 P0 abstention-boundary cases and 4 P1 support-boundary cases. It allows model-judged screening metrics with caveats, but disallows human-validated correctness, uncaveated model-judge correctness, and solved abstention-boundary claims until human or stronger independent adjudication closes the queue. The final checklist now requires `judge_reliability_claim_gate_ready`, and the final claim matrix now requires `judge_reliability_claim_bounded`. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This does not improve model quality or unblock the Qwen 3B smoke. It makes the eventual paper more defensible by preventing the final result from overstating model-judge reliability.

### D176. Convert novelty pressure into a claim-level delta matrix

Decision: Add `grounded-qa-distillation-novelty-delta-matrix.mjs`, materialize `novelty-delta-matrix-2026-06-27-v1`, and wire it into readiness, final evidence, final claim, manuscript, reviewer-risk, README, and validation artifacts.

Reason: The June 2026 novelty watchlist already tracks 26 close neighbors, but a watchlist alone can still leave the manuscript with ambiguous broad claims. The project needs an executable claim matrix that rejects non-novel contribution framings and preserves only the narrow conditional claim that could survive reviewer scrutiny.

Result: The matrix rejects seven broad claim families: generic RAG-to-SLM distillation, citation SFT/grounding metrics, dynamic QA or updated-corpus benchmarking, online agentic RAG training, compact faithful context QA, memory/index/write-back amortization, and retrieval-side faithfulness/generate-then-verify. It leaves exactly one conditional surviving claim: model/scaffold-side amortized grounded QA over update-heldout domain KB states with citation support, abstention support, temporal validity, and cost evidence. The readiness gate now has 14 requirements, with 12 passing and the same 2 paper-critical blockers: Qwen 3B smoke and paid grounded judging. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: The allowed novelty claim is narrower. This reduces overclaiming risk, but it increases the burden on the eventual Qwen 3B result and final novelty refresh.

### D177. Pre-register post-Qwen outcome decisions

Decision: Add `grounded-qa-distillation-qwen3b-outcome-decision-policy.mjs`, materialize `qwen3b-outcome-decision-policy-2026-06-27-v1`, and wire it into the final checklist, final claim matrix, manuscript evidence map, manuscript draft, reviewer-risk audit, README, and validator.

Reason: The Qwen integration script already classifies negative, minimum-positive, and strong-positive outcomes, but without a standalone policy the project could still move goalposts after seeing the paid result. The paper needs to say up front what counts as success, what counts as a negative result, and when a larger GPU/model run is justified.

Result: The policy covers five statuses: waiting for predictions, waiting for paid judge, negative, minimum-positive, and strong-positive. It hard-rejects citation syntax alone, answer-rate collapse below 70%, missing paid grounded judging, and missing provenance/cost as success evidence. It requires a failure-mode audit, budget recheck under `$100`, bounded plan, and decision-log entry before any larger model escalation after a negative Qwen smoke. The final checklist now includes `qwen_outcome_policy_preregistered`. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This makes the eventual Qwen result harder to spin. A negative smoke will need to be reported or audited before escalation, but that is the right standard for a credible paper.

### D178. Bind the smoke cost finalizer to the active curriculum packet

Decision: Regenerate `joint-action-smoke-ledger-finalizer-joint-action-qwen3b-smoke-eval-v1` after the active Qwen packet changed to `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`, and harden the validator so smoke ledger finalizers must target that packet and inspect predictions, result, report, and smoke-manifest artifacts.

Reason: The launch, provenance, integrity, and judge gates now use the curriculum repair/abstain packet, but the existing ledger finalizer artifact still referenced the older support-contrast packet. After a paid GPU run, the actual-cost row must be tied to the same packet that produced the predictions and judge inputs; otherwise cost/provenance evidence could drift from the active experiment.

Result: The refreshed finalizer remains zero-cost and reports `waiting_for_smoke_artifacts` with no ledger row recorded. Its budget gate uses the current `$5.8963856` actual spend and the active curriculum packet. The validator now fails closed if a future finalizer points at a stale packet or omits any required smoke artifact check. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend unchanged.

Tradeoff: This does not unblock Prime auth or create Qwen predictions. It closes an accounting/provenance gap so that once the bounded GPU smoke runs, artifact completeness and actual compute cost are recorded against the correct experimental packet before the paid judge or final paper gates proceed.

### D179. Require remote provenance inside the post-smoke judge pipeline

Decision: Patch `grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs` so the canonical post-smoke path includes `grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs` after prediction integrity and before dry or paid judging. Regenerate `qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1` and harden validation to require the canonical provenance command and run id.

Reason: The final checklist already required remote provenance, but the guarded post-smoke judge pipeline only enforced prediction integrity before judging. After a GPU smoke, that could let the dry/paid judge run on locally complete predictions without proving the remote pod/environment/bootstrap evidence needed for a paper-grade amortized compute claim.

Result: The regenerated pipeline remains zero-cost and still stops at `waiting_for_qwen3b_predictions` because the smoke artifacts are absent. Once predictions exist, the pipeline now refuses to proceed to the dry judge unless `qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1` reports `remote_provenance_ready_for_judge`. The validator now rejects post-smoke pipeline artifacts that omit the provenance command or target a noncanonical provenance gate. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This adds one more fail-closed condition between training and judging. It may slow the first paid judge run if provenance files are missing, but that is preferable to spending judge budget on artifacts that cannot support a reproducible paper claim.

### D180. Regression-test provenance refusal before dry judging

Decision: Add `grounded-qa-distillation-qwen3b-post-smoke-provenance-guard-audit.mjs`, materialize `qwen3b-post-smoke-provenance-guard-audit-2026-06-27-v1`, and validate it as a zero-cost regression for the guarded post-smoke pipeline.

Reason: D179 wired remote provenance into the canonical post-smoke pipeline, but the project also needs proof that the future paid path cannot regress into judging structurally complete predictions without remote execution evidence. A direct production-style fixture is stronger than relying on code inspection because it exercises the real integrity gate, provenance gate, and pipeline control flow.

Result: The audit creates a temporary 69-row prediction fixture from the active curriculum packet's eval references. The fixture passes prediction integrity with zero failures, but deliberately omits `prime_pod_status.json`, `remote_environment.txt`, and `remote_smoke_bootstrap_manifest.json`. The post-smoke pipeline exits with `failed_remote_provenance_not_ready`, creates no dry-judge or paid-judge result, removes all temporary fixture directories, and records zero spend. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: The fixture uses reference answers, so it is not model-quality evidence and cannot be used as a baseline. Its role is only to prove that the paid judge path is fail-closed on remote provenance before budget is spent.

### D181. Pre-validate the Qwen Pareto-table update contract

Decision: Add `grounded-qa-distillation-qwen3b-pareto-update-contract-audit.mjs`, materialize `qwen3b-pareto-update-contract-audit-2026-06-27-v1`, validate it, and add `qwen_pareto_update_contract_ready` to the final evidence checklist.

Reason: The Qwen result-integration gate emits `pareto_row_to_add`, but the actual cost/coverage/support table update is a later step. Without a contract audit, a future update could accidentally mutate existing baseline rows, add duplicate Qwen rows, or hide the frontier decision while regenerating paper artifacts.

Result: The audit uses a synthetic `qwen3b_joint_action_smoke` row shaped like the integration output, appends it to an in-memory copy of the current Pareto systems, and recomputes the frontier. It verifies existing rows are preserved byte-for-byte, the Qwen row has the canonical ids and comparable metrics, exactly one row is added, integration statuses are covered, and the outcome policy is pre-registered. The synthetic row lands on the synthetic frontier, but the audit explicitly does not claim model quality. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This does not update the real Pareto table because no real Qwen row exists yet. It narrows the future update path: once the real integration row exists, use `pareto_row_to_add`, add exactly one canonical row, recompute the frontier, then regenerate amortization and paper artifacts.

### D182. Add a post-Qwen regeneration contract audit

Decision: Add `grounded-qa-distillation-post-qwen-regeneration-contract-audit.mjs`, materialize `post-qwen-regeneration-contract-audit-2026-06-27-v1`, expand the final evidence checklist's `regenerate_paper_artifacts` command, and validate the audit as a zero-cost contract.

Reason: The future Qwen integration/Pareto update can only support a paper claim if every downstream artifact is regenerated from that result. The prior checklist command regenerated the budget, readiness, evidence map, draft, and reviewer-risk audit, but it did not explicitly regenerate amortization, distillation-loss accounting, the final-claim matrix, or the final-evidence checklist itself. That left a stale-artifact path where a manuscript could appear refreshed while key accounting and claim gates still reflected pre-Qwen state.

Result: The final checklist regeneration command now covers ten scripts: total budget, cost/coverage/support Pareto, amortization break-even, distillation-loss accounting, paper readiness, final-claim acceptance matrix, final-evidence checklist, manuscript evidence map, manuscript draft, and reviewer-risk audit. The audit verifies full command coverage, binds to the current Qwen Pareto update contract, and records a freshness policy requiring all downstream paper artifacts to be generated after Qwen integration once Qwen reaches `ready_for_pareto_update`. Current status is `post_qwen_regeneration_contract_ready`, while Qwen integration remains `waiting_for_qwen3b_predictions`. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This still does not create Qwen predictions, run a paid judge, or prove model quality. It makes the post-Qwen paper regeneration path executable and auditable so the eventual result cannot be used with stale budget, loss-accounting, readiness, claim, or manuscript artifacts.

### D183. Test a leakage-safe cross-window candidate selector

Decision: Add `grounded-qa-distillation-candidate-selector-cross-window.mjs`, materialize `candidate-selector-cross-window-240-320-to-321-389-v1`, and validate it as a zero-cost train/eval selector run over existing direct, balanced-risk-gate, and claim-entailment-guard candidates.

Reason: The candidate-pool oracle showed that selection alone cannot create supported answers where no supported candidate exists, but it did not test whether a deployable selector can transfer under a useful coverage constraint. While the Qwen 3B smoke is backend-blocked, the project can still learn whether support-score thresholding over existing candidates is a credible amortized scaffold or only a small overlay.

Result: The selector tunes on examples 241-320 using existing `gpt-4o` judgments, requiring at least 70% answer rate, and freezes a support-score threshold of `0.55` with no claim-guard fallback. On the untouched 321-389 final window, it answers 50/69 examples, reaches 66.0% answer support, 100.0% abstention support, and 75.4% overall judged correctness. This modestly improves over direct-mini citation repair at the same held-out window (64.2% answer support, 72.5% overall correctness) while preserving the 70% answer-rate floor. It still trails the lower-coverage support-first gates and does not create new supported answers. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This is a useful deployable selector baseline, not final amortized-student evidence. It still depends on direct-mini outputs, so the Qwen 3B joint-action smoke remains necessary to test whether post-training can generate or repair supported answers rather than only suppressing risky ones.

### D184. Put the cross-window selector on the Pareto and manuscript path

Decision: Regenerate `cost-coverage-support-pareto-2026-06-26-v1` with `cross_window_candidate_selector`, wire that selector into the manuscript evidence map and draft, and tighten the post-Qwen regeneration contract so it also regenerates `grounded-qa-distillation-cost-coverage-pareto.mjs`.

Reason: D183 created a real held-out selector result, but leaving it out of the Pareto table would make the paper compare Qwen against a stale baseline set. The post-Qwen path also needs to regenerate the Pareto table itself after a real Qwen row exists; otherwise the manuscript could refresh without the cost/coverage/support frontier reflecting the trained student.

Result: The Pareto table now includes `cross_window_candidate_selector` as a one-call small-model plus zero-call selector row: 72.5% answer rate, 66.0% answer support, and 75.4% overall judged correctness. It sits on the frontier between higher-coverage direct repair and lower-coverage support-first gates. The evidence map and draft now call it the best current deployable 70%-coverage scaffold while still blocking final amortized-student claims. The post-Qwen regeneration audit now requires ten scripts and ten freshness artifacts, including the cost/coverage/support Pareto table. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: The selector improves the current baseline story, which raises the bar for Qwen 3B, but it also makes the comparison fairer. It does not eliminate the need for Qwen to generate or repair supported answers beyond selection over direct-mini outputs.

### D185. Tighten Qwen acceptance against the deployable selector

Decision: Patch the Qwen result-integration gate, fixture audit, outcome policy, final-claim matrix, validator, distillation-loss accounting, and README so the minimum positive Qwen outcome must beat both the direct baseline and the deployable cross-window selector baseline at at least 70% answer rate, while still reporting deltas to the 70% coverage-constrained frontier.

Reason: D183 and D184 established `candidate-selector-cross-window-240-320-to-321-389-v1` as the best current deployable 70%-coverage scaffold. If a trained Qwen 3B student only beats the older direct baseline but loses to that selector, the paper cannot honestly claim a better amortized grounded QA method. The selector therefore has to be part of the minimum acceptance bar, not only a descriptive comparison row.

Result: The integration artifact now records `deployable_selector_baseline` in `baseline_targets`; minimum-positive fixtures must clear selector support and correctness; the outcome policy pre-registers selector-aware thresholds; the final-claim matrix requires answer support above both baselines; distillation-loss accounting reads the selector result as a source artifact; and validation fails if the selector baseline disappears from Qwen integration. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This makes the Qwen 3B smoke harder to pass. A minimum-positive outcome now has to beat a real leakage-safe selector, not just a weaker direct baseline, but that is the comparison a reviewer would expect after the selector was added to the Pareto frontier.

### D186. Make Prime auth repair executable and secret-safe

Decision: Add `grounded-qa-distillation-prime-auth-repair-handoff.mjs`, materialize `prime-auth-repair-handoff-2026-06-27-v1`, validate it, and wire it into the final evidence checklist and reviewer-risk audit.

Reason: Prime remains the fastest path to the bounded Qwen 3B smoke, but the saved local key is unauthorized and the key must not be pasted into chat. The project needed a concrete handoff that uses the macOS hidden-input helper, updates only the local Prime CLI config when explicitly requested, reruns read-only auth/price/backend/launch gates, and still refuses pod creation until every gate passes.

Result: The handoff artifact currently reports `waiting_for_hidden_prime_key`. It records the exact hidden-input command, the `set -a; source ~/.codex/secrets.env; ... --apply=true` command for applying the key, and the Prime launch-predicate command to rerun after repair. Validation checks that no Prime secret is serialized, `--apply=true` is required before writing `~/.prime/config.json`, the file mode remains private, no pod creation occurs, and the $100 cap is preserved. This made zero OpenAI calls, launched no GPU jobs, and leaves actual spend at `$5.8963856`.

Tradeoff: This does not repair the key by itself or prove Prime balance. It removes the operational ambiguity so the next valid key entry can immediately refresh live pricing and backend readiness without spending compute or weakening the secret-handling rule.

### D187. Repair Prime auth but block on SSH preflight before training

Decision: Apply the Prime token through the hidden-input handoff, switch the Prime CLI context to team `Zenobia Pay`, refresh the current Prime auth/price and backend-readiness gates, attempt one bounded pod SSH preflight, record the actual wallet debit, and harden the Prime runbook to require SSH access before repo sync or training.

Reason: The previous blocker was ambiguous between missing key, expired key, and account funds. After the hidden key repair, `prime whoami` and `prime wallet` succeeded and the wallet showed enough balance for the bounded smoke. Live Prime inventory did not expose `L4`, so the gate was refreshed against canonical `RTX6000Ada_48GB`, with verified resources under budget. A short pod attempt was justified to test the last operational dependency, but it had to terminate immediately if SSH failed to avoid uncontrolled spend.

Result: Prime auth and wallet are now verified for `Zenobia Pay`; `prime-auth-price-gate-current-2026-06-27-v1` reports `auth_and_live_price_verified`, and `remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1` reports `remote_backend_ready_for_qwen3b_smoke`. A Massed Compute `RTX6000Ada_48GB x1` pod was created and terminated after SSH preflight failed with publickey/password denial before repo sync or training. Wallet billing charged `$0.0192`, recorded in `spend/ledger.jsonl` and `prime-qwen3b-smoke-ssh-preflight-attempt-2026-06-27-v1`; total tracked spend is now `$5.9155856`, with `$94.0844144` remaining under the `$100` cap. No Qwen predictions or OpenAI judge calls were created.

Tradeoff: The project is no longer blocked on Prime API auth or funds, but it is blocked on Prime SSH key provisioning. The next attempt should first make the Prime dashboard profile accept the public key matching the configured private key, or use a backend/image path with working SSH, then rerun the same gates and SSH preflight before any training command.

### D188. Register the Prime SSH key server-side before another pod

Decision: Use Prime's authenticated `/api/v1/ssh_keys/` API to upload the public key matching the configured local private key and set it as the primary key before launching another pod.

Reason: Prime auth, team context, and wallet balance were valid, but the previous pod rejected SSH because the account had zero server-side SSH keys. The CLI exposes `ssh_key_path` but not an SSH-key management command, so pod creation could succeed while SSH login failed.

Result: The local key pair was verified, the public key fingerprint `d66eee49e96f5c68` was uploaded as key `e6a17adcaa0f4648b16f11c75570632f`, and the next Massed Compute pod accepted SSH with `IdentitiesOnly=yes`. This made zero OpenAI calls and did not itself create GPU spend.

Tradeoff: This fixes the operational blocker but does not prove model quality. Any future Prime run should still run the no-training SSH preflight before syncing code or starting training.

### D189. Run the bounded Qwen 3B joint-action smoke on Prime

Decision: Reuse the SSH-verified `RTX6000Ada_48GB` Prime pod to run the bounded 20-step SFT plus 10-step DPO Qwen 3B smoke, then fetch artifacts and terminate the pod.

Reason: The project needed real trained-student evidence, not more tiny-model controls or local base-model substitutes. The live Massed Compute price was `$0.75/hr`, and the wallet/budget gate left enough room under the `$100` total cap.

Result: The pod `4b9bc2927a4f4128a7de5fb3b73c77f2` ran `Qwen/Qwen2.5-3B-Instruct` with the active curriculum repair/abstain packet and produced 69 final-window predictions. The smoke required three script fixes: make DPOConfig kwargs TRL-version tolerant, wrap DPO chosen/rejected outputs as assistant-message lists for newer TRL chat formatting, and disable DPO's automatic eval pass to avoid an RTX 6000 Ada OOM after the 10th DPO step. The final raw Qwen metrics were weak: 78.3% answer rate, 26.2% citation precision, 18.8% citation recall, 11.9% answer F1, and 100% valid JSON. Prime billed `$0.2158`; total tracked spend after compute was `$6.1313856`.

Tradeoff: The run is a real trained-student smoke with provenance and cost, but it is not a positive paper result. The script fixes are compatibility hardening, not metric improvements.

### D190. Judge the citation-repaired Qwen smoke and treat it as negative

Decision: Do not spend a paid judge on the raw Qwen predictions after integrity failed. Instead, apply deterministic citation normalization/inline repair, rerun integrity, then judge the repaired artifact with `gpt-4o`.

Reason: The raw Qwen artifact had unknown/bracketed citation IDs, one parse error, and many grounded answers without citations, so the integrity gate correctly refused paid judging. A zero-cost repair could make the artifact structurally judgeable while preserving the underlying answer content and answer/abstain decisions.

Result: The repair changed 20 rows, appended 30 missing inline citations, dropped 1 invalid citation, cleared 1 parse error, and raised inline citation rate to 61.1% while preserving the 78.3% answer rate. The paid `gpt-4o` judge made 69 ledgered calls and cost `$0.13486`. Judged quality was negative: 13.0% answer support, 100.0% abstention support, 31.9% overall judged correctness, and 31.9% invalid-answer rate. The result integration reports `qwen3b_negative_ready_for_pareto_update`. Total tracked spend is `$6.2662456`, leaving `$93.7337544`.

Tradeoff: Citation repair made the run judgeable, but did not solve support. This strengthens the paper's negative evidence: a bounded 3B SFT/DPO smoke learned format better than support-preserving grounded QA. Per the pre-registered policy, no larger GPU/model escalation should happen until a failure-mode audit shows the bottleneck is capacity rather than data construction, DPO objective, citation contract, or abstention policy.

### D191. Audit Qwen failures before any larger-model escalation

Decision: Run `support-failure-analysis-qwen3b-smoke-citation-repair-2026-06-27-v1` over the repaired Qwen predictions and paid `gpt-4o` judgments before considering another GPU/model run.

Reason: D190 made the Qwen result negative, but the next decision is not automatically "rent a bigger GPU." The project needs to know whether failures look capacity-bound or whether the data/objective/contract is still wrong.

Result: The audit reuses existing artifacts and makes zero calls. Of 54 answered Qwen predictions, only 7 are supported and 47 are unsupported. Heuristic failure tags show 38 too-short/yes-no outputs, 33 unsupported task/experiment claims, 23 missing-direct-evidence cases, 23 invalid-citation-id cases, 16 counterfactual-insufficient prompts answered anyway, 9 unsupported context/annotation claims, 5 partial-support cases, and 3 unsupported comparison/baseline claims. This points to training objective and answer construction failures, not a clean "model too small" diagnosis.

Tradeoff: Tags are heuristic summaries of judge notes, not a human adjudication. They are strong enough to block immediate large-model escalation, but the next useful experiment should target objective/data changes: require abstention on counterfactual insufficiency, penalize no-citation/too-short answers, and train answer regeneration with cited evidence spans before spending on a larger model.

### D192. Build a failure-driven Qwen v3 curriculum before renting a larger GPU

Decision: Add `grounded-qa-distillation-qwen3b-failure-driven-curriculum-packet.mjs` and materialize `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3` as the next zero-cost packet candidate.

Reason: D191 shows the negative Qwen smoke is not cleanly explained by model size. The dominant failures are too-short/no-citation outputs, invalid citation behavior, task/experiment overgeneralization, and answering counterfactual-insufficient examples. The right next experiment is therefore a data/objective repair before any bigger model or more expensive GPU rental.

Result: The v3 packet starts from the validated v2 curriculum, hardens the system prompt to force an evidence-sufficiency decision and reject bare yes/no, empty, citation-only, and no-citation grounded answers, then adds synthetic DPO hard negatives from train/validation rows only. It adds 244 train DPO hard negatives and 59 validation DPO hard negatives; among train additions, 208 prefer a cited answer over a no-citation short answer and 36 prefer abstention over a spurious short answer. The final eval example ids and references are unchanged, the final-window failure labels are not used for training, the packet validator passes, and the grounded-QA validator accepts the new leakage guards. This made zero OpenAI calls, launched no GPU job, and leaves total tracked spend at `$6.2662456`.

Tradeoff: This is a stronger next-run candidate, not new quality evidence. It should be tested with a bounded smoke only after a fresh budget gate. If it fails with the same pattern, then larger-model escalation becomes better justified; if it improves citation/abstention contract but not support, the paper should frame that as evidence about objective/data construction limits.

### D193. Run the bounded failure-driven Qwen v3 smoke before larger-model escalation

Decision: Patch the v3 Prime runner to point at `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`, launch one bounded `RTX6000Ada_48GB` Prime pod, run the 20-step SFT plus 10-step DPO smoke, fetch artifacts, terminate the pod, and record the actual wallet debit.

Reason: D191 and D192 showed that the first Qwen failure was not cleanly a model-size problem. The cheapest decision-relevant experiment was therefore to test the failure-driven curriculum under the same bounded 3B setup before renting a larger GPU or moving to a larger model.

Result: Pod `79a858cfe9b149458be427ec212db645` ran `Qwen/Qwen2.5-3B-Instruct` on the v3 packet and produced 69 final-window predictions. Prime billed `$0.1599`, recorded by `joint-action-smoke-ledger-finalizer-joint-action-qwen3b-v3-smoke-eval-v1`; no active pods remained after termination. Raw metrics improved answer F1 and abstention behavior versus v2 but still failed structural integrity: 46 answered, 23 abstained, 66.7% answer rate, 19.7% citation precision, 26.7% citation recall, 24.7% answer F1, 0.0% inline citation rate, 6 parse errors, and many bracketed/unknown citation tokens. The total tracked spend after Prime plus later judge is `$6.5838606`, leaving `$93.4161394` under the `$100` cap.

Tradeoff: This produced real trained-student evidence at low cost, but it also showed the model still does not obey the citation contract without deterministic repair. The run is useful for diagnosis and cost/quality curves, not for a positive paper claim.

### D194. Treat v3 as improved but still negative; target data/objective repair before scaling

Decision: Apply deterministic citation repair to v3, run the pre-judge integrity gate, spend one paid `gpt-4o` judge pass, integrate the result, update the Pareto script to include separate v2 and v3 Qwen rows, and run a new support failure analysis before any larger-model rental.

Reason: The raw v3 artifact was not judgeable, but the repair preserved answer/abstain decisions and answer text while normalizing inline citation syntax. A paid judge was justified only after the repaired artifact passed integrity and the dry-run estimate fit under the `$100` cap.

Result: The repair changed all 46 answered rows, appended 99 inline citations, cleared 6 parse errors, and passed integrity with 100.0% inline citation coverage. The paid `gpt-4o` judge made 69 ledgered calls and cost `$0.157715`. V3 reached 32.6% answer support, 100.0% abstention support, and 55.1% overall judged correctness, a material improvement over v2 repaired Qwen (13.0% answer support and 31.9% overall judged correctness) but still below the pre-registered acceptance bar because answer rate is 66.7%, under the required 70%, and support/correctness remain behind the deployable selector baseline. The failure audit shows 15 supported and 31 unsupported answered predictions; dominant tags are missing direct evidence, unsupported context/annotation claims, unsupported task/experiment claims, and counterfactual-insufficient prompts still answered.

Tradeoff: This result argues against immediately renting a larger GPU as the next move. Model capacity may matter, but the remaining failures are still strongly data/objective shaped: the student overclaims context and task details, answers some counterfactual-insufficient prompts, and needs answer regeneration from directly cited spans. The next experiment should add support-aware answer construction or stronger negative preference data before spending materially more on scale.

### D195. Test a support-aware v4 curriculum under the same bounded Qwen 3B smoke

Decision: Extend the failure-driven packet generator with a `support_aware_v4` variant, materialize `joint-action-gpu-prep-qwen3b-support-aware-curriculum-v4`, run the same bounded 20-step SFT plus 10-step DPO Prime smoke, fetch artifacts, terminate the pod, and judge only after deterministic citation repair passed integrity.

Reason: D194 showed that v3 improved support but still overclaimed context, task, model, and comparison details while answering some insufficient-evidence prompts. The cheapest decision-relevant next step was to add support-aware DPO hard negatives from train/validation rows only before renting a larger GPU or switching to a larger model.

Result: The v4 packet uses v3 as source, preserves the final eval ids/references, adds 244 new train DPO rows and 59 validation DPO rows, and records 488 total train hard-negative rows after carrying forward v3 pressure. Pod `f57757d230844b88911b7df845017313` ran on Massed Compute `RTX6000Ada_48GB` and was terminated with no active pods remaining. Prime billed `$0.1591`. Raw v4 answered 45/69 examples, abstained on 24, and improved reference-style metrics over v3: 43.5% citation precision, 55.9% citation recall, and 31.1% answer F1. It still failed structural integrity with 10 parse errors, invalid citation tokens, and 1.2% inline citation coverage before repair.

Tradeoff: The packet is a real low-cost data/objective intervention, but it did not fix the model's native citation contract. It produced a slightly more conservative student, not an acceptable final system.

### D196. Treat v4 as another negative result and separate support construction from citation syntax

Decision: Apply deterministic citation repair to v4, run the integrity and provenance gates, spend one `gpt-4o` judge pass under the budget cap, integrate the result, and run a fresh support failure analysis before any larger model escalation.

Reason: V4's raw output was structurally invalid, but the repaired artifact preserved answer/abstain decisions and answer text while making the run judgeable. The dry judge estimated `$0.4636625`, and the actual project spend remained far under the `$100` cap.

Result: The repair changed 38 rows, appended 72 inline citations, dropped 6 invalid citations, cleared 10 parse errors, and passed integrity with 100.0% inline citation coverage over surviving citations. The paid judge made 69 calls and cost `$0.14685`. V4 reached 33.3% answer support, 100.0% abstention support, 56.5% overall judged correctness, and 7.2% invalid judgment rate. Compared with v3, v4 slightly improves answer support and overall correctness but lowers answer rate from 66.7% to 65.2% and still remains far below the deployable selector baseline and the 70% answer-rate acceptance bar. The failure audit reports 15 supported and 30 unsupported answered predictions; counterfactual answering remains 10 cases, missing-direct-evidence drops to 14, too-short answers drop to 3, but invalid citation and partial-support failures remain.

Tradeoff: Support-aware DPO alone is not enough. The next research decision should separate two problems: native citation syntax still needs constrained decoding or a scaffolded citation binder, while support correctness needs better answer construction from directly cited spans and stronger abstention boundaries. A larger model is more justified than it was after v2, but only as a comparison after the paper clearly reports that two data/objective repairs improved support slowly and did not close the gap.

### D197. Add a zero-call structural binder as a diagnostic scaffold, not a final student

Decision: Add `grounded-qa-distillation-qwen3b-structural-binder.mjs`, materialize `qwen3b-structural-binder-v4-smoke-2026-06-27-v1`, validate it, and add its row to the cost/coverage/support Pareto table.

Reason: V4 still needed deterministic citation repair and had invalid/no-citation answer failures. Before spending on a larger model, the project needed to know whether a cheap structural scaffold can recover grounded correctness by suppressing obviously unsafe trained-student answers.

Result: The binder makes zero OpenAI calls and launches no GPU jobs. It suppresses repaired Qwen answers with no valid citations, dropped invalid citations, too-short comparison/model/task answers, comparison claims not present in cited evidence, or numeric claims whose numerals are absent from cited evidence. On the already-judged v4 final window, it suppresses 15 of 45 answers, including 5 helpful suppressions and 2 harmful suppressions. Answer support rises from 33.3% to 43.3%, and overall judged correctness rises from 56.5% to 60.9%, but answer rate collapses from 65.2% to 43.5%, far below the 70% acceptance bar.

Tradeoff: This confirms citation/support binding is useful but insufficient. The paper should separate trained answer generation from zero-call post-hoc binding, and it cannot claim support-preserving amortized distillation from the binder because the coverage loss is too large and the evaluation reuses final-window judgments. The next high-value experiment is either constrained citation decoding that preserves answer coverage or a larger-model comparison with the same binder and budget accounting.

### D198. Run a bounded Qwen 7B scale comparison; treat it as support-positive but coverage-negative

Decision: Use the saved Prime Intellect token from `~/.codex/secrets.env`, rent one `A6000_48GB` pod, run the same support-aware v4 packet with `Qwen/Qwen2.5-7B-Instruct` under the existing 20-step SFT plus 10-step DPO cap, terminate the pod immediately after artifacts were fetched, then judge only after deterministic citation repair passed integrity and provenance gates.

Reason: After D197, the core unresolved question was whether the poor Qwen 3B support was mostly a data/objective failure or a model-capacity failure. A bounded 7B comparison on the same packet was the cheapest decisive test before spending more on longer training, stronger models, or a new verifier stack.

Result: Prime pod `507158053abd49b982b12849f4eb4577` ran for 19 minutes on Massed Compute `A6000_48GB` and billed `$0.1580`; no pods remained active after termination. Raw Qwen 7B answered 35/69 examples, abstained on 34, reached 70.1% citation precision and 47.3% citation recall, but failed pre-judge integrity because of 6 parse-recovery rows, one malformed citation id, and low inline citation coverage. Deterministic citation repair changed 22 rows, appended 36 inline citations, cleared the parse errors, and passed integrity with 100.0% citation-level inline coverage and 97.1% row-level inline citation rate. The paid `gpt-4o` judge made 69 ledgered calls and cost `$0.1447625`, bringing tracked project spend to `$7.1925731` of the `$100` cap. Repaired Qwen 7B reached 65.7% answer support, 100.0% abstention support, and 82.6% overall judged correctness. Compared with repaired Qwen 3B v4, judged correctness improves by 26.1 points and answer support by 32.4 points, but answer rate drops from 65.2% to 50.7%.

Tradeoff: Model capacity clearly matters for grounded support, so the tiny-model-as-ground-truth-labeler path is not credible as the main student evidence. But the 7B result still fails the pre-registered support-preserving distillation target because it is far below the 70% answer-rate floor and slightly below the deployable selector's answer-support target. The next experiment should not simply rent a larger GPU and chase scale; it should preserve 7B's support behavior while recovering coverage, most likely through coverage-aware DPO, answerable-example oversampling, or constrained citation decoding. This is a useful paper result because it separates capacity from objective design, but it is not a final success claim.

### D199. Test coverage-aware Qwen 7B v5; reject blanket answer-over-abstain pressure

Decision: Add a `coverage_aware_v5` curriculum variant that composes the v4 support-aware hard negatives with answerable-row DPO preferences choosing the cited grounded target over a conservative abstention. Materialize `joint-action-gpu-prep-qwen7b-coverage-aware-curriculum-v5`, patch the launch preflight to recognize the actual `DPOConfig` step cap and treat prompt truncation as a bounded-smoke risk, run a 20-step SFT plus 10-step DPO Prime smoke on Qwen 7B, repair citations, judge with `gpt-4o`, and integrate the result.

Reason: D198 showed that Qwen 7B v4 had much better support than Qwen 3B but failed the coverage floor by answering only 35/69 examples. The cheapest direct test was whether answerable training rows could recover coverage without changing the model family or spending on a larger GPU.

Result: The v5 packet has 244 SFT train rows, 814 DPO train rows, 59 SFT validation rows, 192 DPO validation rows, and the same 69 final eval prompts. It adds 208 train and 53 validation answer-over-abstain preferences without using final-window labels for training. Prime pod `ce4881415c67420cb08b0591d812bf5a` ran for 19 minutes on `A6000_48GB` and billed `$0.1650`; no pods remained active after termination. Raw v5 answered 44/69 examples and improved citation recall to 61.0%, but again failed structural integrity with 18 parse-recovery rows and low inline citation coverage. Deterministic citation repair changed 32 rows, appended 48 inline citations, dropped 1 invalid citation, and passed integrity. The paid `gpt-4o` judge made 69 ledgered calls and cost `$0.1470675`, bringing total tracked project spend to `$7.5046406`. Repaired v5 reached 63.8% answer rate, 50.0% answer support, 100.0% abstention support, and 68.1% overall judged correctness.

Tradeoff: The intervention recovered 9 answered examples versus Qwen 7B v4 but doubled unsupported answers from 12 to 22 and reintroduced 10 counterfactual-insufficient answered failures. Blanket answer-over-abstain pressure is unsafe. The next data-construction move should be answerability-gated coverage recovery: only push answer-over-abstain when a learned or deterministic evidence sufficiency signal says the compact pack directly answers the question, while keeping v4's conservative behavior elsewhere.

### D200. Test answerability-gated Qwen 7B v6; reject the current hard sufficiency gate as too conservative

Decision: Extend the curriculum generator with an `answerability_gated_coverage_v6` variant, materialize `joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6`, add only train/validation answer-over-abstain preferences whose cited target answer passes deterministic evidence-sufficiency checks, run one bounded Qwen 7B A6000 smoke, repair citations, judge with `gpt-4o`, integrate the result, and add the row to the Pareto table.

Reason: D199 showed that blanket answer-over-abstain pressure recovers coverage but damages support. The next cheapest test was whether a hard sufficiency gate could keep Qwen 7B v4's support behavior while recovering some coverage from only the safest answerable rows, without renting a larger GPU or using final-window labels for training.

Result: The v6 packet starts from the v3 base, re-adds v4 support-aware pressure, and adds only 65 train plus 19 validation gated coverage preferences, rejecting 143 answerable train rows as insufficiently direct for answer-over-abstain pressure. Prime pod `2cd47a4dad714d35ab9ff12f1af113a1` ran on Massed Compute `A6000_48GB`, was terminated with zero active pods remaining, and billed `$0.1357`. Raw v6 answered 34/69 examples, abstained on 35, reached 71.8% citation precision and 58.7% citation recall, but failed structural integrity with 19 parse-recovery rows, unknown citation strings, and low inline citation coverage. Deterministic citation repair changed 22 rows, appended 34 inline citations, dropped 2 invalid citations, cleared 19 parse errors, and passed integrity/provenance gates. The paid `gpt-4o` judge made 69 ledgered calls and cost `$0.14662`, bringing total tracked spend to `$7.7869606`. Repaired v6 reached 49.3% answer rate, 61.8% answer support, 100.0% abstention support, and 81.2% overall judged correctness. Failure analysis reports 21 supported and 13 unsupported answered predictions; counterfactual unsupported answers dropped from 10 in v5 to 4.

Tradeoff: The hard sufficiency gate fixed much of v5's unsafe coverage pressure but overcorrected: it answers fewer examples than v4 while also scoring slightly below v4 on answer support and overall correctness. This rejects the current deterministic answerability gate as the final coverage-recovery mechanism. The next intervention should be softer or two-stage: train answer construction on directly cited spans while using a calibrated support verifier after generation, or add constrained citation decoding so native syntax does not require post-hoc repair.

### D201. Audit Qwen 7B v4/v5/v6 row-level headroom before another GPU run

Decision: Add `grounded-qa-distillation-qwen7b-tradeoff-audit.mjs` and materialize `qwen7b-tradeoff-audit-v4-v5-v6-2026-06-27-v1` as a zero-call row-level audit over the three paid Qwen 7B judge surfaces.

Reason: D198-D200 created three different Qwen 7B operating points: conservative support-aware v4, unsafe coverage-heavy v5, and over-conservative answerability-gated v6. Before spending on another GPU run, the project needed to know whether the existing candidate pool has recoverable supported answers and whether simple agreement rules can recover coverage without new model training.

Result: The audit reuses existing prediction and `gpt-4o` judgment artifacts and makes no OpenAI calls or GPU launches. V5 newly answers 19 rows over v4, but only 6 of those new answers are supported and 13 are unsupported; 8 of the 19 are counterfactual rows. V6 suppresses 15 v5 answers, with 11 useful suppressions and 4 harmful suppressions. An oracle over existing v4/v5/v6 candidates reaches 94.2% overall correctness and 89.2% answer support, but only 53.6% answer rate, so the current candidate pool still lacks enough supported answers for the 70% coverage target. The best tested deployable agreement selector is just the v4 baseline at 82.6% correctness and 50.7% answer rate.

Tradeoff: This blocks another simple selector or hard-gate iteration. The next spend-worthy intervention must create new supported answers, not merely choose among v4/v5/v6 outputs. The most defensible next run is a two-stage or soft-answerability curriculum: train answer construction from directly cited spans, keep a calibrated support verifier after generation, and improve native citation syntax with constrained decoding or format supervision.

### D202. Prepare a soft-answerability construction v7 packet before more GPU spend

Decision: Extend `grounded-qa-distillation-qwen3b-failure-driven-curriculum-packet.mjs` with `soft_answerability_construction_v7` and materialize `joint-action-gpu-prep-qwen7b-soft-answerability-construction-curriculum-v7` as the next no-spend Qwen 7B candidate.

Reason: D201 showed existing v4/v5/v6 candidates cannot hit the 70% answer-rate target by selection alone. D199 showed blanket answer-over-abstain pressure is unsafe, while D200 showed the hard sufficiency gate is too conservative. The next intervention therefore needs to create new supported answers with softer answerability calibration rather than another hard gate or selector.

Result: The v7 packet starts from the leakage-safe v3 source packet, uses the v6 final-window failure audit only to select policy changes, and does not train on final-window labels. It appends deterministic local answerability hints to train, validation, and eval prompts using only each question and compact evidence pack. It keeps support-aware hard negatives and adds 191 train plus 49 validation soft answer-construction preferences that choose cited grounded targets over conservative abstention when the local scorer finds direct or medium evidence support; 17 train answerable rows are rejected by the soft scorer. The emitted dataset has 244 SFT train rows, 59 SFT validation rows, 797 DPO train rows, 188 DPO validation rows, and the unchanged 69 final eval prompts. The packet validator passes, makes zero OpenAI calls, launches no GPU job, and leaves tracked spend at `$7.7869606`.

Tradeoff: This is not new model-quality evidence until a bounded Prime smoke and judge pass run. It is, however, the first prepared candidate that directly follows the v5/v6 tradeoff: softer than v6's hard gate, safer than v5's blanket coverage pressure, and deployable because the answerability hints can be recomputed from private KB evidence packs at inference time.

### D203. Run Qwen 7B v7 smoke; defer paid judge until OpenAI key is available

Decision: Launch one bounded Prime smoke for `joint-action-gpu-prep-qwen7b-soft-answerability-construction-curriculum-v7`, fetch artifacts, terminate the pod, record exact compute spend, run deterministic citation repair plus integrity/provenance gates, and stop before paid judging because `OPENAI_API_KEY` was not available through the shell or `~/.codex/secrets.env` and the hidden-input helper did not receive a key.

Reason: D202 made v7 the next meaningful answer-construction intervention. The remaining budget allowed a bounded GPU smoke, and Prime was authenticated with zero active pods. A paid `gpt-4o` judge is still needed for support metrics, but the repo's secret policy forbids pasting keys into chat; without a saved key, the correct move is to preserve all local and GPU evidence and not make untracked API calls.

Result: Prime pod `112e8f2af2464061befb0e5e2034c839` ran on Massed Compute `RTX6000Ada_48GB`, completed the 20-step SFT plus 10-step DPO smoke with `Qwen/Qwen2.5-7B-Instruct`, and was terminated with zero active pods remaining. Prime history reports exact cost `$0.1912`, recorded by `joint-action-smoke-ledger-finalizer-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1`; total tracked spend is now `$7.9781606`, leaving `$92.0218394`. Raw v7 answered 33/69 prompts, abstained on 36, and had weak reference-style metrics: 47.8% answer rate, 33.3% citation precision, 19.9% citation recall, 10.5% answer F1, and 24.2% inline citation rate. Deterministic citation repair changed 16 rows, appended 24 inline citations, dropped 2 invalid ids, and raised inline citation rate to 69.7%; integrity and remote provenance gates pass with warnings. The `gpt-4o` dry judge estimates 69 calls at `$0.466`, but no OpenAI calls were made for v7 judging.

Tradeoff: Raw v7 is already worse than v4/v5/v6 on coverage and syntax, so it is unlikely to be the missing positive result. Still, do not replace the model-judged support result with proxy metrics: once the key is saved via the hidden helper, run the paid `gpt-4o` judge, integrate the result, and then decide whether to abandon this curriculum family in favor of constrained citation decoding or a two-stage answer-construction-plus-verifier scaffold.

### D204. Recover v7's malformed structured answers before judging

Decision: Add `grounded-qa-distillation-qwen-structure-repair.mjs` and materialize `joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair` as the next zero-call surface to judge.

Reason: D203 treated v7 as raw-negative under the strict JSON evaluator, but inspection showed many `parse_error` rows contained recoverable key-value or YAML-like fields: `answer_type`, `answer`, `citations`, and `claim_table`. Judging the strict parse surface would conflate support quality with output parser brittleness. The paper question is about amortized grounded QA scaffolds, so deterministic output structure repair is a legitimate scaffold component to evaluate separately from model generation.

Result: The structure repair recovers 39 rows from raw output, including the 36 strict parse-error rows, changes 30 answer types, changes 57 answers, changes 41 citation sets, drops 2 invalid citation ids, and appends 57 inline citations. It raises answer rate from 47.8% raw to 91.3%, citation recall from 19.9% to 63.1%, answer F1 from 10.5% to 35.0%, and inline citation rate from 24.2% to 100.0%. The resulting surface passes the prediction integrity gate with no failures and has a `gpt-4o` dry judge estimate of `$0.456` for 69 calls. It makes zero OpenAI calls and launches no GPU job.

Tradeoff: This repair likely recovers unsupported answers as well as supported ones, so proxy gains are not evidence of grounded correctness. The next paid judge, once the key is available, should target the structure-repaired v7 surface rather than the strict-parse or citation-only surface. If support collapses, the conclusion is that constrained syntax/structure solves coverage and citation formatting but not support; if support is competitive, the scaffold path becomes more promising than another training-data curriculum.

### D205. Judge Qwen 7B v7 structure repair and classify it as coverage-high but support-negative

Decision: Use the repo-local `.env` OpenAI key without printing it, run the paid `gpt-4o` judge on `joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair`, materialize `qwen7b-result-integration-joint-action-v7-structure-repair-2026-06-27-v1`, add the v7 row to the cost/coverage/support Pareto table, and run a support-failure analysis as `support-failure-analysis-qwen7b-v7-structure-repair-2026-06-27-v1`.

Reason: D204 showed that deterministic structure repair recovers high coverage and perfect inline citation syntax, but only a paid support judge can tell whether those recovered answers are actually grounded. The user confirmed the key had already been saved; local inspection found it in `.env`, not in `~/.codex/secrets.env`, so the paid judge could proceed under the existing budget guard.

Result: The judge made 69 `gpt-4o` calls and cost `$0.1382175`, bringing tracked spend to `$8.1163781` of the `$100` cap, with zero active Prime pods. The structure-repaired v7 surface answered 63/69 examples for a 91.3% answer rate and 100.0% inline citation rate, but only 26/63 answered predictions were supported. Answer support is 41.3%, abstention support is 100.0%, and overall judged correctness is 46.4%. Against the acceptance targets, v7 is above the 70% answer-rate floor but below the support target by 24.7 points and below the judged-correctness target by 29.0 points. Failure analysis reports 37 unsupported answers, including 17 counterfactual/insufficient-evidence answered failures and 22 missing-direct-evidence tags.

Tradeoff: This is a useful negative result. It says the project should not spend the next dollars on more output parsing or citation-format repair alone: syntax and coverage are now easy to recover, but support remains the binding constraint. The next path to a result the paper can stand on is a two-stage answer-construction-plus-verifier scaffold or constrained generation that prevents unsupported answer construction, not simply a larger model or longer run under the same objective.

### D206. Test whether v7 added enough supported candidates for selection; it did not

Decision: Extend `grounded-qa-distillation-qwen7b-tradeoff-audit.mjs` to include `joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair` and materialize `qwen7b-tradeoff-audit-v4-v5-v6-v7-2026-06-27-v1`.

Reason: D205 showed v7 has high coverage but low support. Before spending on another GPU run or building a more elaborate selector, the project needed to know whether the existing v4/v5/v6/v7 candidate pool contains enough supported answers under an oracle. If the oracle cannot hit the 70% answer-rate target, a selector cannot solve the paper objective.

Result: The oracle over v4/v5/v6/v7 candidates reaches 94.2% overall correctness and 90.2% answer support, but only 59.4% answer rate. V7 adds 32 answers over v4, but only 8 of those new answers are supported. The best deployable agreement selector remains v4 itself at 82.6% correctness and 50.7% answer rate. This audit makes zero OpenAI calls and launches no GPU job.

Tradeoff: Selection-only routing is now ruled out as the next core path. The next experiment must create new supported answer candidates through answer repair/regeneration training, not merely pick among existing Qwen outputs.

### D207. Run Qwen 7B v8 repair/regeneration-focused smoke; classify it as all-abstain negative

Decision: Materialize `joint-action-gpu-prep-qwen7b-repair-regeneration-focused-curriculum-v8` by oversampling repair/regeneration and abstention rows 3x, run one bounded Prime smoke as `joint-action-qwen7b-repair-regeneration-focused-smoke-eval-v8`, ledger the exact Prime cost, judge the predictions with `gpt-4o`, integrate the result, and add it to the Pareto table.

Reason: D206 showed the candidate pool lacks enough supported answers, while the v7 repairability audit found that unsupported v7 answers are mostly abstention-boundary and answer-regeneration failures: 20 should abstain, 16 need answer repair/regeneration, and only 1 is a citation-repair candidate. The cheapest direct test was whether stronger repair/abstention weighting creates a support-preserving Qwen 7B operating point without adding another model family.

Result: Prime pod `8aa41a28663d49b48386fca009644acc` ran on Massed Compute `A6000_48GB`, was terminated with zero active pods remaining, and billed `$1.7802`. The first remote attempt exposed an old `DPOConfig.max_prompt_length` incompatibility; the v8 training script was patched to use version-supported DPOConfig kwargs and chat-shaped DPO chosen/rejected messages, then the bounded smoke completed. The model emitted valid JSON for all 69 rows but abstained on every example: 0 answered, 69 abstained, 0.0% answer rate. The paid `gpt-4o` judge made 69 calls and cost `$0.1660975`; abstention support was 95.7% and overall judged correctness was 95.7%. Total tracked spend is now `$10.0626756` of the `$100` cap.

Tradeoff: V8 proves the opposite failure mode from v7. Strong repair/abstention pressure can make the system very safe, but it destroys coverage and therefore cannot support amortized grounded QA. The next viable path is not more abstention oversampling; it needs a coverage-restoration mechanism constrained by support, such as answer-construction from cited spans followed by a verifier, or a policy that separately trains when to answer and how to regenerate the answer.

### D208. Test a zero-LLM constrained span constructor; reject naive extractive construction as unsupported

Decision: Add `grounded-qa-distillation-constrained-span-constructor.mjs`, materialize `constrained-span-constructor-final-window-2026-06-27-v1`, and validate it as a zero-cost constrained scaffold artifact. The constructor ranks evidence-pack sentences using lexical, numeric, section, and retrieval-rank features, tunes its abstention threshold on the prior 80-row `240-320` window, and evaluates only once on the held-out final 69-row `321-389` window.

Reason: D205-D207 showed that Qwen 7B can be pushed into either high-coverage unsupported answering or all-abstain safety. Before spending on a larger GPU or another LoRA objective, the cheapest direct test was whether support could be preserved by construction: allow the system to emit only a verbatim evidence sentence with one inline citation, or abstain.

Result: The selected support-first threshold was `0.30`. On the prior threshold-selection window, the constructor answered 49/80 rows for a 61.3% answer rate, with 57.1% of answered rows using a reference citation and 36.5% citation recall. On the held-out final window it answered 37/69 rows for a 53.6% answer rate, but only 35.1% of answered rows used a reference citation, with 23.9% citation recall and 6.3% answer-token F1. It made zero OpenAI calls, launched no Prime/GPU job, and left total tracked spend unchanged at `$10.0626756`.

Tradeoff: This rules out naive extractive sentence selection as the next paid surface. Constraining the output syntax and citation count is not enough if the evidence selector picks the wrong span. The next support-preserving path should improve the evidence selector/verifier first, then use constrained answer construction or a generator only after the selected evidence is support-calibrated. This also argues against immediately renting a larger GPU: the current bottleneck is not just model capacity, but the absence of a reliable support-selection mechanism.

### D209. Train a leakage-safe evidence selector; reject evidence-id selection without answer-span construction

Decision: Add `grounded-qa-distillation-trained-evidence-selector-constructor.mjs`, materialize `trained-evidence-selector-constructor-final-window-2026-06-27-v1`, dry-run then run a paid `gpt-4o` judge as `openai-judge-gpt4o-trained-evidence-selector-constructor-final-window-2026-06-27-v1`, and update the consolidated budget ledger.

Reason: D208 showed that a hand-weighted constrained extractor failed mostly because it selected the wrong evidence. The next cheapest test was whether support selection is learnable from prior-window gold evidence ids without per-query LLM calls. To prevent leakage, the evidence, span, and sufficiency models train on rows `0-240`, threshold selection uses only rows `240-320`, and the final `321-389` window is evaluation-only.

Result: The trained selector improved proxy evidence selection over D208 but did not solve grounded answering. The selected threshold `0.75` answered 43/69 final-window rows for a 62.3% answer rate, with 51.2% reference-citation-supported answered rows and 35.4% citation recall. The eval-only threshold sweep shows a 70% answer-rate operating point at thresholds `0.20-0.25`, but only 48-49% reference-citation-supported answers. Because the proxy looked nontrivial, a paid `gpt-4o` judge was warranted: the dry run estimated `$0.459`, and the paid run made 69 ledgered calls costing `$0.140995`. The stricter judge found only 9.3% answer support, 96.2% abstention support, and 42.0% overall judged correctness. Consolidated spend is now `$10.2036706` of the `$100` cap, leaving `$89.7963294`.

Tradeoff: This separates evidence-id selection from answer-span construction. The selector often finds plausibly related evidence, but the extractive span still fails the question, so reference citation overlap is not a reliable enough proxy for grounded correctness. The next intervention should train or constrain answer-span/claim construction directly against question-specific support, not merely select an evidence id. A larger GPU is still not the immediate fix unless the training objective includes this answer-span construction signal.

### D210. Diagnose answer-span construction failures; make span/claim construction the next training signal

Decision: Add `grounded-qa-distillation-answer-span-construction-gap.mjs`, materialize `answer-span-construction-gap-trained-evidence-selector-2026-06-27-v1`, and run the existing support-failure analysis as `support-failure-analysis-trained-evidence-selector-2026-06-27-v1`.

Reason: D209 showed that a trained evidence selector improved reference-citation overlap but collapsed under the stricter support judge. The project needed to know whether the failure was still evidence-id selection, answer-span construction from selected evidence, or lack of extractive recoverability from the gold evidence.

Result: Among 43 answered predictions from the trained selector, only 4 were judge-supported and 39 were unsupported. Of the 39 unsupported answers, 18 selected a reference citation but still answered the wrong question, 21 selected non-reference evidence, and 0 were counterfactual answered failures. Oracle span analysis found that 26/39 unsupported examples have a token-F1 >= 0.35 span somewhere in the gold evidence, and 12/39 have a high-recoverability span with token-F1 >= 0.60. By contrast, only 10/39 unsupported rows have a recoverable span in the model-selected evidence. The bucket counts were 21 `selected_non_gold_evidence`, 18 `selected_gold_evidence_but_wrong_answer`, 20 `question_mismatch`, 13 `missing_direct_evidence`, and 8 `table_or_metric_span_issue`. The existing support-failure analyzer separately tagged 27 `unsupported_task_or_experiment` and 13 `unsupported_context_or_annotation` failures. The new diagnostic made zero OpenAI calls, launched no GPU job, and left tracked spend at `$10.2036706`.

Tradeoff: This gives a concrete next target. Evidence-id labels alone are too weak, but the gold evidence often contains recoverable answer spans. The next post-training/scaffold experiment should construct question-conditioned span or structured-claim supervision: chosen examples should contain the minimal answer-bearing span/claim from gold evidence, rejected examples should include plausible but question-mismatched spans from the same or nearby evidence, and abstention contrasts should remain for counterfactual packs. Another GPU run is only justified if the packet includes this signal.

### D211. Materialize a leakage-safe span/claim construction packet before new GPU spend

Decision: Add `grounded-qa-distillation-span-claim-construction-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9`, and add a validator for this packet family before launching another bounded GPU smoke.

Reason: D210 showed the next training signal should be question-conditioned answer-span and claim construction, not evidence-id selection alone. The packet needs to be usable for post-training while preserving the final-window evaluation contract and keeping training-only hints out of assistant outputs.

Result: The packet emits 240 SFT train rows, 389 DPO train rows, 75 SFT validation rows, 124 DPO validation rows, and the unchanged 69 final eval prompts. It filters 5 candidate validation examples from paper `2004.02929` to keep validation/eval paper overlap empty. The DPO mix includes 157 train question-mismatch negatives, 157 train answer-over-abstain contrasts, and 75 train abstention contrasts. Assistant outputs are restricted to `answer_type`, `answer`, `citations`, `claim_table`, and `abstention_reason`; answer-span metadata remains only in label-source metadata and train/validation prompt hints. The packet generation is local and deterministic: zero OpenAI calls, zero Prime/GPU launches, and total tracked spend remains `$10.2036706` of the `$100` cap.

Tradeoff: This is data-readiness evidence, not model-quality evidence. The next spend-worthy step is a bounded GPU smoke only after a Prime auth/preflight check and a budget gate; the success criterion should be judged support/coverage improvement over v4/v8, not proxy span overlap alone.

### D212. Recheck Prime authentication and budget before any new rental

Decision: Use the existing Prime CLI configuration in `~/.prime/config.json` for a no-spend auth and wallet check, rather than asking for another token in chat or launching a pod.

Reason: The user reported that the token had already been saved. Repo-local `.env` contains the OpenAI key used for paid judging, while `~/.codex/secrets.env` does not contain Prime credentials. The Prime CLI itself has a saved API key, so the correct diagnosis is to test CLI auth and billing state without exposing secrets.

Result: `prime --plain whoami` succeeds for the Zenobia Pay team with admin role and compute permissions. `prime --plain wallet` reports `$47.02` balance, enough for a bounded smoke under the remaining project budget. `prime --plain pods list --output json` reports zero active pods. No OpenAI calls, GPU jobs, or additional spend were incurred; tracked project spend remains `$10.2036706` of the `$100` cap.

Tradeoff: Prime is not blocked by a missing or expired saved token, but the Prime wallet balance is lower than the project-wide remaining budget. The next GPU launch should still use a hard maximum runtime and preflight price gate so Prime spend plus OpenAI judging stays under both the `$47.02` wallet balance and the `$100` total project cap.

### D213. Promote the span/claim packet to a bounded Prime launch candidate

Decision: Add the proven Qwen 7B joint-action runner set to `joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9`, regenerate the packet, run `joint-action-launch-preflight-qwen7b-span-claim-construction-v9`, and record `joint-action-launch-plan-prime-qwen7b-span-claim-v9` as the planned bounded Prime smoke.

Reason: D211 produced the right training signal but not a runnable GPU packet. The next useful evidence requires a real bounded SFT/DPO smoke using the same 20-step SFT plus 10-step DPO contract as prior Qwen 7B runs, with the exact code committed before any pod clone or sync.

Result: The packet now includes `validate_joint_action_dataset_uv.py`, `train_joint_action_lora_uv.py`, `eval_joint_action_adapter_uv.py`, `run_joint_action_smoke.sh`, a Prime bootstrap, and a v9-specific Prime plan. Local validation passes. The launch preflight passes dataset validation and Python compile, confirms `MAX_SFT_STEPS`, `MAX_DPO_STEPS`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`, and reports zero SFT/DPO-full/eval rows over length limits but 8 DPO prompts over the approximate 1280-token prompt cap. The plan records a planned `$4.00` Prime smoke, with actual tracked spend still `$10.2036706` and projected post-launch total `$14.2036706`, under the `$100` cap. Live Prime inventory shows available 48GB options including Massed Compute `A6000 48GB` at `$0.54/hour` and `RTX6000Ada 48GB` at `$0.75/hour`; active pods remain zero.

Tradeoff: The DPO prompt truncation risk is acceptable for a bounded smoke, but not for a final paper claim. If v9 looks promising, the follow-up should either profile with the real tokenizer or raise/adjust DPO prompt length before a larger run.

### D214. Run Qwen 7B v9 span/claim smoke; reject span/claim signal alone as insufficient

Decision: Rent one Massed Compute `A6000_48GB` Prime pod, run the bounded v9 span/claim packet with `Qwen/Qwen2.5-7B-Instruct` under `MAX_SFT_STEPS=20` and `MAX_DPO_STEPS=10`, repair citation syntax locally, judge the repaired surface with `gpt-4o`, update the budget ledger, integrate the result, and add v9 to the Pareto table.

Reason: D210-D213 identified answer-span/claim construction as the next best training signal after evidence-id selection failed. The only way to know whether the signal helps is a real bounded Qwen 7B smoke followed by the same strict support judge used for v4-v8.

Result: Prime pod `d0d7905f18bc4b5e96f817607297ca3f` ran on Massed Compute `A6000_48GB x1`, trained successfully, evaluated 69 final-window prompts, and was terminated with zero active pods. Prime history reports 28 minutes at `$0.2339`. Raw v9 answered 28/69 rows, abstained on 41, reached 70.99% citation precision, 38.26% citation recall, 22.92% answer-token F1, 100% valid JSON, but 0% inline citation rate. Deterministic citation repair changed 27 rows, appended 36 inline citations, dropped 1 invalid citation, cleared 11 parse errors, and passed the repaired integrity gate. The paid `gpt-4o` judge made 69 calls and cost `$0.1470375`. Repaired v9 reached 40.6% answer rate, 50.0% answer support, 97.6% abstention support, and 78.3% overall judged correctness. Consolidated spend is now `$10.5846081` of the `$100` cap, leaving `$89.4153919`. The support-failure analysis found 14 supported and 14 unsupported answered predictions, with unsupported tags led by 8 `too_short_or_yes_no`, 7 `unsupported_task_or_experiment`, 3 `unsupported_context_or_annotation`, 2 `counterfactual_answered`, and 2 `missing_direct_evidence`.

Tradeoff: V9 is safer than the high-coverage v7 surface and avoids v8's all-abstain collapse, but it is still dominated for the paper objective: v4 has better support/correctness, v5 has better coverage, and the cross-window selector remains the best 70%-coverage deployable point. Span/claim supervision alone did not solve support-preserving coverage. The next intervention should not be another larger blind GPU run; it should target the residual answer-form failure directly: prevent yes/no/underspecified answers, enforce complete inline citation construction during decoding or repair, and add counterfactual answer suppression without pushing all answerable rows into abstention.

### D215. Audit Qwen 7B v4-v9 answer-form regression before any larger GPU spend

Decision: Add `grounded-qa-distillation-qwen7b-answer-form-regression-audit.mjs`, materialize `qwen7b-answer-form-regression-audit-v4-v9-2026-06-28-v1`, and validate it as a zero-cost row-level audit over the existing Qwen 7B v4-v9 prediction, judge, and v9 support-failure artifacts.

Reason: D214 showed that v9 is not a deployable improvement, but the next action depended on whether v9 added new supported answer candidates or merely shifted the answer/abstain boundary. A larger rented-GPU run is only justified if the current failure is model capacity rather than answer-form supervision, support verification, or candidate-pool headroom.

Result: The audit covers the same 69 final-window examples and makes no OpenAI calls, launches no GPU job, and records no new spend, leaving tracked spend at `$10.5846081` of the `$100` cap. V9 answers 28 rows with 14 supported and 14 unsupported answers, but it adds only 1 unique supported answer over the existing v4-v8 Qwen 7B candidate pool, and that row is a counterfactual pack; it adds 0 unique non-counterfactual supported answers and no unique new answered rows. As a standalone policy it loses 24 previously supported answer opportunities. The oracle over all existing v4-v9 candidates answers 38/69 rows for a 55.1% answer rate with 38 supported answers, still below the 70% final-window target. V9's unsupported answers remain answer-form-heavy: 8/14 are short, yes/no, or underspecified, and 5 v9 answered rows are counterfactual packs.

Tradeoff: This strengthens the "no blind bigger-GPU run" conclusion. The immediate bottleneck is not simply that the mini/student model is too small; the current candidate pool still lacks 11 supported answers to reach a 70% query-level answer rate, and v9 does not meaningfully expand it. The next intervention should build answer-form-aware supervision and a support verifier that rejects short or underspecified answers and counterfactual answers, then measure whether it creates genuinely new supported candidates before spending more Prime budget.

### D216. Test deterministic answer-form/counterfactual suppression on Qwen 7B v9; reject suppression-only as coverage-collapsing

Decision: Add `grounded-qa-distillation-qwen7b-answer-form-counterfactual-gate.mjs`, materialize `qwen7b-answer-form-counterfactual-gate-v9-2026-06-28-v1`, and score it without new LLM calls by inheriting existing v9 `gpt-4o` judgments for kept rows and scoring forced abstentions against reference answerability.

Reason: D215 showed that v9's residual unsupported answers are dominated by short or underspecified answers and counterfactual-pack answers. Before spending on another GPU run, the project needed to know whether deterministic answer-form and counterfactual suppression is enough, or whether the next packet must actually create new supported answers.

Result: The gate suppresses 13 v9 answers. It improves answer support from 50.0% to 60.0% and overall correctness from 78.3% to 79.7%, but answer rate falls from 40.6% to 21.7%. The suppressions include 3 useful unsupported-answer suppressions on reference-abstain rows, but also 2 harmful suppressions of supported answers and 7 harmful suppressions on answerable rows. The dominant gate reasons are 9 `too_short_or_yes_no`, 5 `counterfactual_or_insufficient_evidence_metadata`, 1 `missing_inline_citation`, and 1 `no_structured_citations`. The run makes zero OpenAI calls, launches no GPU jobs, and leaves tracked spend at `$10.5846081` of the `$100` cap.

Tradeoff: Suppression is useful as a verifier feature but not as the core solution. It can raise support by deleting bad answers, yet it worsens the central amortized-QA objective because coverage was already too low. The next paid or GPU-backed intervention should not be a stricter abstention gate; it should train or construct longer, question-complete supported answers for the 13 answerable final-window rows without supported Qwen 7B candidates and for the 11 additional supported answers needed to reach the 70% query-level target.

### D217. Materialize a Qwen 7B v10 answer-completion repair packet before further GPU spend

Decision: Add `grounded-qa-distillation-answer-completion-repair-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-answer-completion-repair-curriculum-v10`, and validate it as a zero-cost launch candidate that targets the D215/D216 failure mode directly.

Reason: V9 span/claim supervision did not add useful supported coverage, and deterministic suppression improved support only by collapsing answer rate. The next spend-worthy intervention needs to create complete supported answers, not merely suppress incomplete ones. The packet therefore adds explicit DPO contrasts preferring full cited answers over short-but-cited fragments while preserving question-mismatch negatives, answer-over-abstain contrasts, and abstention contrasts.

Result: The packet is leakage-safe and final-window eval labels are not used for training. It writes 240 SFT train rows, 75 SFT validation rows, 546 DPO train rows, 173 DPO validation rows, and the unchanged 69 final eval prompts. The DPO train mix includes 157 answer-completion negatives, 157 question-mismatch negatives, 157 answer-over-abstain contrasts, and 75 abstention contrasts; validation includes 49/49/49/26 respectively. The final eval prompts annotate, for analysis only, the 13 answerable rows without any supported Qwen 7B candidate, the 14 v9 unsupported answer rows, and the 11 additional supported answers needed to hit the 70% query-level answer-rate target. Packet generation makes zero OpenAI calls, launches no GPU jobs, and leaves tracked spend at `$10.5846081` of the `$100` cap.

Tradeoff: This is still data-readiness evidence, not a positive model result. It is a better next GPU candidate than another gate because it attacks the observed coverage bottleneck. Before launch, run the copied dataset validator, a launch preflight, and a fresh Prime auth/price/active-pod check; after launch, judge the repaired predictions against the same support rubric and only count success if the 70% answer-rate target improves without destroying answer support.

### D218. Run Qwen 7B v10 answer-completion smoke; reject answer-completion repair as insufficient

Decision: Use the saved Prime CLI configuration and saved repo OpenAI key, run the bounded v10 answer-completion repair packet on one Massed Compute `A6000_48GB` Prime pod, repair citation syntax locally, run the integrity gate, judge with `gpt-4o`, integrate the result, and run support-failure analysis before considering any further GPU spend.

Reason: D217 created the first packet aimed directly at the v9 failure mode: short or underspecified cited answers. The project needed a real bounded model result, but under the standing `$100` total cap and without asking for secrets in chat. The launch therefore required no-spend Prime auth/wallet/active-pod checks, local packet validation, bounded SFT/DPO steps, explicit pod termination, actual Prime cost recording, and a paid judge only after the repaired predictions passed the integrity gate.

Result: Prime auth was valid from the saved CLI config, the wallet was sufficient, and there were zero active pods before launch. Pod `e732798627274837a0a07ed9279f678a` ran on Massed Compute `A6000_48GB x1`, completed `MAX_SFT_STEPS=20` plus `MAX_DPO_STEPS=10`, evaluated the 69 final-window prompts, and was terminated with zero active pods remaining. Prime history reports 19 minutes and `$0.1537` actual compute cost. Raw v10 answered 22/69 rows and abstained on 47, with 53.8% citation precision, 15.3% citation recall, 9.9% answer-token F1, 27.3% inline citation rate, and 100% valid JSON. Deterministic citation repair changed 7 rows, appended 13 inline citations, cleared 22 parse-recovery rows, and raised inline citation rate to 59.1% without changing answer rate. The repaired integrity gate marked the surface ready for paid judging. The `gpt-4o` judge made 69 calls, cost `$0.1555`, and scored v10 at 31.9% answer rate, 31.8% answer support, 97.9% abstention support, and 76.8% overall judged correctness. Integration classifies the result as `qwen3b_negative_ready_for_pareto_update`: it misses the 70% answer-rate target by 38.1 points and misses the deployable selector's answer-support target by 34.2 points. Support-failure analysis found only 7 supported answers and 15 unsupported answers; failure tags were led by 12 `unsupported_task_or_experiment`, 9 `invalid_citation_id`, 9 `too_short_or_yes_no`, 6 `missing_direct_evidence`, and 5 `counterfactual_answered`. Total tracked spend is now `$10.8938081` of the `$100` cap, leaving `$89.1061919`.

Tradeoff: This is a clean negative result, not a warrant for a blind larger-model rental. V10 improved neither coverage nor support versus the best Qwen 7B surfaces; it mostly preserved strong abstention while further collapsing useful answers. The path to a result the paper can use is still plausible, but the next iteration should be zero-cost or very tightly bounded: mine the 7 supported v10 answers against prior supported candidates, audit whether any unsupported rows are recoverable from gold evidence, and build a support-verifier or answer-planner that forces question-specific answer spans before another Prime run. If the next GPU step is justified, it should be launched only after a pre-registered failure-mode audit shows a concrete new source of supported answer candidates, not merely because more capacity is available.

### D219. Audit whether v10 added candidate-pool headroom before any new GPU spend

Decision: Add `grounded-qa-distillation-qwen7b-v10-postmortem-audit.mjs`, materialize `qwen7b-v10-postmortem-audit-2026-06-28-v1`, and wire it into the grounded-QA validator as a zero-cost gate before another Prime launch.

Reason: D218 judged v10 as a standalone negative result, but the important next question was whether v10 at least added new supported candidates that a future verifier/selector could exploit. If v10 expanded the candidate pool, the next step could be selector work. If it did not, another selector or larger blind GPU run would be working with the same coverage ceiling.

Result: The audit reuses existing v4-v10 predictions, paid `gpt-4o` judgments, the v10 support-failure rows, and the v4-v9 answer-form audit. It makes zero OpenAI calls, launches no GPU job, and leaves tracked spend at `$10.8938081` of the `$100` cap. V10 has only 7 supported answers, and it adds 0 unique supported answers over the existing v4-v9 Qwen 7B pool. It fills 0 of the v4-v9 oracle-gap answerable rows. The expanded v4-v10 oracle remains exactly 38/69 answered, or 55.1% answer rate, with 0 supported-answer delta from v4-v9. Thirteen answerable final-window rows still have no supported Qwen 7B candidate, and the candidate pool is still 18 supported answerable candidates short of the 70% query-level answer-rate target. V10 also lost 31 prior supported answer opportunities as a standalone policy and still answered 6 counterfactual rows.

Tradeoff: This blocks the tempting but weak path of renting a bigger GPU immediately. The evidence now says v10 did not create new candidate-pool headroom; the next useful work is a zero-cost oracle-gap repair audit over the 13 remaining answerable rows without supported Qwen 7B candidates, separating rows with recoverable gold spans from rows that need different retrieval/evidence packaging or multi-hop answer planning. Only after that audit identifies a concrete new supported-candidate source should another GPU run be launched.

### D220. Audit the remaining Qwen 7B oracle-gap rows; target table/metric and multi-evidence repair

Decision: Add `grounded-qa-distillation-oracle-gap-repair-audit.mjs`, materialize `oracle-gap-repair-audit-qwen7b-v4-v10-2026-06-28-v1`, and validate it as a zero-cost prerequisite for any future Qwen LoRA packet.

Reason: D219 showed v10 added no supported candidate-pool headroom. The remaining question was what kind of supervision could plausibly create the missing 13 supported answerable candidates. A blind next GPU run would be weak unless the oracle-gap rows show recoverable training targets that can be represented in training-only analogs without leaking final-window labels.

Result: The audit covers the 13 answerable final-window rows that still have no supported Qwen 7B candidate across v4-v10. It makes zero OpenAI calls, launches no GPU job, and keeps tracked spend at `$10.8938081` of the `$100` cap. The status is `oracle_gap_partly_recoverable_with_planning`: 4 rows have high single-evidence span recoverability, 3 have partial recoverability, and 6 have low lexical recoverability. All 13 rows are table/metric/numeric answer cases, 6 require multi-evidence reference answers, 3 are explanatory or synthesis questions, 3 contain partial Qwen attempts, and only 1 was abstained by all Qwen policies. The audit therefore marks GPU launch as not ready and recommends a mixed repair curriculum that separates extractive span planning from table/metric normalization and multi-evidence claim composition before another LoRA run.

Tradeoff: This changes the next packet design. The previous answer-completion packet was too generic: it taught "longer complete answers" but not exact table/metric extraction or multi-evidence composition. The next spend-worthy packet should be built from training-window analogs of these families, with explicit numeric/table span copying, cited claim-table planning, and hard negatives for plausible but wrong metric spans. It must not use final-window labels for training; the 13 gap rows are diagnostic only.

### D221. Materialize a mixed metric/table and multi-evidence repair packet

Decision: Add `grounded-qa-distillation-mixed-metric-repair-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-mixed-metric-repair-curriculum-v11`, copy the bounded Qwen 7B runner scaffold, and add a validator for the new packet family before any Prime launch.

Reason: D220 showed the remaining Qwen 7B coverage gap is dominated by table/metric/numeric extraction and multi-evidence composition, not generic answer completion. The next GPU candidate therefore needs explicit training-window analogs of those failures: wrong numeric/table span negatives, incomplete metric fragment negatives, and single-evidence fragments rejected in favor of multi-evidence cited answers. The final-window oracle-gap labels remain diagnostic only.

Result: The v11 packet is leakage-safe and local/deterministic. It writes 240 SFT train rows, 75 SFT validation rows, 631 DPO train rows, 194 DPO validation rows, and the unchanged 69 final eval prompts. Train DPO includes 157 wrong metric/table span negatives, 157 incomplete metric fragment negatives, 77 multi-evidence fragment negatives, and 83 abstention contrasts; validation includes 49/49/21/26 respectively. The packet records D220 diagnostic targets for evaluation only: 13 oracle-gap rows, all 13 table/metric/numeric, and 6 multi-evidence. The copied packet dataset validator passes, `bash -n` passes for the smoke scripts, and `grounded-qa-distillation-validate.mjs` now validates the v11 packet family. This made zero OpenAI calls, launched no GPU jobs, and leaves tracked spend at `$10.8938081` of the `$100` cap.

Tradeoff: V11 is only packet-readiness evidence, not a model result. It is materially better aligned with the current failure mode than v10, but a bounded Prime smoke is still required before claiming any quality improvement. Before launch, run fresh Prime auth/wallet/active-pod checks, live price selection, packet validation, and the budget gate; after launch, apply citation repair, integrity gate, paid judge, result integration, and support-failure/postmortem audits exactly as with v10.

### D222. Run Qwen 7B v11 mixed-metric smoke; treat as candidate-pool progress but not acceptance

Decision: Run the bounded v11 mixed-metric packet on a Massed Compute `A6000_48GB` Prime pod, fetch artifacts, terminate the pod, record actual compute cost, apply citation repair, run the integrity gate, judge with `gpt-4o`, integrate the result, and run support-failure analysis.

Reason: D221 created the first packet directly aligned to the D220 residual gap: exact table/metric/numeric extraction and multi-evidence claim planning. The only way to test whether that signal creates new supported candidates is a bounded Qwen 7B smoke under the standing budget guard.

Result: Prime auth and wallet checks passed, active pods were zero, and live A6000 availability included Massed Compute `A6000_48GB` at `$0.54/hour`. Pod `ba06aa6088e04566ac2ae38d952e1900` ran `MAX_SFT_STEPS=20` and `MAX_DPO_STEPS=10`, completed evaluation, and was terminated with zero active pods remaining. Prime history reports 22 minutes and `$0.1841` actual compute cost. Raw v11 answered 44/69 rows for 63.8% answer rate, with 61.2% citation precision, 50.6% citation recall, 26.6% answer-token F1, 100% valid JSON, and 0% inline citation rate. Deterministic citation repair changed 37 rows, appended 53 inline citations, cleared 9 parse-recovery rows, and raised inline citation rate to 84.1%. The integrity gate passed with 44 answered rows. The paid `gpt-4o` judge made 69 calls and cost `$0.1382725`; judged v11 reached 43.2% answer support, 100.0% abstention support, and 63.8% overall judged correctness. Result integration classifies the run as `qwen3b_negative_ready_for_pareto_update`. Support-failure analysis found 19 supported answers and 25 unsupported answers, with failure tags led by 15 `unsupported_task_or_experiment`, 14 `missing_direct_evidence`, 12 `too_short_or_yes_no`, 9 `counterfactual_answered`, 8 `unsupported_context_or_annotation`, and 7 `invalid_citation_id`. A zero-cost candidate-pool check shows v11 adds 2 unique supported non-counterfactual answerable candidates over v4-v10, raising the oracle from 38/69 to 40/69, still only 58.0% answer rate. Total tracked spend is now `$11.2161806` of the `$100` cap, leaving `$88.7838194`.

Tradeoff: V11 is not a paper-ready result and should not be promoted as the final amortized answerer: the higher answer rate bought too many unsupported answers. But unlike v10, it did add two genuinely new supported answerable candidates, so the mixed metric/table signal is not useless. The next step should not be another unconstrained generation run; it should train or construct a support-aware selector/verifier over v4-v11 candidates, with special attention to suppressing counterfactual answers and short/unsupported task-description answers while retaining the two new supported metric candidates.

### D223. Audit the expanded final-window candidate pool before another GPU run

Decision: Add `grounded-qa-distillation-expanded-candidate-pool-audit.mjs` and materialize `expanded-candidate-pool-audit-final-window-v1` as a zero-cost audit over already-judged direct-mini, risk-gate, claim-guard, Qwen 3B, and Qwen 7B final-window candidates.

Reason: D222 showed v11 is a standalone negative result but adds two new supported candidates. Before renting another Prime GPU, the project needed to know whether a support-aware selector/verifier over all existing candidates could already reach the acceptance region, or whether the underlying candidate pool still lacks enough supported answers.

Result: The audit reads existing prediction and `gpt-4o` judge artifacts only; it makes zero OpenAI calls, launches no GPU job, and leaves tracked spend at `$11.2161806` of the `$100` cap. On the 69-example final window, the expanded judged oracle across all candidates answers 45 rows with 100.0% answer support and 100.0% abstention support, but that is only a 65.2% answer rate, below the pre-registered 70% coverage floor. The Qwen-only judged oracle answers 42 rows at 100.0% support, and Qwen candidates contribute 10 unique supported answers not supplied by the OpenAI-mini scaffold family. However, the deployable scaffold priority selector still answers 42 rows with 73.8% answer support and 82.6% overall judged correctness, while a naive deployable heuristic selector answers all 69 rows but drops answer support to 52.2%.

Tradeoff: The candidate pool has useful support signal, but selection alone is not enough. The hindsight oracle proves that a perfect verifier would improve support, yet it still misses the 70% query-level coverage target; the deployable heuristic proves that evidence-overlap features alone are too weak. The next intervention should create new supported candidates for the missing final-window answerable cases, using support-targeted answer planning or label construction, before spending on another GPU run. A selector/verifier remains necessary, but it should be trained against a stronger candidate generator rather than expected to rescue the current pool.

### D224. Build support-targeted planning labels before a v12 GPU packet

Decision: Add `grounded-qa-distillation-support-targeted-planning-packet.mjs`, materialize `support-targeted-planning-packet-v12`, and validate it as a zero-cost planning-label packet rather than an immediately launchable adapter packet.

Reason: D223 showed that even the expanded judged oracle over all existing candidates reaches only 45/69 supported answers, below the 70% answer-rate floor. The eight answerable rows with no supported candidate are not random: they include yes/no polarity, list extraction, metric/count extraction, and multi-evidence claim composition. Another adapter run is only justified if earlier, leakage-safe windows contain enough analogs for those exact answer styles.

Result: The packet uses rows 0-160 for training, rows 160-320 for validation after removing final-window paper overlap, and the eight final-window missing-supported-candidate rows as diagnostic eval prompts only. It makes zero OpenAI calls, launches no GPU job, and leaves tracked spend unchanged at `$11.2161806` of the `$100` cap. The missing final-window profile has 3 yes/no, 3 numeric/metric, 3 list, and 3 multi-evidence rows. The planning packet writes 147 train SFT rows, 257 train DPO rows, 141 validation SFT rows, 237 validation DPO rows, and 8 diagnostic eval prompts. Coverage is adequate for a next packet merge: train has 20 yes/no, 42 numeric, 40 list, and 49 multi-evidence SFT analogs; validation has 7 yes/no, 51 numeric, 46 list, and 49 multi-evidence SFT analogs. DPO contrasts include incomplete/fragments, wrong-evidence answers, yes/no polarity inversions, and plausible unsupported answers for abstention rows. The grounded-QA validator now enforces the packet's zero-cost status, leakage guard, diagnostic-only final prompts, output planning schema, and analog-count thresholds.

Tradeoff: This is the right next data-construction direction, but it is not a result and not yet a launch packet. The immediate next step is to merge these planning labels into a bounded Qwen v12 training/eval packet with the existing runner scaffold, then run local packet validation and Prime/budget preflight. A GPU launch should happen only after that merge is validated; the acceptance criterion remains unchanged: supported answer coverage must move past the 70% floor without reintroducing unsupported answers.

### D225. Run Qwen 7B v12 support-targeted planning smoke; reject planning merge as standalone answerer

Decision: Add `grounded-qa-distillation-support-targeted-launch-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12`, run the bounded Prime smoke, record actual compute spend, apply citation repair, run the integrity gate, judge with `gpt-4o`, integrate the result, and run support-failure analysis.

Reason: D224 established that the remaining no-supported-candidate final-window rows have enough leakage-safe train/validation analogs for yes/no polarity, list extraction, numeric/metric extraction, and multi-evidence answer planning. The next test was whether merging those planning labels into the v11 mixed-metric packet could create supported answer coverage, not just more answer attempts.

Result: The v12 launch packet merges the v11 bounded runner scaffold with the flattened support-targeted planning labels while preserving the standard answer JSON output contract; `answer_plan` is used only as prompt-side training guidance and is stripped from assistant targets. It writes 387 SFT train rows, 216 SFT validation rows, 888 DPO train rows, 431 DPO validation rows, and the unchanged 69 final eval prompts, including 147 added planning SFT train rows and 257 added planning DPO train rows. Prime auth was valid from the saved CLI config, active pods were zero, and a Massed Compute `A6000_48GB` pod `3721f74c698a4388bf42f7d7238965ba` completed `MAX_SFT_STEPS=20` plus `MAX_DPO_STEPS=10` before termination. Prime history records 21 minutes and `$0.1718` actual compute cost. Raw v12 answered 41/69 rows, with 48.6% citation precision, 22.7% citation recall, 29.3% answer-token F1, and 100% valid JSON. Local citation repair changed 21 rows, repaired 30 inline citations, dropped one invalid citation, cleared 16 parse-recovery rows, and raised inline citation rate to 53.7%. The integrity gate passed with 69/69 prediction rows and no failures. The paid `gpt-4o` judge made 69 tracked calls costing `$0.13758`; judged v12 reached 59.4% answer rate, 26.8% answer support, 100.0% abstention support, and 56.5% overall judged correctness. Result integration classifies it as `qwen3b_negative_ready_for_pareto_update`. Support-failure analysis found 11 supported answers and 30 unsupported answers; failure tags are led by 25 `unsupported_task_or_experiment`, 19 `invalid_citation_id`, 11 `missing_direct_evidence`, 11 `too_short_or_yes_no`, and 9 `counterfactual_answered`. The expanded candidate-pool audit with v12 still reaches only 45/69 supported answers, or 65.2% answer rate, under a judged oracle; v12 contributes one oracle-selected Qwen 7B candidate but does not raise the prior oracle ceiling. Total tracked spend is now `$11.5255606` of the `$100` cap, leaving `$88.4744394`.

Tradeoff: V12 is a useful negative result because it tested the exact planning-label hypothesis under bounded spend, but it should not be promoted as an amortized grounded-QA success. Planning hints increased answer form and token overlap versus earlier low-coverage runs, but they did not produce support-preserving answers and regressed from v11 on judged support. Larger GPUs or frontier models are not justified by this run alone; the current pain point is supervision/verification quality, not just model capacity. The next path should be zero-cost before any further GPU rental: separate true invalid-citation judge artifacts from model citation bugs, build a fail-closed support verifier or evidence selector around candidate generation, and only then consider a larger model if the verifier shows that capacity rather than label construction is the bottleneck.

### D226. Treat v12 invalid judgments as model contract failures, not judge artifacts

Decision: Add `grounded-qa-distillation-support-contract-audit.mjs`, materialize `support-contract-audit-qwen7b-support-targeted-v12-2026-06-28-v1`, and wire support-contract audits into the grounded-QA validator.

Reason: D225's paid judge reported a high 27.5% invalid-judgment rate. Before changing the judge prompt or spending on another GPU run, the project needed to determine whether those invalid verdicts came from malformed judge behavior or from the model violating the citation contract in ways the judge correctly rejected.

Result: The audit makes zero OpenAI calls and launches no compute. It deterministically joins the v12 repaired predictions, `gpt-4o` judgments, and final-window evidence packs. All 19 invalid answered judgments are explained by model-side contract failures, so the audit status is `contract_failures_explain_invalid_judgments`. Among 41 answered rows, only 22 have any top-level citations and all 22 are valid; the other 19 invalid rows are missing top-level citations. Inline citations show the same 22/41 present pattern. Claim-table citations are worse: only 9/41 answered rows include claim-table citations, and 32/41 omit them. Invalid-judgment tags are led by 19 `missing_top_level_citations`, 19 `missing_inline_citations`, 19 `unsupported_task_or_experiment`, 14 `missing_claim_table_citations`, 8 `too_short_or_yes_no`, and 4 `counterfactual_answered`.

Tradeoff: This rules out the cheap explanation that v12 only needs a judge-prompt repair. The model is still failing the core output contract before support can be reliably assessed. The next artifact should be a deterministic pre-judge contract gate or a contract-complete candidate selector that suppresses any answer missing top-level, inline, and claim-table citations before paid judging. Another Prime run is not justified until that gate shows it can retain supported answers while dropping invalid/counterfactual answers.

### D227. Use answer-level citation contract gating as a safety layer, not the final scaffold

Decision: Add `grounded-qa-distillation-support-contract-gate.mjs`, materialize both `support-contract-gate-qwen7b-support-targeted-v12-2026-06-28-v1` and `support-contract-gate-answer-citations-qwen7b-support-targeted-v12-2026-06-28-v1`, and validate support-contract gate artifacts.

Reason: D226 showed the invalid v12 rows are model-side contract failures, but the strictest possible gate might be too brittle because many otherwise supported answers omit claim-table citations. Before another GPU run, the project needed to know whether deterministic contract gating can be a deployable scaffold or only a diagnostic.

Result: Both gate runs make zero OpenAI calls and launch no compute. The strict gate requires valid top-level, inline, and claim-table citations plus citation-channel consistency. It raises answer support from 26.8% to 50.0% and overall correctness from 56.5% to 62.3%, but collapses answer rate from 59.4% to 2.9%, suppresses 39 answers, and drops 6 supported answers. The relaxed answer-citation gate requires valid top-level and inline citations while ignoring claim-table completeness. It is cleaner: answer support rises from 26.8% to 53.8%, overall correctness rises from 56.5% to 71.0%, and it suppresses 28 answers without dropping any supported answers. However, answer rate still collapses to 18.8%, with only 7 supported answers retained and 14 answerable rows suppressed.

Tradeoff: The answer-citation gate is a useful pre-judge safety layer and training diagnostic: it removes invalid/counterfactual answers without harming already supported answers. It is not a final amortized grounded-QA policy because coverage is far below the 70% floor. The next change should not be a larger GPU run; it should create or select contract-complete answers for answerable rows that the gate suppresses, likely by mixing the answer-citation gate with the expanded candidate pool and only falling back to abstention when no contract-complete supported candidate exists.

### D228. Test contract-aware selection over the expanded pool; candidate selection remains weak

Decision: Add `grounded-qa-distillation-contract-aware-candidate-selector.mjs`, materialize `contract-aware-candidate-selector-final-window-v1`, and validate contract-aware selector artifacts.

Reason: D227 showed answer-level citation gating is a useful safety layer but collapses v12 coverage. The next zero-cost question was whether the broader candidate pool already contains enough answer-citation-complete answers that a simple deployable selector can recover coverage without per-query LLM verification.

Result: The selector reads existing final-window predictions and paid judgments only; it makes zero OpenAI calls and launches no compute. The deployable-style heuristic selector requires valid top-level and inline citations, excludes counterfactual metadata, and chooses by retrieval/inline/valid-citation heuristic score. It answers 47/69 rows, or 68.1%, with 61.7% answer support and 73.9% overall judged correctness. That is close to but still below the 70% answer-rate floor, and it misses the 66% answer-support target. It also underperforms the existing scaffold priority selector on answer support and overall correctness. The contract judged oracle answers only 36/69 rows after enforcing answer-citation completeness and counterfactual suppression, but reaches 100% support; the gap from heuristic to oracle is 7 supported answers and 26.1 correctness points. This means selection quality is still weak even where candidates exist.

Tradeoff: This is not a paper-ready amortized result. It does show that contract-aware selection almost reaches the coverage floor without new model calls, but simple lexical/retrieval heuristics pick too many unsupported answers. The next useful intervention is a trained or calibrated verifier/selector over contract-complete candidates, using existing judged windows as labels, before any additional Prime GPU run. A larger generator may eventually be needed, but the immediate bottleneck is selecting supported contract-complete candidates.

### D229. Train a zero-call contract selector; reject simple logistic verifier transfer

Decision: Add `grounded-qa-distillation-trained-contract-selector.mjs`, materialize `trained-contract-selector-240-320-to-321-389-v1`, and validate trained contract selector artifacts.

Reason: D228 showed a hand-built contract-aware heuristic nearly reached the coverage floor but selected too many unsupported answers. The next no-spend test was whether a lightweight verifier trained on existing `gpt-4o` judgments from examples 241-320 could transfer to the final 321-389 window and select supported contract-complete candidates without paid per-query verification.

Result: The selector trains a local logistic verifier over the earlier judged scaffold candidates and applies it to the final expanded candidate pool, including Qwen candidates. It makes zero OpenAI calls and launches no compute. The result is negative. On the final window, the trained selector answers 36/69 rows, or 52.2%, with only 27.8% answer support and 62.3% overall judged correctness. It underperforms the existing scaffold priority selector, which answers 42/69 rows with 73.8% answer support and 82.6% overall correctness. The trained selector also underfits its training window, tuning itself into near-total abstention: only 3/80 train rows answered. The final-window oracle over the same contract-complete candidates still has 36 supported answers and 100% correctness, so the issue is not merely absence of supported contract-complete candidates; this simple logistic feature set and label source fail to select them.

Tradeoff: This closes off the obvious cheap verifier path. A more serious selector would need richer supervision or a stronger model-judge/verifier signal, but that risks returning to per-query LLM calls. Before spending again, the project should audit the 26 oracle-supported answers missed by the trained selector and decide whether the missing signal is semantic entailment, answerability calibration, or distribution shift from scaffold-only train labels to Qwen eval candidates.

### D230. Audit trained-selector misses; identify family-prior and score miscalibration

Decision: Add `grounded-qa-distillation-trained-selector-miss-audit.mjs`, materialize `trained-selector-miss-audit-contract-selector-240-320-to-321-389-v1`, and validate trained-selector miss audits.

Reason: D229 showed the trained selector missed 26 oracle-supported final-window answers. The project needed to know whether the misses were caused by missing candidates, answer-vs-abstain calibration, Qwen/scaffold distribution shift, or generic verifier-score miscalibration before attempting another selector or spending on a stronger verifier.

Result: The audit makes zero OpenAI calls and launches no compute. It compares the trained selector's final-window choices against the contract oracle. The status is `verifier_score_miscalibration_dominates`: all 26 missed supported answers had an unsupported answer-citation-complete candidate scored above the oracle-supported candidate. The dominant family pattern is also clear: 20/26 misses are `qwen_over_supported_scaffold`, while the oracle-supported candidate is an OpenAI-mini scaffold answer in 21/26 cases. The selected family distribution on misses is 14 Qwen 3B, 11 Qwen 7B, and only 1 OpenAI-mini scaffold; the oracle family distribution is 21 OpenAI-mini scaffold, 4 Qwen 7B, and 1 Qwen 3B. Most misses had multiple supported candidates available: 22/26 are tagged `many_supported_candidates_available`. Nine misses selected abstention over a supported answer, but the larger failure is unsupported answer over supported answer.

Tradeoff: This says the next selector should not simply add more lexical features. It needs explicit family/source calibration and a penalty for short unsupported Qwen-style answers, or it should prefer the existing scaffold priority answer when Qwen candidates do not add strong independent evidence. The immediate next zero-cost experiment is a calibrated hybrid selector that starts from the scaffold priority baseline and only switches to Qwen when the Qwen candidate clears stronger contract, length, and support-proxy margins.

### D231. Calibrated hybrid selector clears local thresholds but is not yet amortized

Decision: Add `grounded-qa-distillation-calibrated-hybrid-selector.mjs`, materialize `calibrated-hybrid-selector-final-window-v1`, and validate calibrated hybrid selector artifacts.

Reason: D230 showed the trained verifier failed by letting Qwen candidates displace supported scaffold answers. The next zero-cost test was a conservative hybrid policy: start from the scaffold priority selector and only switch from a scaffold abstention to a Qwen answer when the Qwen candidate is answer-citation-complete, non-counterfactual, at least five content tokens, and has heuristic score at least 0.60.

Result: The calibrated hybrid makes zero OpenAI calls and launches no compute. It is the first local selector surface to clear the pre-registered 70% answer-rate and 66% answer-support thresholds on the final window: 49/69 answered, 71.0% answer rate, 71.4% answer support, and 79.7% overall judged correctness. It switches 7 scaffold abstentions to Qwen answers; 4 switches are supported and 3 are unsupported. Compared with scaffold priority, it gains 10.1 answer-rate points and 4 supported answers, but loses 2.4 answer-support points and 2.9 overall-correctness points. The Qwen switch oracle shows a small remaining gap: one additional answer and four additional supported answers are possible under perfect switching.

Tradeoff: This is useful progress, but it is not a final amortized grounded-QA result. The candidate pool still includes OpenAI-mini scaffold candidates, so the surface is not a small-model-only deployment. The hybrid also sacrifices some correctness relative to the safer scaffold priority baseline. The next step should be to convert this into an amortization story: either distill the hybrid policy into a smaller zero-call selector/student, or build a Qwen-only version of the same conservative switch policy and measure how much of the positive result survives without OpenAI-mini candidates.

### D232. Qwen-only deployment pool has a coverage ceiling, not just a selector problem

Decision: Add `grounded-qa-distillation-qwen-only-amortization-diagnostic.mjs`, materialize `qwen-only-amortization-diagnostic-final-window-v1`, and validate Qwen-only amortization diagnostics.

Reason: D231 cleared the local answer-rate/support thresholds only by retaining 62 OpenAI-mini scaffold selections and switching 7 scaffold abstentions to Qwen. To decide whether the project had a credible small-model-only deployment path, the next zero-cost diagnostic removed OpenAI-mini scaffold candidates from the selectable pool and evaluated both a conservative Qwen-only heuristic and a judged Qwen-only oracle.

Result: The diagnostic makes zero OpenAI calls and launches no compute. With the same 0.60 heuristic-score and five-token answer threshold used by the calibrated hybrid, the Qwen-only heuristic answers 38/69 rows, or 55.1%, with 65.8% answer support, 100.0% abstention support, and 81.2% overall judged correctness. A higher-precision 0.70 threshold reaches 82.4% answer support and 94.2% overall correctness, but answers only 17/69 rows. The judged Qwen-only oracle answers only 35/69 rows, or 50.7%, even though every answer it selects is supported and every abstention is supported. The Qwen pool has candidates for all 69 rows and answer-citation-complete answers for 67 rows, but only 35 non-counterfactual rows contain a supported Qwen answer. This means the failure is not merely threshold tuning: under the current Qwen candidate pool, the small-model-only oracle is 19.3 answer-rate points below the 70% floor.

Tradeoff: This rules out promoting the calibrated hybrid as an amortized small-model-only result. It also argues against spending Prime budget on another selector-only run: a perfect Qwen selector over the current pool still cannot meet the coverage target. The next useful path is a generator/data intervention that makes Qwen produce supported answers for the missing answerable rows, or a distilled scaffold that explicitly learns from the OpenAI-mini scaffold traces while eliminating paid calls at inference. Any further GPU rental should be tied to that generator/data objective, not generic larger-model exploration.

### D233. Build leakage-safe scaffold packet for Qwen-only coverage gaps

Decision: Add `grounded-qa-distillation-qwen-coverage-gap-scaffold-packet.mjs`, materialize `qwen-coverage-gap-scaffold-packet-v13`, and validate Qwen coverage-gap scaffold packets.

Reason: D232 showed the current Qwen-only deployment pool has a generator/data ceiling: the judged Qwen oracle answers only 35/69 final-window rows and misses 9 answerable rows. A selector-only GPU run cannot fix absent supported answers. The next zero-cost move was to convert those 9 misses into target answer-style profiles, then build leakage-safe train/validation scaffold labels from earlier windows with matching yes/no, numeric, list, and multi-evidence behavior.

Result: The packet makes zero OpenAI calls and launches no compute. It uses rows 0-160 for training and rows 160-320 for validation, filtering validation rows that share final-eval papers. Final rows 321-389 are diagnostic prompts only; final labels are not used for training. The 9 Qwen-oracle misses contain 3 yes/no, 4 numeric, 5 list, and 4 multi-evidence targets. After leakage filtering, the packet writes 147 SFT train rows, 142 SFT validation rows, 257 DPO train rows, 239 DPO validation rows, and 9 Qwen-miss diagnostic eval prompts. Analog coverage is sufficient for a launch-packet merge: train has 20 yes/no, 42 numeric, 42 list, and 49 multi-evidence SFT rows; validation has 7 yes/no, 53 numeric, 48 list, and 49 multi-evidence SFT rows. The DPO rows prefer complete cited scaffold/reference answers or abstentions over fragments, wrong-evidence answers, yes/no polarity inversions, and plausible over-answers.

Tradeoff: This is not model-quality evidence yet. It is a validated data-construction artifact that directly targets the Qwen-only oracle coverage shortfall while preserving temporal leakage constraints. The next step should be a bounded v13 launch packet merge and Prime/budget preflight; GPU rental is justified only after that merge passes packet-quality checks and the projected total remains under the $100 cap.

### D234. Merge Qwen coverage-gap scaffold packet into bounded v13 launch packet

Decision: Add `grounded-qa-distillation-qwen-coverage-gap-launch-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13`, and validate the launch packet locally before any Prime spend.

Reason: D233 produced a leakage-safe scaffold-distillation packet targeted at the 9 answerable final rows where the Qwen-only oracle lacks a supported answer. The next step was to merge those labels into the existing bounded Qwen 7B joint-action runner while keeping the final 69 eval prompts unchanged and keeping the 9 Qwen-miss prompts diagnostic-only.

Result: The launch packet makes zero OpenAI calls and launches no compute. It uses the v12 support-targeted Qwen 7B packet as the runner template, adds the v13 scaffold-gap labels, and preserves the standard answer JSON output contract. The merged packet writes 534 SFT train rows, 358 SFT validation rows, 1,145 DPO train rows, 670 DPO validation rows, and the unchanged 69 final eval prompts. It adds 147 scaffold SFT train rows and 257 scaffold DPO train rows over the v12 base. The generated dataset validator passes, bash syntax checks pass for the smoke and Prime scripts, Prime auth can list pods with zero active pods, and the grounded-QA artifact validator passes. The projected total spend after a bounded smoke is `$15.525560600000022`, under the `$100` cap.

Tradeoff: This packet is ready for bounded GPU smoke after live preflight, but it is not model-result evidence. The next action can be a constrained Prime run only if a live GPU price/availability check still keeps projected total spend under budget and the run command preserves `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`.

### D235. Run Qwen 7B v13 coverage-gap scaffold smoke; reject as standalone generator

Decision: Use the saved Prime CLI configuration and saved OpenAI key without asking for new secrets, run the bounded v13 Qwen coverage-gap scaffold packet on Massed Compute `A6000_48GB`, record both the failed artifact-loss attempt and successful rerun, apply deterministic citation repair, run integrity and support-contract gates, judge with `gpt-4o`, integrate the result, and run support-failure analysis.

Reason: D234 made the v13 packet launch-ready under the `$100` total cap. D232-D233 identified a generator/data ceiling in the Qwen-only pool, so this run tested whether scaffold labels targeted at Qwen-only coverage gaps could create more supported final-window answers rather than merely selecting existing candidates.

Result: Live Prime preflight found zero active pods and Massed Compute `A6000_48GB` availability at `$0.54/hr`. The first pod `c1b3e2f0d378405393e0ad564dc636c6` completed the bounded smoke but was terminated before artifacts were copied; the lost run is recorded as failed-after-artifact-loss with `$0.1781` actual compute cost. The replacement pod `a6b60cc56ca1466fb7c20156e148c952` completed the same bounded smoke, artifacts were fetched before termination, and `$0.1438` actual compute cost was recorded. Raw v13 answered 52/69 rows with 56.0% citation precision, 44.9% citation recall, 35.7% answer-token F1, 3.8% inline citation rate, and 100% valid JSON. Citation repair changed 33 rows, repaired 51 inline citations, dropped 3 invalid citations, cleared 15 parse-recovery rows, and raised inline citation rate to 67.3%. The integrity gate passed with 69/69 prediction rows and no failures. The paid `gpt-4o` judge made 69 tracked calls costing `$0.134745`; repaired v13 reached 75.4% answer rate, 40.4% answer support, 100.0% abstention support, 55.1% overall judged correctness, and 24.6% invalid judgment rate. Result integration classifies it as `qwen3b_negative_ready_for_pareto_update`. Support-failure analysis found 21 supported answers and 31 unsupported answers; failure tags were led by 19 `unsupported_task_or_experiment`, 17 `invalid_citation_id`, 13 `missing_direct_evidence`, 12 `counterfactual_answered`, 11 `too_short_or_yes_no`, and 10 `unsupported_context_or_annotation`. The support-contract audit shows the invalid judgments are model-side contract failures: 17/52 answered rows miss top-level and inline citations, and 34/52 miss claim-table citations. The relaxed answer-citation gate improves answer support to 68.0% and overall correctness to 73.9% without dropping supported answers, but collapses answer rate to 36.2%. Total tracked spend is now `$11.982205600000023` of the `$100` cap, leaving `$88.01779439999999`.

Tradeoff: V13 is a useful negative result. The targeted scaffold labels increased answer attempts and found more supported answers than v12, but not enough support-preserving coverage to claim amortized grounded QA. The failure is still not primarily GPU access or small-model size: the model often violates citation channels, answers counterfactual rows, or produces task/experiment claims not directly entailed by evidence. Prime remains available and affordable under the cap, but another GPU run should wait for a stronger contract-complete generator target or a distillation scaffold that teaches complete cited answers, not just broader coverage. The immediate next work should be zero-cost: compare v13 against the Qwen-only oracle and calibrated hybrid, isolate which of the 9 coverage-gap rows improved, and build the next packet from supported contract-complete deltas rather than aggregate answer rate.

### D236. Audit v13 row-level deltas before any more GPU spend

Decision: Add `grounded-qa-distillation-v13-coverage-gap-delta.mjs`, materialize `v13-coverage-gap-delta-qwen-only-hybrid-2026-06-28-v1`, and use it as the next-packet gate before another Prime launch.

Reason: D235 showed v13 was negative in aggregate, but the next action depended on whether it nevertheless filled the nine Qwen-only oracle coverage gaps targeted by D233-D234, added useful candidates for the calibrated hybrid, or simply produced unsupported extra answers. That distinction should be answered with existing prediction, judge, selector, and contract-audit artifacts before spending on another GPU run.

Result: The delta audit makes zero OpenAI calls and launches no compute. It compares v13 with the qwen-only heuristic, qwen-only judged oracle, scaffold-priority selector, calibrated hybrid, and scaffold-plus-v13 switch policies. The result is `v13_no_gap_fill_negative`: v13 answers 5 of the 9 targeted coverage-gap rows but supports 0 of them, adds 0 non-counterfactual supported answers beyond the prior Qwen-only oracle, and fails to reproduce 18 of the prior Qwen-only oracle supported answers. As a candidate source for the scaffold-priority baseline, v13 supplies only 2 non-counterfactual supported answers where the scaffold abstained. A scaffold-plus-v13 answer-citation gate answers 45/69 rows with 33 supported answers, 73.3% answer support, and 82.6% overall correctness; a scaffold-plus-v13 oracle answers 44/69 rows with 33 supported answers and 84.1% overall correctness. Both are below the existing calibrated hybrid's 49/69 answered rows and 35 supported answers, and below the prior qwen-switch oracle's 39 supported answers. Tracked spend remains `$11.982205600000023` of the `$100` cap.

Tradeoff: This removes the justification for another immediate Qwen v14 coverage packet. V13's useful signal is not new coverage-gap support; it is a small set of supported, citation-complete positives plus many hard negatives where the model answered with complete-looking citations but unsupported content. The next zero-cost step should construct a supervised contrast set from those row-level deltas: keep supported non-counterfactual v13 answers as positives, treat answer-citation-complete unsupported v13 answers as hard negatives, and explicitly preserve abstention on the five targeted rows v13 answered incorrectly. GPU spend should resume only after that packet shows it changes the training target, not merely the answer-rate objective.

### D237. Build v14 support-delta supervision packet; require launch merge and preflight before GPU spend

Decision: Add `grounded-qa-distillation-v13-support-delta-packet.mjs`, materialize `v13-support-delta-supervision-packet-v14`, and wire validator coverage for v13 support-delta packets.

Reason: D236 showed v13 did not fill the targeted Qwen-only coverage gaps, but it did produce a useful diagnostic split: 17 non-counterfactual supported citation-complete answers and 14 answer-citation-complete hard negatives, plus nine targeted gap rows where v13 should not be trusted as positive supervision. The next packet needed to convert that row-level signal into leakage-safe train/validation analogs without using final-window labels as training data.

Result: The packet makes zero OpenAI calls and launches no compute. Final-window v13 rows are written only to `diagnostic_delta_rows.jsonl` with `final_window_training_use: forbidden_diagnostic_profile_only`; all SFT/DPO train and validation rows come from earlier windows with final-eval paper overlap filtered out. The packet writes 160 SFT train rows, 155 SFT validation rows, 592 DPO train rows, 574 DPO validation rows, and 39 diagnostic delta rows. The diagnostic signal contains 17 positives, 14 hard negatives, all nine targeted gap rows, and eight targeted gap failures. Active profile coverage is adequate for a launch-packet merge: train has 20 yes/no, 42 numeric, 42 list, 49 multi-evidence, and 13 direct-extractive SFT analogs; validation has 7 yes/no, 53 numeric, 48 list, 49 multi-evidence, and 13 direct-extractive SFT analogs. DPO density is high: train has 3.7 DPO rows per SFT row and validation has 3.7 DPO rows per SFT row, including wrong-evidence, missing-citation, claim-table-gap, unsupported-task-claim, fragment, yes/no polarity, and abstention-overanswer negatives. The grounded-QA validator now enforces zero spend, diagnostic-only final-window usage, leakage guards, diagnostic row counts, active-profile analog thresholds, and DPO density.

Tradeoff: This is the first post-v13 packet that genuinely changes the training target rather than reweighting coverage. It is still not model-quality evidence and does not authorize immediate GPU spend. The next step should be a bounded launch-packet merge that replaces the generic v13 coverage-gap labels with this support-delta supervision, followed by local dataset validation, Prime auth/wallet/active-pod checks, live price selection, and the `$100` budget gate before creating any pod.

### D238. Merge v14 support-delta supervision into bounded Qwen 7B launch packet

Decision: Add `grounded-qa-distillation-v13-support-delta-launch-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-v14`, and validate it as the next bounded Qwen 7B smoke packet.

Reason: D237 produced a leakage-safe support-delta supervision packet that changes the training objective away from the failed broad v13 coverage push. The next step was to merge it into the existing bounded Qwen 7B joint-action runner while preserving the final 69-example evaluation window and excluding the failed v13 coverage-gap labels from training.

Result: The launch packet makes zero OpenAI calls and launches no compute. It uses `joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12` as the dataset base and `joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13` only as the runner-script template. The failed v13 broad coverage-gap labels are not carried forward. The merged packet writes 547 SFT train rows, 371 SFT validation rows, 1,480 DPO train rows, 1,005 DPO validation rows, and the unchanged 69 final eval prompts. It adds 160 support-delta SFT train rows and 592 support-delta DPO train rows over the v12 base; 39 v13 diagnostic rows are counted but not merged. The generated dataset validator passes, bash syntax checks pass for the smoke and Prime scripts, and the grounded-QA validator now enforces the launch contract. Live non-spend preflight found Prime wallet balance `$45.95`, zero active pods, A6000 48GB availability, and tracked spend `$11.982205600000023` of the `$100` cap. The launch packet estimates `$4` for a bounded smoke, projecting `$15.982205600000023` total after smoke, under budget.

Tradeoff: This packet is ready for a bounded GPU smoke, but it is still not model evidence. The next action can be a constrained Prime run using `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`; artifacts must be copied before pod termination, actual compute spend must be ledgered immediately, and no paid judge should run until the prediction integrity gate passes.

### D239. Run bounded Qwen 7B v14 support-delta smoke; keep as negative generator evidence plus useful gate signal

Decision: Use the saved Prime token and saved OpenAI key from local secret storage, run the bounded v14 support-delta Qwen 7B packet, ledger all external compute and OpenAI calls under the shared `$100` cap, apply deterministic citation repair, run integrity/support-contract gates, judge repaired predictions with `gpt-4o`, and integrate the result.

Reason: D238 made the v14 support-delta packet launch-ready, but it still lacked model evidence. The key question was whether support-delta supervision would improve grounded answer support over the failed v13 coverage packet without needing a larger model or unbounded GPU spend.

Result: Prime authentication worked from the saved local token. Two A6000 provisioning attempts (`d6cbc9a35d084e7a98aa12b957f52378`, `05180db2b79d4126b53cf435d5886e7f`) never exposed SSH and were terminated with `$0.00` billed. The successful DataCrunch L40S pod `980e01cc4c1d488e960c4cd6c02078b4` ran the bounded smoke with `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`; artifacts were fetched before termination and the actual compute charge was `$0.14`. Raw v14 answered 51/69 rows with 54.4% citation precision, 48.9% citation recall, 38.0% answer-token F1, 1.96% inline citation rate, 60.9% answer-type accuracy, and 100% valid JSON. Citation repair changed 43 rows, repaired 60 missing inline citations, cleared 12 parse errors, and raised inline citation rate to 86.3% while preserving the 51/69 answer count. The integrity gate passed with 69/69 prediction rows and no failures. The paid `gpt-4o` judge made 69 tracked calls costing `$0.1391075`; repaired v14 reached 39.2% answer support, 100.0% abstention support, 55.1% overall judged correctness, and 10.1% invalid judgment rate. Support-failure analysis found 20 supported answers and 31 unsupported answers, led by `missing_direct_evidence` (18), `unsupported_task_or_experiment` (17), `counterfactual_answered` (12), `too_short_or_yes_no` (12), and `unsupported_context_or_annotation` (11). The strict support-contract gate improved answer support to 71.4% but collapsed answer rate to 10.1%. The relaxed answer-citation gate is the useful scaffold: it improved answer support to 55.2% and overall correctness to 72.5%, suppressed 12 unsupported answers and zero supported answers, but still reduced answer rate to 42.0%. Total tracked spend after the run is `$12.261313100000024` of the `$100` cap, leaving `$87.73868689999998`.

Tradeoff: V14 support-delta supervision did not solve the generator problem. It reduced invalid judgment rate relative to v13, but answer support remains far below the 66% target at raw coverage and the relaxed gate still misses the 70% answer-rate floor. The evidence now points away from simply renting a larger GPU for more bounded Qwen 7B variants: the dominant failures are support-contract and evidence-entailment errors, not infrastructure access. The next useful path is to treat v14 as negative generator evidence and use its answer-citation gate outcome to train or select for contract-complete supported answers, while considering a stronger teacher/verifier only if it is used to create better supervision rather than as a per-query deployment dependency.

### D240. Audit v14 support-delta outcomes against prior Qwen and hybrid selectors before more GPU spend

Decision: Add `grounded-qa-distillation-v14-support-delta-outcome-audit.mjs`, materialize `v14-support-delta-outcome-audit-2026-06-28-v1`, and add validator coverage for v14 support-delta outcome audits.

Reason: D239 showed v14 was weak as a standalone generator but had a useful answer-citation gate signal. Before building another packet or renting more GPU, the project needed to know whether v14 added supported answer coverage beyond the existing Qwen-only oracle and calibrated hybrid, or whether it only contributed hard negatives and a few scaffold-abstention recoveries.

Result: The audit makes zero OpenAI calls and launches no compute. V14 answers 51/69 rows with 20 supported answers, 39.2% answer support, and 55.1% overall judged correctness; v13 answered 52/69 with 21 supported answers and the same 55.1% overall correctness. V14 has 16 non-counterfactual supported answers versus v13's 17 and the prior Qwen-only oracle's 35. It adds three supported answers not produced by v13, but zero supported answers outside the prior Qwen-only oracle; it also fails to reproduce 19 prior Qwen-only oracle supported answers and 15 calibrated-hybrid supported answers. As a selector source, scaffold plus v14 answer-citation gating adds two supported answers and five answered rows over scaffold priority, reaching 68.1% answer rate, 70.2% answer support, and 79.7% overall correctness. But hybrid plus v14 answer-citation gating adds three answered rows and zero supported answers over the calibrated hybrid, lowering overall correctness from 79.7% to 75.4%. The audit records 24 answer-citation-complete hard negatives and 16 counterfactual rows where v14 answered instead of abstaining. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: V14 should not trigger another immediate GPU run. The small scaffold-abstention gain is real but below the 70% answer-rate floor, and the stronger calibrated hybrid is not improved by adding v14. The next useful experiment should build a verifier or repair-generator target from v14's 16 supported positives, 24 answer-citation-complete hard negatives, and 16 counterfactual over-answer failures, then test whether that target can recover the four-answer gap between the current calibrated hybrid and the Qwen-switch oracle without using final-window labels as a deployable selector.

### D241. Audit the Qwen switch frontier; simple deployable features select the wrong answers

Decision: Add `grounded-qa-distillation-qwen-switch-frontier-audit.mjs`, materialize `qwen-switch-frontier-audit-2026-06-28-v1`, and validate Qwen switch frontier audits.

Reason: D240 showed v14 does not improve the calibrated hybrid, but the existing Qwen-switch oracle still has four supported answers above the hybrid. Before training another model or spending on another GPU run, the project needed to know whether a simple deployable selector over existing Qwen candidates could recover those four oracle switches without also admitting the known harmful switches.

Result: The audit makes zero OpenAI calls and launches no compute. It isolates 12 non-counterfactual scaffold-abstention rows with answer-citation-complete Qwen answer candidates. The calibrated hybrid switches on seven rows, four supported and three unsupported, reaching 49/69 answered, 35 supported answers, 71.4% answer support, and 79.7% overall correctness. The Qwen-switch oracle switches on eight rows, reaches 50/69 answered, 39 supported answers, 78.0% answer support, and 84.1% overall correctness. The four oracle-supported switches missed by the hybrid are real headroom, but the deployable feature audit is negative: their heuristic scores range from 0.30 to 0.60 and answer lengths from 1 to 22 tokens, while the harmful hybrid switches have higher heuristic scores from 0.611 to 0.668 and longer answers from 25 to 39 tokens. A threshold sweep across score, answer length, family, and yes/no filters cannot recover any of the missed supported oracle switches while preserving the current 70% answer-rate operating point; the best diagnostic sweep reproduces the existing calibrated hybrid exactly. Status is `frontier_requires_stronger_verifier`.

Tradeoff: This closes off another cheap hand-threshold path. The problem is semantic support selection among contract-complete Qwen candidates: unsupported overclaims look better to the current lexical/retrieval heuristic than short, supported answers. The next useful work should train or construct an entailment-aware verifier/repair target from existing judged positives, v14 hard negatives, and counterfactual over-answer failures, then validate it cross-window before any additional GPU run.

### D242. Build a support-ranker pairwise packet; block GPU ranker training until signal density improves

Decision: Add `grounded-qa-distillation-support-ranker-pairwise-packet.mjs`, materialize `support-ranker-pairwise-packet-2026-06-28-v1`, and add validator coverage for support-ranker pairwise packets.

Reason: D241 showed that simple deployable features select the wrong Qwen switch candidates. Before renting more Prime GPU time or training a verifier, the project needed to know whether existing judged pre-final candidates contain enough supported-vs-unsupported answer pairs to train an answer-support ranker without leaking final-window labels.

Result: The packet makes zero OpenAI calls and launches no compute. It mines existing judged candidate variants from the 160-240 train window and 240-320 validation window, then writes final-window Qwen switch frontier pairs only as `forbidden_diagnostic_only` rows. The result is `pairwise_signal_present_but_sparse`: only 4 train pair rows and 6 validation pair rows exist from non-final windows, while the final diagnostic frontier has 61 pairs across 8 examples. The final rows are useful for understanding the target failure mode but cannot be used as training supervision. Total tracked spend remains `$12.261313100000024` of the `$100` cap, leaving `$87.73868689999998`.

Tradeoff: This answers the immediate "should we rent GPU and train a ranker now?" question with no. The current bottleneck is not Prime access or foundation-model size; it is insufficient leakage-safe verifier supervision. The next useful work is to generate or mine more non-final candidate diversity with tracked support judgments until the packet has at least 50 train pairs and 20 validation pairs, then train a small verifier/ranker or launch a bounded GPU run under the remaining budget.

### D243. Expand the support-ranker packet from existing non-final judged windows

Decision: Extend `grounded-qa-distillation-support-ranker-pairwise-packet.mjs` with an `expanded` source plan and materialize `support-ranker-pairwise-packet-expanded-2026-06-28-v1`.

Reason: D242 found too few pairwise rows only because the packet used a narrow source set. Before spending on new OpenAI judgments or Prime GPU time, the project needed to mine all already-judged, leakage-safe non-final candidate windows and check paper-level overlap against the final evaluation window.

Result: The expanded packet makes zero OpenAI calls and launches no compute. It adds judged future-holdout 0-80 and 80-160 windows plus temporal-test 80-132 training pairs, and temporal-test 132-172 validation pairs. The packet now has 59 train pairs across 37 examples and 24 validation pairs across 9 examples, with 61 final-window Qwen frontier pairs retained as `forbidden_diagnostic_only`. The leakage guard reports no final-window example id overlap and no final-window paper overlap in train or validation. Status is `pairwise_packet_ready_for_ranker_training`. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: This reopens the local ranker path without spending money. It does not justify GPU launch: the right next step is a local verifier/ranker evaluation against validation and final diagnostic frontier rows. GPU spend should remain paused until a selector or verifier shows support-preserving transfer.

### D244. Train a local support ranker; reject lexical/contract features as sufficient

Decision: Add `grounded-qa-distillation-local-support-ranker.mjs`, train `local-support-ranker-expanded-2026-06-28-v1` on the expanded pairwise packet, and validate the run as a zero-cost local diagnostic.

Reason: D243 created enough leakage-safe pairwise rows for a first ranker. The question was whether existing cheap features, such as citation completeness, token coverage, answer length, claim count, unsupported number count, and heuristic scores, can recover supported answers without a stronger entailment model or another GPU generation run.

Result: The run makes zero OpenAI calls and launches no compute. After removing the invalid pairwise intercept and using scale-only normalization, the local logistic ranker reaches 50/59 train pair accuracy (84.7%) but only 12/24 validation pair accuracy (50.0%). On the final diagnostic Qwen frontier it reaches 24/61 pairwise accuracy (39.3%) and selects supported candidates for only 3/8 examples (37.5%), despite every diagnostic example having at least one supported candidate. Status is `ranker_not_reliable`. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: The evidence is now sharper: the next bottleneck is not just pair count, and it is not solved by renting a GPU for another small-model smoke. Current cheap lexical/contract features do not transfer to semantic support selection. The next useful step should add entailment-specific features or frontier-like non-final Qwen candidate pairs, then rerun the local ranker before authorizing Prime spend.

### D245. Test deterministic entailment features; keep them as partial signal only

Decision: Add `grounded-qa-distillation-entailment-feature-ranker.mjs`, materialize `entailment-feature-ranker-expanded-2026-06-28-v1`, and validate it as a zero-cost deterministic entailment-feature ranker.

Reason: D244 showed that lexical/contract features were not enough. Before buying new GPT-4o labels or renting Prime GPUs, the project needed to test whether stronger deterministic features over answer text, claim-table text, cited evidence sentences, numeric support, comparative terms, negation mismatch, and unsupported answer/claim tokens could recover supported Qwen frontier candidates.

Result: The run makes zero OpenAI calls and launches no compute. The entailment feature ranker improves final diagnostic selection from the lexical baseline's 3/8 supported selections to 5/8, but it still reaches only 12/24 validation pair accuracy (50.0%) and 28/61 final diagnostic pair accuracy (45.9%). Status is `entailment_features_partial_signal`; `integrate_selector_now` and `launch_gpu_now` are both false. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: Deterministic entailment features are useful enough to keep as features, but not strong enough to drive selection. The next step should use a stronger verifier signal: add non-final Qwen-style candidate pairs, run a small local NLI scorer on packet candidates, or buy a bounded batch of GPT-4o support labels before any Prime GPU generation run.

### D246. Test local pretrained NLI over packet candidates; reject as selector signal

Decision: Add `grounded-qa-distillation-packet-nli-ranker.mjs`, materialize `packet-nli-ranker-expanded-2026-06-28-v1`, and validate it as a zero-cost local NLI candidate-ranker diagnostic.

Reason: D245 left open whether deterministic entailment features were too weak because they lacked a real entailment model. Before buying new GPT-4o support labels or launching Prime GPU generation, the project needed to test whether the already-used local `cross-encoder/nli-distilroberta-base` scorer could provide the missing candidate-selection signal on the expanded support-ranker packet.

Result: The run makes zero OpenAI calls and launches no compute. It scores 178 unique candidates from the expanded packet with local NLI over cited evidence and answer/claim hypotheses. The pairwise ranker reaches 41/59 train accuracy (69.5%), 9/24 validation accuracy (37.5%), and 21/61 final diagnostic accuracy (34.4%). Final diagnostic selection chooses supported candidates for 4/8 examples (50.0%), worse than deterministic entailment features and still below the integration threshold. Status is `packet_nli_not_sufficient`; `integrate_selector_now` and `launch_gpu_now` are false. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: Off-the-shelf NLI is not the missing amortized verifier. The next useful signal must be closer to the failure distribution: non-final Qwen-style candidate pairs or a bounded GPT-4o support-label batch targeted at Qwen switch candidates. Prime GPU spend should remain paused until that supervision exists.

### D247. Prepare leakage-safe non-final Qwen frontier candidate generation before buying labels

Decision: Add `grounded-qa-distillation-qwen-nonfinal-frontier-launch-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1`, and add validator coverage for Qwen non-final frontier launch packets.

Reason: The Qwen prediction inventory showed that the existing Qwen-style frontier candidates are final-window only, so they cannot be used as verifier or support-ranker training supervision. D244-D246 also ruled out cheap lexical, deterministic entailment, and local off-the-shelf NLI rankers as sufficient. Before buying GPT-4o support labels or training another selector, the project needs leakage-safe non-final Qwen-style candidates from the same failure distribution.

Result: The packet makes zero OpenAI calls and launches no GPU jobs. It filters training supervision to papers from source rows 0-160 and builds non-final eval prompts from rows 240-320, with 34 train papers, 16 eval papers, no train/eval paper overlap, no final-window labels, and no final-window ids in eval. The materialized dataset contains 469 SFT train rows, 4 SFT validation rows, 1269 DPO train rows, 9 DPO validation rows, and 80 non-final eval prompts. The generated dataset validator passed, copied launch shell scripts passed `bash -n`, the launch gate keeps `launch_next_gpu_now` false, and the projected total after a bounded smoke is `$16.261313100000024`, below the `$100` cap. Prime auth still works from the saved local token and active Prime pods are 0. Total tracked spend remains `$12.261313100000024` of the `$100` cap.

Tradeoff: The validation split is sparse because the packet enforces paper-level leakage filtering. This is acceptable for candidate generation, not for claiming a trained verifier result. The next step is a live Prime price/wallet preflight and a bounded candidate-generation smoke only if it remains inside budget; after predictions exist, they must be citation-repaired and judged before any row is merged into support-ranker or verifier supervision.

### D248. Run the non-final Qwen frontier smoke and convert it into leakage-safe support labels

Decision: Use the saved Prime token and saved OpenAI key, run the bounded non-final Qwen 7B candidate-generation smoke, terminate the pod after artifact fetch, repair citation syntax locally, judge the repaired non-final candidates with `gpt-4o`, and materialize `qwen-nonfinal-support-label-packet-2026-06-28-v1`.

Reason: D247 created the packet but not the actual Qwen-style candidates. D244-D246 showed that the available local rankers failed because they lacked supervision close to the final Qwen frontier failure distribution. The next useful evidence was therefore not a bigger open-ended GPU run; it was a bounded non-final candidate-generation run whose outputs could be judged and reused as leakage-safe verifier/ranker supervision.

Result: Prime auth and wallet were valid, with `$45.81` wallet balance before launch and zero active pods. A DataCrunch L40S pod `8557966f9a644e31aed491828f73916b` ran `MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`, `PUSH_TO_HUB=false`, and `REPORT_TO=none`; artifacts were fetched and the pod was terminated. Prime billed `$0.27`, and the spend finalizer recorded it, moving combined tracked spend to `$12.531313100000023` before judging. The raw non-final Qwen run produced 80 predictions, answered 55, abstained 25, had 100.0% valid JSON, 68.75% answer rate, 60.0% answer-type accuracy, 65.7% citation precision, 47.0% citation recall, 24.5% answer-token F1, but 0.0% inline citation rate. The deterministic zero-call citation repair changed 43 rows, appended 54 missing inline citations, preserved the 55/80 answer count, and raised inline citation rate to 78.2%. The paid `gpt-4o` judge made 80 ledgered calls costing `$0.148105`; repaired candidates reached 38.2% answer support, 96.0% abstention support, 56.25% overall judged correctness, and 12.5% invalid judgment rate. The support-label packet contains 80 non-final rows: 21 supported answers, 34 unsupported answers, 24 supported abstentions, and 14 invalid/partial answered labels. Combined tracked spend after the run and judge is `$12.679418100000024` of the `$100` cap, leaving `$87.32058189999997`.

Tradeoff: The run is deliberately not a final student result: answer support is poor and inline citation repair only makes the outputs judgeable. But it succeeds at the immediate bottleneck: it creates leakage-safe Qwen-style supported and unsupported candidate labels from rows 240-320, with final-window labels still unused. The next step should merge this packet into verifier/support-ranker training and test whether it improves final diagnostic candidate selection over the failed lexical, deterministic entailment, and off-the-shelf NLI rankers.

### D249. Train a ranker with non-final Qwen support labels; reject simple pointwise features

Decision: Add `grounded-qa-distillation-qwen-label-support-ranker.mjs`, train `qwen-label-support-ranker-2026-06-28-v1`, and validate it as a zero-cost local ranker over existing pairwise labels plus the new non-final Qwen support-label packet.

Reason: D248 produced the leakage-safe Qwen-style support labels that D244-D246 were missing. The next question was whether those labels alone, combined with deterministic entailment/contract features, were enough to recover supported final-frontier Qwen candidates without another GPU run or more OpenAI calls.

Result: The ranker makes zero new OpenAI calls and launches no compute. It trains a standardized pointwise logistic model from 118 existing pairwise-derived examples plus 43 non-final Qwen answered labels from source indices 240-299, while holding out 12 non-final Qwen answered labels from indices 300-318. It reaches 106/161 train pointwise accuracy (65.8%), 7/12 held-out Qwen pointwise accuracy (58.3%), 15/24 existing validation pairwise accuracy (62.5%), 24/61 final diagnostic pairwise accuracy (39.3%), and selects supported candidates for only 4/8 final diagnostic examples (50.0%). A local split sweep was also negative: earlier split points improved held-out Qwen accuracy but selected only 3/8 final supported candidates, while training on all non-final Qwen answer labels recovered 5/8 final selections only by eliminating the held-out Qwen validation slice. Total tracked spend remains `$12.679418100000024` of the `$100` cap.

Tradeoff: The new labels are useful, but not sufficient for a cheap feature ranker. They expose the semantic gap more sharply: the model can learn some non-final Qwen support patterns, yet these do not transfer to the final Qwen frontier where short supported answers and plausible unsupported overclaims remain hard to separate. The next step should be a miss audit over the Qwen-label ranker selections and either a stronger verifier target or more diverse non-final Qwen candidate labels, not another generator-only Prime run.

### D250. Audit Qwen-label ranker misses; target unsupported overclaims directly

Decision: Add `grounded-qa-distillation-qwen-label-ranker-miss-audit.mjs`, materialize `qwen-label-ranker-miss-audit-2026-06-28-v1`, and validate it as a zero-cost final diagnostic miss audit.

Reason: D249 showed that the Qwen-label ranker did not transfer, but aggregate metrics alone did not explain whether the problem was missing labels, wrong features, family bias, answer-length bias, or a true verifier gap. Before spending more OpenAI or Prime budget, the project needed to inspect the four final diagnostic examples where the ranker selected an unsupported candidate despite supported alternatives being available.

Result: The audit makes zero OpenAI calls and launches no compute. Across 8 final diagnostic examples, the ranker selected 4 supported and 4 unsupported candidates, with every example having at least one supported candidate. All 4 misses are tagged `unsupported_overclaim_ranked_high`, `citation_count_not_discriminative`, and `selected_unsupported_candidate`; 3/4 are also tagged `supported_answer_is_short`, `supported_candidate_ranked_far_below`, and `family_shortcut_or_domain_shift`. Concrete misses include unsupported numeric or class answers such as `2,060 [E3]`, `neutral [E1] [E2] [E3] [E4]`, and `Spanish and Finnish [E3] [E4]` being scored above supported shorter or differently-family candidates. Total tracked spend remains `$12.679418100000024` of the `$100` cap.

Tradeoff: This makes the next step narrower and more defensible. More generator-only GPU runs are not justified by the current evidence; the failure is in verification, specifically penalizing plausible unsupported overclaims and avoiding family/length shortcuts. The next useful experiment should build selected-vs-supported verifier targets from these miss pairs, or use a stronger verifier signal, before any additional Qwen generation.

### D251. Test overclaim penalties and materialize verifier regression targets

Decision: Add `grounded-qa-distillation-qwen-overclaim-penalty-audit.mjs`, materialize `qwen-overclaim-penalty-audit-2026-06-28-v1`, and validate it as a zero-cost final diagnostic penalty sweep plus verifier-target packet.

Reason: D250 showed that all ranker misses involved unsupported overclaims, but it was still unclear whether a cheap deployable rule could recover the misses or whether the project needed a stronger verifier trained on selected-vs-supported contrasts. Before spending more OpenAI or Prime budget, the project needed to separate deployable text/metadata penalties from oracle diagnostics that use final-window support labels.

Result: The audit makes zero OpenAI calls and launches no compute. On the 8 final diagnostic examples, the base Qwen-label ranker selects 4 supported candidates. The best deployable heuristic, a short-answer/citation/family regularizer, selects 5/8 supported candidates and is not sufficient. The oracle unsupported-claim penalty selects 7/8 supported candidates, showing that the missing signal is explicit overclaim detection rather than more generation. The run also writes 4 selected-unsupported-vs-best-supported verifier target pairs, all marked `forbidden_final_diagnostic_only`, so they can be used as regression/spec examples but not as training data. Total tracked spend remains `$12.679418100000024` of the `$100` cap.

Tradeoff: The final diagnostic pairs are informative but leakage-sensitive. They should not be used to train the verifier. The next useful step is to create analogous selected-vs-supported contrasts from leakage-safe non-final Qwen labels, or buy a small bounded GPT-4o verifier-label batch for non-final frontier candidates, before considering another Prime GPU run.

### D252. Train a non-final Qwen contrast verifier; reject reference-vs-unsupported contrasts as sufficient

Decision: Add `grounded-qa-distillation-qwen-contrast-verifier.mjs`, materialize `qwen-contrast-verifier-2026-06-28-v1`, and validate it as a zero-cost pairwise verifier trained from existing support pairs plus leakage-safe non-final Qwen reference-vs-unsupported contrasts.

Reason: D251 showed that explicit unsupported-overclaim detection would fix most final diagnostic misses, but the final-window verifier targets cannot be used for training. The next leakage-safe test was whether the existing non-final Qwen support labels contain enough contrast signal by pairing unsupported Qwen answers against the grounded reference answer for the same non-final input.

Result: The run makes zero OpenAI calls and launches no compute. The non-final Qwen label packet contains 20 grounded-reference-vs-unsupported-Qwen contrasts; 15 with source index `<300` are used for training and 5 with source index `>=300` are held out. Combined with 59 existing support-ranker training pairs, the pairwise verifier reaches 59/74 train pair accuracy (79.7%), but only 3/5 held-out non-final Qwen contrast accuracy (60.0%), 14/24 existing validation pair accuracy (58.3%), 21/61 final diagnostic pair accuracy (34.4%), and selects supported final candidates for only 3/8 examples (37.5%). Status is `qwen_contrast_verifier_not_sufficient`; `integrate_selector_now`, `launch_gpu_now`, and `buy_more_openai_labels_now` are all false. Total tracked spend remains `$12.679418100000024` of the `$100` cap.

Tradeoff: This is a negative but clarifying result. Reference-vs-unsupported contrasts are not distribution-matched enough to solve frontier candidate selection; they can teach that the reference beats a bad Qwen answer, but not reliably which generated candidate should win among plausible Qwen alternatives. The next useful step is not a generator-only GPU run. It is either to generate non-final frontier candidate pools with multiple candidates per input and judge selected-vs-supported pairs, or to buy a small bounded GPT-4o verifier-label batch over already generated non-final frontier-like candidate alternatives.

### D253. Prepare a non-final multi-sample Qwen frontier pool before more verifier training

Decision: Add `grounded-qa-distillation-qwen-nonfinal-frontier-pool-packet.mjs`, materialize `joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2`, and validate it as a gated zero-cost launch packet for multi-sample non-final Qwen candidate-pool generation.

Reason: D252 showed that single Qwen answers paired against QASPER references are not distribution-matched to final frontier candidate selection. The repository already has multi-variant Qwen7B final-window candidate pools, but those are diagnostic-only and cannot be used for verifier training. The next aligned data-construction step is therefore to create leakage-safe non-final frontier pools: multiple generated candidates per held-out non-final input, then citation-repair and judge them before extracting selected-vs-supported verifier contrasts.

Result: The packet makes zero OpenAI calls and launches no compute. It inherits the leakage-safe non-final packet from D247/D248: train source rows `0-160`, eval source rows `240-320`, 34 train papers, 16 eval papers, no train/eval paper overlap, and no final-window labels. The new runner uses the same bounded training caps (`MAX_SFT_STEPS=20`, `MAX_DPO_STEPS=10`) but swaps deterministic eval for sampled frontier-pool eval with `NUM_RETURN_SEQUENCES=3`, `TEMPERATURE=0.7`, `TOP_P=0.9`, and `MAX_EVAL_EXAMPLES=80`, projecting 240 non-final candidate rows. Estimated GPU spend is `$5`, making projected total spend `$17.679418100000024` of the `$100` cap. The generated Python and shell scripts pass syntax checks. `launch_next_gpu_now` remains false until Prime auth/wallet/active-pod/live-price preflight is checked immediately before launch.

Tradeoff: This is a paid-run setup, not a result claim. It avoids the leakage error of training on final frontier candidates and avoids another generator-only final run. The next step should be a live Prime preflight and bounded launch of this packet, followed by immediate pod termination, compute ledger finalization, citation repair, GPT-4o judging, and verifier-pair extraction from the judged non-final pool.

### D254. Run and judge the non-final frontier pool; reject it as sufficient verifier transfer

Decision: Use the saved Prime token and saved OpenAI key to run `joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2`, repair citations locally, judge all 240 repaired sampled candidates with `gpt-4o`, materialize `qwen-frontier-pool-support-packet-2026-06-28-v1`, and train `qwen-contrast-verifier-frontier-pool-2026-06-28-v1` before considering more paid generation.

Reason: D253 created the right leakage-safe candidate-pool setup, but the project still needed to know whether distribution-matched non-final Qwen candidate pools could teach a cheaper verifier to choose supported candidates. Prime auth was valid from the saved token, the wallet had enough balance, and no active pods were running. The bounded L40S run completed, artifacts were fetched, and the pod was terminated. Prime billed `$0.22`. The saved OpenAI key then judged 240 repaired candidate rows with ledgered `gpt-4o` calls costing `$0.45274`. Combined tracked spend is now `$13.352158100000022` of the `$100` cap, leaving `$86.64784189999997`.

Result: The raw sampled Qwen pool answered 173/240 candidates, abstained on 67, and had 100.0% valid JSON but 0.0% inline citation rate. Zero-call citation repair changed 100 rows, repaired 123 inline citations, cleared 20 parse errors, and raised inline citation rate to 57.8%. The judge found only 26.6% answer support, 98.5% abstention support, 46.7% overall judged correctness, and 28.3% invalid judgments. The support packet contains 46 supported answers, 127 unsupported answers, 66 supported abstentions, 32 within-Qwen generated supported-vs-unsupported contrast pairs, and 52 reference-fallback contrasts. A zero-cost contrast verifier trained from existing pairs, the earlier non-final support labels, and this frontier-pool packet reached 117/137 train pair accuracy, 4/5 earlier non-final Qwen held-out accuracy, 18/21 frontier-pool held-out accuracy, and 17/24 existing validation accuracy. However, it still reached only 27/61 final diagnostic pair accuracy and selected supported candidates for only 3/8 final diagnostic examples.

Tradeoff: Prime and the saved OpenAI key are not the blocker. The model/backend is also not the only blocker: a stronger 7B sampled pool produced plenty of supervision, and the local verifier learned held-out non-final contrasts, but that signal did not transfer to the final diagnostic frontier. Do not spend more on generator-only GPU runs right now. The next useful work is a final-domain-shift/verifier-target audit or a stronger support verifier objective that can penalize plausible unsupported overclaims without training on final-window labels.

### D255. Diagnose the Qwen frontier transfer failure as proxy-feature verifier collapse

Decision: Add `grounded-qa-distillation-qwen-frontier-domain-shift-audit.mjs`, materialize `qwen-frontier-domain-shift-audit-2026-06-28-v1`, and validate it as a zero-cost audit of the final diagnostic misses from `qwen-contrast-verifier-frontier-pool-2026-06-28-v1`.

Reason: D254 showed that the frontier-pool verifier learned non-final held-out contrasts but failed on final candidate selection. Before spending more on Prime or OpenAI, the project needed to know whether this was random final-window variance, insufficient model size, or a bad verifier target that rewarded superficial proxies.

Result: The audit makes zero OpenAI calls and launches no compute. It inspects 50 final diagnostic candidates across 8 examples and compares them with 126 non-final frontier-pool candidates. The verifier selected supported candidates for only 3/8 final examples. The 5 misses are tagged as follows: `inline_contract_not_discriminative` on all 5, `surface_overlap_rewards_unsupported` on 4, `unsupported_candidate_has_more_citations` on 3, `supported_short_answer_penalized` on 3, `unsupported_number_not_penalized` on 3, `family_or_curriculum_domain_shift` on 3, and `longer_unsupported_answer_ranked_high` on 1. The learned verifier has positive weights on risky proxy features: `citation_count`, `unsupported_number_count`, and `unsupported_claim_token_rate`, plus a negative weight on `answer_is_short`. Total tracked spend remains `$13.352158100000022` of the `$100` cap.

Tradeoff: This rules out another generator-only GPU run as the rational next step. The failure is not lack of sampled candidates; it is that pairwise answer-level labels let the local verifier learn citation/length/numeric proxies instead of semantic support. The next data-construction move should produce non-final claim-level support supervision or a small bounded non-final adjudication batch for semantic verifier training, then require final diagnostic improvement before any more generation spend.

### D256. Test non-final claim-level support supervision; reject lexical claim features as sufficient

Decision: Add `grounded-qa-distillation-claim-support-verifier.mjs`, materialize `claim-support-verifier-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-cost claim-level support verifier trained from the existing non-final frontier-pool GPT-4o judgments.

Reason: D255 showed that answer-level pairwise training let the verifier learn citation-count, answer-length, and numeric proxies. The next cheapest aligned test was to convert the already-paid non-final judge rows into claim-level support rows: supported claims from judged supported answers and unsupported claims from the judge's `unsupported_claims` field, with source rows `<300` used for training and rows `>=300` held out.

Result: The run makes zero OpenAI calls and launches no compute. It creates 218 claim-level rows from the non-final frontier pool: 166 train rows and 52 validation rows. The local claim verifier learns the non-final task well: 154/166 train claim accuracy (92.8%), 43/52 held-out claim accuracy (82.7%), 58/63 non-final train pair accuracy (92.1%), and 19/21 non-final validation pair accuracy (90.5%). It also reaches 18/24 existing validation pair accuracy (75.0%). However, the final diagnostic remains negative: only 20/61 final pair accuracy (32.8%) and 3/8 final selected supported candidates (37.5%), matching the failed answer-level frontier-pool verifier's final selection rate. Total tracked spend remains `$13.352158100000022` of the `$100` cap.

Tradeoff: Claim-level decomposition is necessary but not sufficient when implemented with lexical coverage features. It confirms that the non-final supervision is learnable but still does not transfer to the final Qwen frontier. The next step should be a stronger semantic verifier target/model, such as a bounded non-final adjudication batch focused on final-like miss patterns or a local NLI/cross-encoder trained/evaluated on these claim rows, before any additional generator GPU run.

### D257. Test local claim-level NLI; reject it as sufficient final-frontier transfer

Decision: Add `grounded-qa-distillation-claim-nli-support-verifier.mjs`, materialize `claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-cost claim-level verifier that augments the D256 lexical features with local `cross-encoder/nli-distilroberta-base` entailment, contradiction, and margin features.

Reason: D256 showed that claim decomposition helped on non-final held-out labels but still failed the final diagnostic. The cheapest next semantic test was to score every labeled non-final claim and every candidate-pair claim against its cited evidence with an already-cached local NLI model, then train only on non-final claim labels while keeping final-window labels diagnostic-only.

Result: The run makes zero OpenAI calls and launches no external compute. It scores 505 claim/evidence units locally and keeps total tracked spend unchanged at `$13.352158100000022` of the `$100` cap, leaving `$86.64784189999997`. NLI features improve train claim accuracy to 156/166 (94.0%) and existing validation pairwise accuracy to 20/24 (83.3%), but they do not fix final transfer: held-out non-final pairwise falls to 17/21 (81.0%), final diagnostic pairwise falls to 18/61 (29.5%), and final selected supported candidates remain 3/8 (37.5%).

Tradeoff: The blocker is not simply that we lacked an off-the-shelf semantic feature. Local NLI adds signal inside the non-final distribution but still cannot distinguish the final frontier's plausible overclaims from supported short answers. Do not spend more Prime GPU budget on generator-only runs. The next paid step, if any, should be a bounded final-like non-final adjudication or contrast-construction batch targeted at the observed miss patterns, then require final diagnostic improvement before another generator launch.

### D258. Test final-like hard-negative non-final contrasts; reject weighting as sufficient

Decision: Add `grounded-qa-distillation-hard-negative-claim-nli-selector.mjs`, materialize `hard-negative-claim-nli-selector-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-cost candidate-level pairwise selector over existing non-final Qwen frontier-pool contrasts plus the D257 local NLI scores.

Reason: D257 showed that claim-level NLI classification did not transfer to final candidate selection. The next cheapest contrast-construction test was to summarize each candidate with claim-model, NLI, citation, answer-length, and overclaim-risk features, train pairwise selectors on non-final supported-vs-unsupported contrasts, and explicitly test hard-negative weighting plus train-tuned penalties for overclaim-prone features. Final-window labels remained diagnostic-only.

Result: The run makes zero OpenAI calls and launches no external compute, so total tracked spend remains `$13.352158100000022` of the `$100` cap. It constructs 34 hard train pairs from 63 non-final train pairs; hard tags include unsupported numbers (24), longer unsupported answers (12), unsupported claim-model score not lower (5), more unsupported citations (4), and supported short-answer cases (3). The best selected policy is the unweighted pairwise selector, not the hard-weighted or risk-penalized variants. It reaches 60/63 train pair accuracy (95.2%), 19/21 non-final validation pair accuracy (90.5%), 19/24 existing validation pair accuracy (79.2%), and 35/61 final diagnostic pair accuracy (57.4%). Final candidate selection improves over D257 but remains insufficient at 4/8 supported selections (50.0%). Hard-negative weighting and train-tuned risk penalties also select only 4/8 final supported candidates and hurt existing validation in the weighted case.

Tradeoff: Candidate-level pairwise summaries recover more final pairwise signal than claim classification, but they still do not solve per-example selection. This narrows the blocker: we need better supervision over final-like switch candidates, not more unlabeled generation and not more generic local NLI features. The next paid step should be a small, capped GPT-4o adjudication batch that targets non-final candidates matching the remaining final miss patterns, then retrain/evaluate selectors before any additional Prime GPU generator run.

### D259. Buy a capped pool-level GPT-4o adjudication batch

Decision: Add `grounded-qa-distillation-openai-pool-adjudication.mjs`, materialize `openai-pool-adjudication-qwen-frontier-pool-2026-06-28-v1`, and ledger a capped `gpt-4o` batch over generated-only non-final Qwen candidate pools.

Reason: D258 improved final pairwise ranking but still failed per-example candidate selection. The next required supervision target was therefore listwise: given one question, evidence pack, and multiple generated candidates, which candidate should a strict grounded adjudicator pick? References were excluded from the candidate pools so the label shape matches the final diagnostic, where only model candidates are available.

Result: The run made 20 OpenAI calls and cost `$0.106195`, recorded in `docs/experiments/grounded-qa-distillation/llm-calls/ledger.jsonl` with task `grounded_qa_pool_adjudication`. Total tracked spend is now `$13.458353100000018` of the `$100` cap, leaving `$86.54164689999998`. The batch judged 20 targeted non-final pools and selected an existing-supported generated candidate in 19/20 pools (95.0%), with no `NONE` selections. The selected roots span source indices 245-318 and use no final-window labels.

Tradeoff: Pool-level GPT-4o adjudication appears reliable enough to use as a training target, and it directly matches the per-example selection failure mode. The next step is to train a listwise selector from these labels and require final diagnostic gains before buying more labels or launching another generator GPU run.

### D260. Train from pool-level adjudications; reject current listwise selector as sufficient

Decision: Add `grounded-qa-distillation-pool-adjudicated-selector.mjs`, materialize `pool-adjudicated-selector-qwen-frontier-pool-2026-06-28-v1`, and validate it as a no-new-call selector trained from the D259 pool-choice labels.

Reason: D259 showed that GPT-4o can reliably pick supported generated candidates from targeted non-final pools. The test was whether those labels can be amortized into a cheap selector that improves final-window candidate selection, using only non-final pool labels for training and keeping final-window labels diagnostic-only.

Result: The selector makes no new LLM calls and inherits the 20 calls / `$0.106195` cost from D259. It trains on 14 pools and validates on 6 pools. It reaches 10/14 train pool-choice accuracy (71.4%), 5/6 validation pool-choice accuracy (83.3%), and selects existing-supported candidates for 6/6 validation pools. Existing validation pairwise accuracy is 20/24 (83.3%), and final pairwise accuracy is 35/61 (57.4%). However, final candidate selection falls to 3/8 supported selections (37.5%). A conservative hybrid with the D258 pairwise selector chooses the same pool-only weighting on non-final validation and also reaches only 3/8 final supported selections.

Tradeoff: Pool-level labels are useful and better aligned than individual answer labels, but this first 20-pool batch is too small or still mismatched to solve final selection. Do not integrate the selector and do not launch more generator GPU. The next step is a miss audit of the final examples where D258 succeeds and D260 fails, plus the D259 disagreement row, before buying any additional labels.

### D261. Audit pool-selector regression before buying more labels

Decision: Add `grounded-qa-distillation-pool-selector-miss-audit.mjs`, materialize `pool-selector-miss-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-cost audit comparing D258 hard-negative final selections, D260 pool-adjudicated final selections, and the D259 pool-adjudication disagreement.

Reason: D260 showed that listwise GPT-4o pool labels are aligned on non-final validation but regress final supported selection from 4/8 under the D258 hard-negative pairwise selector to 3/8. Before buying more labels, the project needed to know whether the regression was a random tradeoff, a different useful frontier, or a concrete target mismatch.

Result: The audit makes zero OpenAI calls and launches no compute, so total tracked spend remains `$13.458353100000018` of the `$100` cap. D258 and D260 agree on 3 final successes and 4 final failures. There is exactly 1 hard-only final success and 0 pool-only final successes: `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a`, where the hard selector picks supported `qwen3b_v4` and the pool selector picks unsupported `qwen3b_v1`. The lone D259 disagreement is also structurally informative: GPT-4o selected a short answer that is supported at the answer-text level, while the existing judge rejected the candidate because its claim table introduced an unsupported uncited overclaim.

Tradeoff: Do not buy the next label batch yet and do not launch GPU. The next step should regularize listwise pool labels with D258 pairwise support signal and add an explicit answer/claim-table consistency penalty. More GPT-4o labels would be defensible only after that constrained selector shows it can recover the hard-only final success without losing existing non-final validation.

### D262. Test constrained pool-pairwise scoring; keep D258 as the active cheap selector baseline

Decision: Add `grounded-qa-distillation-constrained-pool-pairwise-selector.mjs`, materialize `constrained-pool-pairwise-selector-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call run that blends the D260 pool-choice model with the D258 hard-negative pairwise model while optionally penalizing answer/claim-table inconsistency.

Reason: D261 showed that the paid D259/D260 pool-choice path regressed one final supported selection relative to the hard-negative pairwise selector, and that the one pool-adjudication disagreement involved a supported short answer paired with an unsupported uncited claim-table overclaim. The cheapest test was to tune a constrained policy on non-final pool validation and existing validation pairs, then inspect final-window performance only diagnostically.

Result: The run makes zero OpenAI calls and launches no compute, leaving tracked spend at `$13.458353100000018` of the `$100` cap. The constrained policy grid evaluates 360 policies. The non-final tuning objective selects `alpha_pool_weight=0` with all consistency penalties set to `0`, which is effectively the D258 hard-negative pairwise scorer. This recovers final diagnostic selection from the D260 pool-only 3/8 to 4/8 supported selections, while preserving 5/6 non-final pool-choice accuracy and 6/6 non-final selected-existing-supported pools. Existing validation pairwise accuracy is 19/24, lower than the D260 pool-only 20/24 but matching the D258 tradeoff.

Tradeoff: The result is useful but not a breakthrough. Pool-level labels remain evidence that listwise adjudication is viable, but the current penalty features are not selected by leakage-safe tuning and should not be claimed as an improvement. Keep D258/D262 as the active cheap selector baseline, do not integrate D260 pool-only scoring, and do not buy more labels until the remaining 4 both-fail final examples are audited for a more precise supervision target.

### D263. Target the remaining final failures as span-vs-overexpansion contrasts

Decision: Add `grounded-qa-distillation-both-fail-target-audit.mjs`, materialize `both-fail-target-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-cost audit of the 4 final diagnostic examples missed by both the D258/D262 hard-pairwise baseline and the D260 pool-only selector.

Reason: D262 recovered the D260 regression but still selected unsupported candidates for 4/8 final examples. Before buying more labels, the project needed to know whether those residual failures were diverse model-capacity failures or a specific data-construction gap that can be addressed from existing judged non-final artifacts.

Result: The audit makes zero OpenAI calls and launches no compute, so total tracked spend remains `$13.458353100000018` of the `$100` cap. All 4 residual failures have a supported candidate available and all 4 selected unsupported candidates already contain existing judge unsupported-claim evidence. All 4 are numeric/list scope overclaim cases where citation count is non-discriminative; 1 is explicitly a short supported answer losing to a longer unsupported expansion, 2 have multiple supported candidates ranked below the unsupported choice, and 1 is a same-citation/different-claim contrast.

Tradeoff: This is strong evidence that the next step should not be another broad GPT-4o label batch or generator GPU run. The next zero-cost target is a non-final contrast packet for `minimal_supported_span_vs_overexpanded_answer`: positives are exact short cited answers or abstentions that avoid predicate/list/scope expansion, negatives are candidates with similar citation surface but unsupported predicate, entity, numeric, or dataset-list claims. Only if that mined packet fails should we consider a small paid batch targeted at these residual mechanisms.

### D264. Mine non-final minimal-span vs overexpansion contrasts

Decision: Add `grounded-qa-distillation-minimal-span-overexpansion-packet.mjs`, materialize `minimal-span-overexpansion-packet-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call packet mined from the existing judged non-final Qwen frontier pool.

Reason: D263 showed that the residual final failures were numeric/list scope overclaims where supported short spans lost to unsupported expansions. Before buying labels, the project needed to know whether the already-paid non-final Qwen pool contains the same mechanism in trainable form.

Result: The packet makes zero OpenAI calls and launches no compute. It mines 53 total non-final contrasts from 30 roots: 20 generated-vs-generated candidate pairs and 33 reference-fallback pairs. The split contains 40 train pairs and 13 validation pairs, including 15 generated train pairs and 5 generated validation pairs. All 53 pairs include existing judge unsupported-claim evidence, 33 include numeric/list scope overclaim tags, 17 share the same citation surface, and 3 are longer unsupported expansions. Total tracked spend remains `$13.458353100000018` of the `$100` cap.

Tradeoff: The packet is large enough for a zero-cost selector test. It is not enough to claim a solved method because reference fallback is still a substantial part of the packet, but it directly operationalizes the D263 residual mechanism and should be tested before any paid labels.

### D265. Test an overexpansion-aware selector; reject it as an integrated replacement

Decision: Add `grounded-qa-distillation-overexpansion-aware-selector.mjs`, materialize `overexpansion-aware-selector-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call selector trained from the D264 packet using only answer text, claim table, citation, question, and cited-evidence features.

Reason: D264 produced trainable non-final overexpansion contrasts. The selector test asks whether cheap features for unsupported numbers, unsupported list-scope terms, extra entities, claim-answer gap, and cited-evidence coverage can recover the remaining final misses without relying on final judge labels or new paid adjudication.

Result: The selector makes zero OpenAI calls and launches no compute. It learns the D264 task well: 37/40 train pair accuracy (92.5%) and 12/13 validation pair accuracy (92.3%). It improves final diagnostic candidate selection from the D262 baseline's 4/8 supported selections to 5/8. However, it fails the preservation gate: existing validation pairwise accuracy falls to 14/24 (58.3%), and final diagnostic pairwise accuracy is only 30/61 (49.2%). Total tracked spend remains `$13.458353100000018` of the `$100` cap.

Tradeoff: The overexpansion signal is real but too narrow to integrate directly. Do not replace the D258/D262 baseline and do not buy labels yet. The next zero-cost step should be a calibrated hybrid with D262, tuned to preserve existing validation while using the overexpansion score only where it can recover final numeric/list scope misses.

### D266. Calibrate overexpansion hybrid; reject it as sufficient

Decision: Add `grounded-qa-distillation-calibrated-overexpansion-hybrid.mjs`, materialize `calibrated-overexpansion-hybrid-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call score-level hybrid between the D262 broad support selector and the D265 overexpansion-aware selector.

Reason: D265 improved final diagnostic selection from 4/8 to 5/8 but collapsed existing validation to 14/24. The next leakage-safe test was whether a small overexpansion weight could preserve D262's existing validation while recovering the final numeric/list-scope gain.

Result: The hybrid makes zero OpenAI calls and launches no compute, leaving total tracked spend at `$13.458353100000018` of the `$100` cap. Calibration uses existing validation pairwise predictions only and selects the largest overexpansion weight that preserves D262's 19/24 existing-validation correct count: `alpha=0.15`. This preserves existing validation at 19/24 and final pairwise accuracy at 35/61, but final diagnostic selection remains 4/8, matching D262 and failing to recover D265's 5/8 final-selection gain.

Tradeoff: The D265 overexpansion signal is real but not usable as a simple calibrated score hybrid. Keep D258/D262 as the active cheap selector baseline. The next useful zero-cost work is a miss audit comparing D265's recovered final example against the hybrid/D262 selection to identify the missing gating feature; only after that should a small targeted paid adjudication be considered.

### D267. Audit overexpansion-selector tradeoffs; require a conditional gate before integration

Decision: Add `grounded-qa-distillation-overexpansion-tradeoff-audit.mjs`, materialize `overexpansion-tradeoff-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call audit comparing D262, D265, and D266 final diagnostic selections.

Reason: D266 showed that scalar score blending preserves existing validation only when it loses D265's final-selection gain. The project needed to know whether D265's gain was a single accidental recovery or a structured tradeoff that could be gated.

Result: The audit makes zero OpenAI calls and launches no compute, leaving total tracked spend at `$13.458353100000018` of the `$100` cap. D265 recovers 2 D262 final misses and regresses 1 D262 success, producing its net 5/8 final selection. The calibrated D266 hybrid falls back to 4/8 because the recovered cases require stronger conditional activation than a globally small alpha. In both recovered cases D262 selected candidates with existing unsupported-claim evidence and D265 selected the best supported candidate; however, the current cheap gate tags are not clean enough because the regression also shares some low-list-scope surface features.

Tradeoff: Do not integrate a gate and do not buy labels yet. The next step should build a leakage-safe non-final gate using D264-style features and require it to reject D265's regression pattern while preserving the two rescue patterns. If non-final validation cannot separate those cases, that is the point where a small targeted paid adjudication batch becomes defensible.

### D268. Test a conditional overexpansion gate; reject current cheap risk features

Decision: Add `grounded-qa-distillation-conditional-overexpansion-gate.mjs`, materialize `conditional-overexpansion-gate-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call gate calibrated on D264 validation contrasts plus existing validation pairwise predictions.

Reason: D267 showed that D265 has two final rescues and one regression, while scalar hybrid calibration loses the rescues. The next leakage-safe test was whether non-final risk features could conditionally activate the D265 score only when D262 appears to prefer an overexpanded unsupported candidate.

Result: The gate makes zero OpenAI calls and launches no compute, leaving tracked spend at `$13.458353100000018` of the `$100` cap. It preserves existing validation at 19/24 and keeps final pairwise at 35/61, but final diagnostic selection remains 4/8, identical to D262 and below D265's 5/8. The selected policy activates overexpansion scoring on 5/13 D264 validation pairs, 9/24 existing-validation pairs, 10/61 final diagnostic pairs, and only 1/8 final selections.

Tradeoff: The current cheap risk features are not enough to turn D265's diagnostic signal into a reliable gate. Keep D258/D262 as the active cheap baseline. A small targeted paid adjudication batch is now more defensible than further hand-tuned gating, but it should be tightly scoped to the D267 rescue/regression boundary rather than broad generation or broad pool labeling.

### D269. Prepare a capped boundary adjudication packet, but do not launch paid calls

Decision: Add `grounded-qa-distillation-targeted-boundary-adjudication-packet.mjs`, materialize `targeted-boundary-adjudication-packet-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call launch packet for the D267/D268 rescue-regression boundary.

Reason: D268 showed that the current cheap risk features cannot convert D265's final diagnostic gain into a reliable gate. The next defensible paid step is therefore not broad labeling or GPU generation, but a small adjudication batch targeted at non-final examples that match the final boundary mechanisms: numeric/list-scope overclaim, same-citation surface, entity/scope expansion, and minimal supported span versus overexpanded unsupported answer.

Result: The packet makes zero OpenAI calls and launches no compute, so tracked spend remains `$13.458353100000018` of the `$100` cap. It records 5 final diagnostic boundary rows as forbidden training examples: 2 D265-only rescues, 1 D265 regression, and 2 both-fail cases. The payable batch contains 12 non-final requests across 12 roots, including 10 generated-vs-generated contrasts, with a conservative local estimate of `$0.24` and an estimated total spend after execution of `$13.698353`. The saved secret names now include `OPENAI_API_KEY`, but this packet still refuses to run paid calls directly; a ledgered runner must re-price and record every call before execution.

Tradeoff: This unblocks a tightly bounded paid batch without spending money yet. It does not produce new adjudication labels, so it cannot change the active selector baseline. The next implementation step should be a runner that executes only this packet under the `$100` budget, writes per-call ledger rows, and then evaluates whether the new labels separate the D265 rescues from its regression.

### D270. Run the capped boundary adjudication batch; reject raw label integration

Decision: Add `grounded-qa-distillation-targeted-boundary-adjudication-runner.mjs`, execute `targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1`, and record every OpenAI call in `docs/experiments/grounded-qa-distillation/llm-calls/ledger.jsonl` under task `grounded_qa_targeted_boundary_adjudication`.

Reason: D269 produced a leakage-safe packet and the saved secret file now contains `OPENAI_API_KEY`. The runner restricts execution to the 12 D269 non-final request ids, excludes existing local-judge post-hoc fields from prompts, uses final-window rows only as forbidden diagnostics, and refreshes both the OpenAI and total spend budget files after execution.

Result: The run made 12 GPT-4o calls and cost `$0.0492525`, using the current pricing source recorded as `https://openai.com/api/pricing/`. Total actual tracked spend is now `$13.5076056` of the `$100` cap, leaving `$86.4923944`. GPT-4o selected candidate A alone for 8/12 rows, both candidates for 1/12, and neither for 3/12. Exact agreement with the existing weak A-supported/B-unsupported signal was 8/12 (66.7%), with disagreements on `boundary-adjudication-001`, `006`, `011`, and `012`.

Tradeoff: Do not integrate all paid labels. The batch is cheap and useful, but the disagreement rate is too high to treat raw GPT-4o labels or the old weak labels as ground truth. The next step is a zero-cost disagreement audit and filtered training subset, not more labels or GPU spend.

### D271. Audit boundary-label disagreements; accept only filtered A-over-B labels

Decision: Add `grounded-qa-distillation-boundary-adjudication-disagreement-audit.mjs`, materialize `boundary-adjudication-disagreement-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call audit over the D270 paid labels.

Reason: D270 exposed 4 disagreements. Before using paid labels for selector training, the project needed to distinguish weak-label errors from paid-adjudicator errors. In particular, one row was an equivalent-surface issue (`113,000+` versus `113k`), one row appears to be a paid-adjudicator false negative or overstrict claim-table rejection despite cited support, and two rows suggest the original weak positive lacked explicit evidence support.

Result: The audit makes zero new OpenAI calls and launches no compute; spend remains `$13.5076056`. It accepts 8/12 rows as high-confidence filtered non-final A-over-B supervision and quarantines 4/12 for manual or second-judge review. The accepted labels are written to `accepted_training_labels.jsonl` with `training_use=allowed_nonfinal_targeted_boundary_adjudication_filtered`.

Tradeoff: Use only the 8 accepted filtered labels for the next selector experiment. Do not buy more OpenAI labels now and do not launch GPU. The quarantined rows are valuable diagnostics showing that both weak local labels and single-pass GPT-4o can be wrong on numeric/list boundary cases; they should not enter training without second-pass review.

### D272. Test filtered boundary selector; keep D262 as active baseline

Decision: Add `grounded-qa-distillation-filtered-boundary-selector.mjs`, materialize `filtered-boundary-selector-gpt4o-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call selector trained only on the 8 accepted D271 A-over-B labels.

Reason: D271 gave a small high-confidence paid boundary subset but quarantined 4/12 rows. The right test was whether those accepted labels can produce a selector or D262 hybrid that improves final diagnostic candidate selection without sacrificing broad existing-validation support behavior.

Result: The run makes zero new OpenAI calls and launches no compute; total spend remains `$13.5076056`. After using scale-only normalization for the tiny pairwise dataset, the boundary model fits the 8 accepted labels (8/8). Boundary-only scoring improves final diagnostic selection from D262's 4/8 to 5/8 and final pairwise from 35/61 to 36/61, but it fails preservation badly on existing validation: 16/24 versus D262's 19/24. The best leakage-safe hybrid selected by preserving existing validation uses `alpha_boundary_weight=0.3`, improves existing validation to 20/24 and final pairwise to 37/61, but final diagnostic selection remains 4/8.

Tradeoff: The paid boundary labels expose a real numeric/list-scope signal, but the selector still cannot safely recover the final-selection gain while preserving the broader support objective. Do not integrate boundary-only or hybrid scoring yet, do not buy more labels now, and do not launch GPU. Keep D262 as the active cheap selector baseline. The next useful zero-cost step is to audit why the boundary-only 5/8 gain disappears under preservation-constrained hybrid selection.

### D273. Audit boundary-hybrid tradeoff; reject large-margin override

Decision: Add `grounded-qa-distillation-boundary-hybrid-tradeoff-audit.mjs`, materialize `boundary-hybrid-tradeoff-audit-gpt4o-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call diagnostic audit explaining why D272's boundary-only 5/8 final-selection gain disappears in the selected hybrid.

Reason: D272 showed that boundary-only scoring recovers one final diagnostic example but fails existing validation, while the validation-preserving hybrid returns to 4/8 final selection. The project needed to know whether the lost rescue was a small calibration miss or a large override of the D262 baseline.

Result: The audit makes zero OpenAI calls and launches no compute; total spend remains `$13.5076056`. Boundary-only has exactly 1 rescue over D262, `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137`, and the selected hybrid loses it. Recovering that rescue requires `alpha_boundary_weight ~= 2.306844`, far above the selected validation-preserving alpha `0.3`. The alpha grid shows that this is not a small-weight hybrid effect; it requires overriding a large D262 margin on the final diagnostic example.

Tradeoff: Do not integrate the boundary gate, do not buy more labels, and do not launch GPU. Keep D262 as active baseline. The next useful work is a focused zero-cost audit of the lost-rescue example as an answer-generation/ranking-margin failure, because more broad labels are unlikely to fix a case where the needed boundary signal has to overpower the main selector by a large margin.

### D274. Quarantine the boundary lost-rescue example as ambiguous final diagnostic

Decision: Add `grounded-qa-distillation-lost-rescue-example-audit.mjs`, materialize `lost-rescue-example-audit-2004-03090-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call final-diagnostic audit of D273's only boundary-only rescue.

Reason: D273 showed that recovering the lone boundary-only rescue requires a large override of the D262 selector. Before training against that signal or buying more labels, the project needed to determine whether the case was a clean ranking-margin failure, a candidate-generation gap, or a final-label quality problem.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. The example `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` is label-ambiguous: the user question asks “Which news outlets did they focus on?”, the QASPER reference answer is `natural dialog [E2]`, and the only existing-judge-supported generated candidate answers with a dataset list, `Interview, DailyDialog, and CALLHOME [E4]`. D262 and the selected hybrid prefer an unsupported `Interview dataset/settings` answer, while boundary-only selects the supported dataset-list candidate. That means the rescue is real under the existing support judge but not a clean training target for the final task wording.

Tradeoff: Quarantine this final diagnostic example as a label-quality risk. Do not use it for training, do not buy more OpenAI labels now, and do not launch Prime/GPU work for this failure mode. Keep D262 as the active cheap selector baseline; the next useful zero-cost step is to stratify final-window support metrics by ambiguous question/reference mismatch so selector changes are not judged by noisy final targets.

### D275. Stratify final diagnostic metrics by ambiguity risk

Decision: Add `grounded-qa-distillation-final-ambiguity-stratification-audit.mjs`, materialize `final-ambiguity-stratification-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call final-window stratification audit over the expanded Qwen frontier-pool diagnostic packet.

Reason: D274 showed that D273's only boundary-only rescue is not a clean training or evaluation target. The project needed to know whether that was an isolated bad row or whether the tiny eight-example final diagnostic window contains enough question/reference/candidate ambiguity to distort selector decisions.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It flags 3/8 final diagnostic examples as ambiguity-risk: the D274 news-outlet/dialog mismatch, a model-explanation metric/scope mismatch, and a NER performance row with low reference-evidence coverage plus numeric-format risk. On the full final diagnostic, boundary-only is 5/8 selected-supported versus D262's 4/8. On the clean stratum, that gain disappears: D262, boundary-only, and the selected hybrid are all 3/5 selected-supported with mean selected-reference overlap `0.8`. Boundary-only's extra apparent win lives in the ambiguity-risk stratum, where it is 2/3 versus D262's 1/3.

Tradeoff: Do not integrate the boundary selector, do not buy more OpenAI labels now, and do not launch Prime/GPU work for this failure mode. Report final-window results with a clean versus ambiguity-risk stratum, and use non-final data or curated replacement final rows before using the remaining final diagnostic gap to justify model-scale changes.

### D276. Promote a clean non-final validation slice for immediate selector diagnostics

Decision: Add `grounded-qa-distillation-clean-validation-slice-audit.mjs`, materialize `clean-validation-slice-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call non-final diagnostic slice built from the expanded support-ranker validation packet plus existing selector predictions.

Reason: D275 showed that the eight-example final diagnostic is too noisy to justify selector integration or model-scale spend. The next needed artifact was a cleaner replacement diagnostic that uses non-final labels, includes final-like hard cases, and does not leak final-window rows into training, tuning, or evaluation.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It finds 7 clean validation examples and 19 clean pairwise rows out of 9 validation examples and 24 total validation pairs, with numeric, list/multi-part, abstention, unsupported-distractor, and near-miss-unsupported difficulty tags represented. On the clean pairwise slice, D262 constrained accuracy is `0.736842`, boundary-only is `0.578947`, and selected hybrid is `0.789474`. On clean per-example tournament selection, D262 constrained, D262 pool-pairwise, and boundary-only each select supported candidates on `5/7`, while selected hybrid selects supported candidates on `6/7`.

Tradeoff: Promote the clean non-final validation slice as the immediate selector diagnostic, but do not integrate boundary-only scoring, buy more OpenAI labels, or launch Prime/GPU work. The selected hybrid has a useful signal on this small clean slice, but it should be expanded or confirmed with more clean held-out examples before changing the active D262 baseline.

### D277. Audit selector coverage before promoting the selected hybrid

Decision: Add `grounded-qa-distillation-selector-coverage-confirmation-audit.mjs`, materialize `selector-coverage-confirmation-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call held-out selector coverage audit.

Reason: D276 found a promising selected-hybrid result on the clean validation slice, but that slice is small. Before changing the active selector, the project needed to know whether the same policy has broader non-final coverage or whether the broader evidence comes from different selector families.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It compares 19 selector/slice rows across existing validation, frontier-pool validation, and Qwen reference validation. The D272 selected hybrid covers only the existing-validation slice, where it is `20/24` correct, and has `0` frontier-pool validation pairs. Broader frontier-pool validation evidence exists for the Qwen contrast, claim-NLI, and hard-negative selector families; the hard-negative variants are strongest at `19/21`, but those are not the exact D272 selected-hybrid policy.

Tradeoff: Do not promote the selected hybrid, do not buy more OpenAI labels, and do not launch Prime/GPU work. The next useful step is a zero-call frontier replay or comparable-coverage clean pairwise packet so D262, boundary-only, selected-hybrid, and hard-negative/claim-NLI families can be compared on the same held-out rows.

### D278. Replay boundary scoring on frontier-pool validation rows; reject promotion

Decision: Add `grounded-qa-distillation-frontier-replay-audit.mjs`, materialize `frontier-replay-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call same-row replay over the 21 non-final frontier-pool validation pairs.

Reason: D277 showed that the D272 selected hybrid lacked direct frontier-pool coverage. The next leakage-safe test was to replay D272 boundary features on the same frontier validation rows covered by the hard-negative D262 proxy, then evaluate boundary-only and the selected `alpha_boundary_weight=0.3` hybrid without final labels.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. The D262 proxy hard-negative baseline is `19/21` on frontier validation. Replayed boundary-only scoring collapses to `10/21` and disagrees with D262 on 13 pairs. The selected hybrid also lands at `19/21`, tying rather than beating the D262 proxy.

Tradeoff: Do not promote the selected hybrid, do not integrate boundary-only, do not buy more OpenAI labels, and do not launch Prime/GPU work. The boundary signal is too brittle on frontier-pool validation. The next useful zero-call work should focus on the hard-negative/frontier signal: design a comparable-coverage hybrid only if it preserves existing validation and beats D262 on frontier validation without relying on final rows.

### D279. Gate hard-negative selector promotion against clean validation

Decision: Add `grounded-qa-distillation-hard-negative-promotion-gate-audit.mjs`, materialize `hard-negative-promotion-gate-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call promotion gate for the hard-negative selector family.

Reason: D278 showed that boundary features do not beat the hard-negative D262 proxy on frontier rows. Before treating the hard-negative selector as the active scaffold, the project needed a same-artifact promotion gate that checks frontier validation, clean non-final validation, and final-window ambiguity diagnostics without using final rows for tuning or spending more budget.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. The hard-negative baseline, hard-negative-weighted, and risk-penalized selectors all tie the D262 frontier proxy at `19/21` on non-final frontier validation. On existing validation, baseline and risk-penalized are `19/24`, while hard-negative-weighted regresses to `16/24`. On the clean non-final slice, baseline and risk-penalized are `14/19`, one pair behind D262 pool-pairwise at `15/19`; hard-negative-weighted is `11/19`. Final-clean rows remain diagnostic-only and are not used for training, tuning, or evaluation.

Tradeoff: Do not promote the hard-negative selector family, do not promote the D262 proxy as a new active selector, do not buy more OpenAI labels, and do not launch Prime/GPU work. The hard-negative signal remains useful supervision for frontier-style failures, but it has not cleared the clean-slice promotion bar. The next useful zero-call work is a comparable-coverage hybrid that must beat both D262 pool-pairwise on the clean slice and the `19/21` frontier proxy without relying on final-window labels.

### D280. Identify a tempered hard-negative hybrid candidate without promoting it

Decision: Add `grounded-qa-distillation-tempered-hard-hybrid-audit.mjs`, materialize `tempered-hard-hybrid-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call comparable-coverage hybrid audit over existing validation and frontier replay rows.

Reason: D279 rejected direct hard-negative selector promotion, but the clean-slice misses suggested that D262 may already contain enough useful signal if the hard-negative margin is treated as an overconfidence feature rather than amplified. The next cheapest test was to grid small hard-negative and boundary margin coefficients while preserving the existing-validation and frontier thresholds.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It evaluates 81 coefficient pairs and finds 10 policies that preserve at least `20/24` existing-validation correctness and `19/21` frontier correctness. The best clean-slice candidate uses `alpha_hard_negative=-0.25` and `alpha_boundary=0`, yielding `20/24` on existing validation, `18/19` on the clean non-final slice, and `19/21` on frontier validation. This improves clean validation by 3 pairs over D262 pool-pairwise while tying the frontier proxy, but the selected coefficient was chosen on the small diagnostic slice.

Tradeoff: Do not promote the tempered hard-negative hybrid, do not buy more OpenAI labels, and do not launch Prime/GPU work. Freeze `alpha_hard_negative=-0.25` as a candidate hypothesis only. The next decision-quality step is to test this frozen coefficient on a larger clean non-final heldout or temporally separate validation slice before changing the active selector or training a student against it.

### D281. Reject D280 promotion after leave-one-clean-example-out instability

Decision: Add `grounded-qa-distillation-tempered-hard-hybrid-loo-audit.mjs`, materialize `tempered-hard-hybrid-loo-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call leave-one-clean-example-out stability audit for the D280 coefficient-selection rule.

Reason: D280 found a promising fixed coefficient, but it was selected on the same 19-pair clean diagnostic slice where it improved performance. Before promoting the coefficient or spending on more labels, the project needed to know whether the selection rule would rediscover the same policy when each clean example is hidden.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. Across seven clean-example folds, the selection rule reselects the D280 frozen policy `alpha_hard_negative=-0.25, alpha_boundary=0` in 6/7 folds. In the remaining fold, holding out the three-pair `2004.04124` example makes the rule fall back to `alpha_hard_negative=0, alpha_boundary=0`. The LOO-selected policies score `15/19` held-out clean pairs, matching D262, while the fixed D280 coefficient still scores `18/19`.

Tradeoff: Do not promote the tempered hard-negative hybrid, do not buy more OpenAI labels, and do not launch Prime/GPU work. The fixed coefficient remains a useful hypothesis, but the policy-selection evidence is too slice-dependent for an active scaffold claim. The next step should create or identify a larger temporally separate clean heldout before any selector promotion or student training target changes.

### D282. Audit heldout coverage before spending on selector validation

Decision: Add `grounded-qa-distillation-heldout-coverage-gap-audit.mjs`, materialize `heldout-coverage-gap-audit-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call inventory of existing heldout sources after D281.

Reason: D281 showed that the D280 coefficient is promising but not stable enough for promotion. Before buying labels or launching GPU work, the project needed to know whether an existing larger heldout can validate the D280 pairwise-margin selector, or whether the larger temporal windows belong to a different scaffold family.

Result: The audit makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It inventories five sources. The largest D280-compatible source is still only 21 pairwise/frontier units, and the only larger heldout source is the 69-example `321-389` temporal candidate-selector window. That temporal window is useful for scaffold-level direct/risk/guard selection claims, but it is not margin-compatible with the D280 Qwen pairwise selector and should not be treated as D280 validation.

Tradeoff: Do not promote D280/D281, do not treat `321-389` as D280 validation, do not buy more OpenAI labels now, and do not launch Prime/GPU work. The next paper-relevant artifact is a margin-compatible clean non-final heldout packet. If no existing packet can be found, the next paid step should be a narrowly scoped label plan for that packet, not broad model training.

### D283. Plan a margin-compatible heldout packet before spending labels or GPU

Decision: Add `grounded-qa-distillation-margin-compatible-heldout-plan.mjs`, materialize `margin-compatible-heldout-plan-qwen-frontier-pool-2026-06-28-v1`, and validate it as a zero-call preflight for turning the `321-389` temporal window into a D280-compatible heldout.

Reason: The saved secret store already contains `OPENAI_API_KEY` and `PRIME_API_KEY`, so the current blocker is not user input. The methodological blocker is compatibility. The `321-389` window has 69 examples, 69 direct/risk/guard candidate triplets, and 36 zero-call supported-vs-unsupported scaffold contrasts across 18 examples, but those artifacts do not include the full Qwen pairwise-margin rows or claim-NLI scores required to validate the D280 hard-negative margin selector. The existing claim-NLI cache has 505 score rows, but they cover existing Qwen/frontier candidates rather than the `321-389` direct/risk/guard candidate claims.

Result: The plan makes zero OpenAI calls and launches no compute, so total spend remains `$13.5076056` of the `$100` cap. It rejects treating `321-389` as D280 validation now, requires building a margin-compatible candidate packet next, and estimates that if the preflight passes, adjudicating the 18 available final-window pools with GPT-4o would cost about `$0.095576`, or `$0.191152` with a 2x conservative buffer, bringing projected total spend to `$13.698758`.

Tradeoff: Do not buy labels or launch Prime/GPU yet. The next step is packet construction: produce Qwen/frontier-style candidate pairs for the `321-389` heldout, verify claim-NLI feature coverage, then run the narrow paid pool-adjudication batch only if the packet is complete and still under budget.

### D284. Reject the existing 321-389 scaffold pool as D280 heldout evidence

Decision: Add `grounded-qa-distillation-margin-compatible-heldout-packet.mjs`, `grounded-qa-distillation-margin-compatible-heldout-nli.mjs`, and `grounded-qa-distillation-margin-compatible-heldout-eval.mjs`; materialize `margin-compatible-heldout-packet-321-389-2026-06-28-v1`, `margin-compatible-heldout-nli-321-389-2026-06-28-v1`, and `margin-compatible-heldout-eval-321-389-2026-06-28-v1`; and validate all three as fail-closed heldout artifacts.

Reason: D283 showed that the `321-389` temporal window might contain reusable scaffold contrasts, but compatibility needed to be tested at the actual pair/feature level. The packet builder found 207 direct/risk/guard support labels across 69 examples and 20 raw supported-answer-over-unsupported-answer pairs across 11 examples. However, every one of those 20 raw pairs is an exact duplicate candidate text with different inherited judgments. After exact-duplicate filtering, there are `0` usable feature-contrast pairs and `0` required claim-NLI units.

Result: The NLI and frozen-eval stages therefore correctly become no-op/fail-closed artifacts: `heldout_nli_no_units` and `heldout_eval_no_usable_pairs`. They make zero OpenAI calls, launch no rented compute, and leave total spend at `$13.5076056` of the `$100` cap. The validator now rejects counting duplicate-only pairs as D280 evidence.

Tradeoff: Do not promote D280, do not buy labels for this duplicate scaffold pool, and do not launch GPU for this path. The next useful heldout step must create genuinely different candidate alternatives, likely by generating or mining Qwen/frontier-style candidates for a non-final or temporally separate window before adjudication. Existing direct/risk/guard final-window disagreement is judge inconsistency over duplicates, not selector supervision.

### D285. Replay frozen D280 on a broad judged final-window contrast pool; reject it

Decision: Add `grounded-qa-distillation-final-contrast-source-inventory.mjs` and `grounded-qa-distillation-final-margin-compatible-heldout-packet.mjs`, materialize `final-contrast-source-inventory-321-389-2026-06-28-v1`, `final-margin-compatible-heldout-packet-321-389-2026-06-28-v1`, `final-margin-compatible-heldout-nli-321-389-2026-06-28-v1`, and `final-margin-compatible-heldout-eval-321-389-2026-06-28-v1`, and validate the full zero-call frozen replay.

Reason: D284 showed that the direct/risk/guard scaffold pool was unusable because all supported-vs-unsupported answer pairs were exact duplicates. The repository, however, contains many already-judged final-window Qwen, local, and scaffold prediction families. The inventory therefore mined all 69-row `321-389` prediction runs with matching `prediction_run` judge rows before spending more. It found 65 prediction runs with full final rows, 22 with full judgments, 1,518 support labels, and 865 non-duplicate supported-answer-over-unsupported-answer contrast pairs across 49 examples, excluding 26 exact duplicates.

Result: The final margin-compatible packet required 987 local claim-NLI units, all scored with the local `cross-encoder/nli-distilroberta-base` path. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap. Frozen replay on 865 final-window pairs does not validate D280: D262 gets `543/865` pairwise correct (`62.8%`), hard-negative replay gets `532/865` (`61.5%`), and frozen D280 falls to `474/865` (`54.8%`). D280 candidate selection picks supported answers for `34/49` examples (`69.4%`), below the promotion threshold.

Tradeoff: Reject D280 promotion. The broad heldout says the small clean-slice D280 gain was not robust under final-window prediction-family diversity. Do not buy more labels or launch GPU to rescue this coefficient. The next selector path should analyze D280's heldout regressions and either return to the D262 baseline or design a new selector objective from the broad contrast pool with strict train/eval separation.

### D286. Train a broad non-final contrast selector; keep it as pairwise-only signal

Decision: Materialize non-final contrast inventories for `0-80`, `80-160`, `160-240`, and `240-320`; add `grounded-qa-distillation-nonfinal-margin-compatible-train-packet.mjs` and `grounded-qa-distillation-broad-contrast-selector-transfer.mjs`; materialize `nonfinal-margin-compatible-train-packet-0-320-2026-06-28-v1`, `nonfinal-margin-compatible-train-nli-0-320-2026-06-28-v1`, and `broad-contrast-selector-transfer-0-320-to-321-389-2026-06-28-v1`; and validate the zero-call transfer probe.

Reason: D285 rejected frozen D280 but showed that broad prediction-family contrast rows are a better evaluation surface than the tiny clean slice. To avoid tuning on final labels, I mined existing judged non-final windows. They are sparse: `0-80` has 14 usable contrasts, `80-160` has 24, `160-240` has 0, and `240-320` has 20, for 58 total pairs across 42 examples. This is not enough for a final claim, but it is enough for a zero-call transfer probe.

Result: The non-final broad pairwise selector trains to `42/58` pairwise correct (`72.4%`) and transfers to `572/865` on the broad final heldout (`66.1%`), beating the D262 replay's `543/865` (`62.8%`). However, pairwise improvement does not translate to candidate selection: selected supported answers fall to `19/49` (`38.8%`). The hard-weighted variant is not selected. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the broad contrast selector. It is a useful ranking signal and a clue that D262 is leaving pairwise accuracy on the table, but the selection collapse means the project needs a listwise or coverage-constrained objective before selector integration. Do not buy labels or launch GPU until the next probe explicitly separates pairwise ranking from per-example candidate selection.

### D287. Separate oracle-edge pairwise signal from deployable tournament selection

Decision: Add `grounded-qa-distillation-oracle-edge-tournament-audit.mjs` and `grounded-qa-distillation-deployable-tournament-audit.mjs`; materialize `oracle-edge-tournament-audit-broad-contrast-2026-06-28-v1` and `deployable-tournament-audit-broad-contrast-2026-06-28-v1`; and validate both audits as zero-call artifacts.

Reason: D286 showed a real pairwise improvement but a candidate-selection collapse. The next question was whether simple aggregation could rescue selection, or whether the result depended on the structure of the comparison graph. The oracle-edge audit aggregates the learned pairwise margins only over heldout supported-vs-unsupported edges, which is not deployable because labels choose the graph. The deployable audit instead builds the complete candidate graph from selector score differences, using no support labels for edge construction.

Result: The oracle-edge win-count tournament selects supported answers for `49/49` final heldout examples, and margin-sum selects `47/49`, proving the broad pairwise signal is meaningful when the graph contains informative supported-vs-unsupported edges. The deployable complete-graph tournament does not rescue selection: raw-score, win-count, margin-sum, Copeland, and Copeland-plus-margin all select only `19/49` supported answers (`38.8%`), matching the D286 pointwise collapse. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote tournament selection, do not buy labels, and do not launch GPU for this branch. The failure is not primarily model scale or GPU availability; it is the absence of a deployable comparison graph/listwise objective that can focus scoring on support-discriminative candidate differences. The next successful path should either learn graph construction, add coverage/listwise constraints, or train against candidate-set selection directly rather than expecting pairwise scalar margins to transfer through a complete graph.

### D288. Treat generator/source reliability as a deployable listwise feature

Decision: Add `grounded-qa-distillation-family-prior-listwise-audit.mjs`, materialize `family-prior-listwise-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call promising-but-not-promoted selector audit.

Reason: D287 showed that complete pairwise aggregation cannot rescue selection, but the final candidate pool revealed a deployable metadata signal: candidate source family reliability. To avoid final-label tuning, the audit estimates smoothed family priors only from the non-final `0-320` judged contrast packet, then selects final candidates by family prior with the broad selector score used only as a tiebreaker.

Result: The non-final family prior has `45/58` pairwise accuracy (`77.6%`) on the training contrasts. On the final `321-389` heldout candidate pool it selects supported answers for `42/49` examples (`85.7%`), a `+23` selected-supported lift over both the raw broad selector and the deployable complete tournament (`19/49`). The selected family distribution is mostly `openai_scaffold` (`47/49` selections), with one `qwen05b` and one `qwen3b` fallback. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: This is the first strong deployable selector signal after the broad heldout failures, but it is not a final paper claim because the non-final supervision is sparse and does not cover every final family. Do not launch Prime/GPU or buy more labels yet. The next step should preregister a listwise selector that combines source reliability with evidence/claim features and stress-tests it across additional temporally separated windows.

### D289. Reject stationary source reliability; require time-aware selector stress tests

Decision: Add `grounded-qa-distillation-family-prior-temporal-stress-audit.mjs`, materialize `family-prior-temporal-stress-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call temporal-shift audit.

Reason: D288 found a strong final-window result, but the project is about evolving knowledge bases, so a stationary source-family prior must survive temporal stress tests. The audit therefore evaluates leave-one-window-out and chronological-prefix pairwise prediction over the non-final windows, and records final-window tie sensitivity and recency-weighted variants without using final labels for training.

Result: Stationary source reliability is not temporally robust. Chronological-prefix pairwise accuracy is only `18/44` across nonempty future non-final windows, with the critical `0-160` to `240-320` test at `1/20`. This explains why a source prior can look strong on `321-389` while still being unsafe as a general claim. On the final window, tie handling also matters: raw-order tie handling gives `44/49` supported, while the committed raw-then-id policy gives `42/49`. Recency policies are directionally consistent with a late source shift: first-two-window priors select only `4/49` supported final answers, while last-nonempty-window and recency-weighted priors select `42/49`. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the family-prior selector as a stationary scaffold, do not buy more labels, and do not launch Prime/GPU. The next selector should be explicitly time-aware: train source reliability over recent windows, preregister tie handling, and combine source priors with evidence/claim features before making any NeurIPS-level claim about amortized grounded QA over evolving KBs.

### D290. Prefer normalized source prefixes over exact run IDs for transferable reliability

Decision: Add `grounded-qa-distillation-source-prefix-reliability-audit.mjs`, materialize `source-prefix-reliability-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call source-identity audit.

Reason: D289 showed that source reliability must be time-aware, but broad family is probably too coarse. The next deployable question is what source identity should mean for future windows. Exact prediction-run IDs are too specific because future run IDs are unseen; normalized source prefixes may transfer across temporal suffixes while remaining available at inference time.

Result: Exact prediction-run reliability does not transfer: all `49/49` selected final examples rely on family fallback because the final top run IDs are unseen, so exact-run selection remains `42/49`. Normalized source-prefix reliability partially transfers and improves final selection to `44/49`, a `+2` lift over the committed family-prior result, with `14` unknown-top fallbacks instead of `49`. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the source-prefix selector yet. The result supports adding normalized source-prefix reliability as a feature in the next preregistered time-aware listwise selector, but exact run IDs should not be used as a transferable feature. This is still a scaffold/feature-design result, not a reason to launch Prime/GPU.

### D291. Time-aware source-prefix reliability is a partial robustness gain, not a promoted selector

Decision: Add `grounded-qa-distillation-time-aware-source-prefix-selector-audit.mjs`, materialize `time-aware-source-prefix-selector-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call preregistered time-aware selector audit.

Reason: D290 showed that normalized source prefixes transfer better than exact run IDs. D289 showed that stationary reliability fails under temporal stress. The next selector therefore preregisters a time-aware normalized source-prefix policy with recency weighting, broad-family fallback, and deterministic tie handling before checking final labels.

Result: The preregistered `source_prefix_recency_4x` policy preserves the D290 final selection result at `44/49` supported answers. It does improve non-final chronological stress over the broad family prior: the hard `0-160` to `240-320` prefix split rises from `1/20` to `7/20`, and overall nonempty prefix accuracy rises to `27/44`. That is a real robustness gain, but it remains too weak for a promoted evolving-KB selector. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the time-aware source-prefix selector, do not buy labels, and do not launch Prime/GPU. The next useful selector needs source-prefix recency as one feature plus candidate-internal evidence/claim features; source metadata alone cannot carry a NeurIPS-level claim about citation-grounded correctness over evolving KBs.

### D292. Naive candidate-internal NLI and answer-shape overlays do not improve listwise selection

Decision: Add `grounded-qa-distillation-candidate-internal-feature-overlay-audit.mjs`, materialize `candidate-internal-feature-overlay-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call negative overlay audit.

Reason: D291 showed that time-aware source-prefix reliability is useful but leaves five final-window misses. The next hypothesis was that existing local claim-NLI and answer-shape features could demote unsupported over-expanded answers or unknown weak candidates when used as listwise overlays on top of the source-prefix selector.

Result: Candidate-internal features are directionally informative in non-final pairwise diagnostics: NLI entailment-min gets `42/58`, NLI margin-mean gets `40/58`, and citation count gets `56/58` in the supported direction. But simple final listwise overlays do not improve the selector. Small NLI, length, and NLI-minus-length overlays remain at `44/49`, while a larger NLI-margin overlay regresses to `34/49`. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote candidate-internal overlays, do not buy labels, and do not launch Prime/GPU. The next step should mine targeted contrast data for the five remaining source-prefix misses and learn features against those failure modes, rather than hand-weighting generic NLI or answer-length signals.

### D293. Mine targeted same-citation overexpansion contrasts for the remaining misses

Decision: Add `grounded-qa-distillation-targeted-miss-contrast-mining-audit.mjs`, materialize `targeted-miss-contrast-mining-audit-321-389-2026-06-28-v1`, and validate it as a zero-call mining audit.

Reason: D292 showed that generic NLI and answer-shape overlays do not improve the `44/49` source-prefix selector. The five remaining misses needed to be converted into a concrete post-training data construction target. The audit therefore analyzes each miss against supported final candidates and searches the non-final contrast packet for matching failure modes.

Result: The five final misses are concentrated rather than diffuse: `4/5` are same-citation misses, `3/5` are unsupported-longer overexpansions, `4/5` have explicit unsupported-claim evidence available, `4/5` have a concise supported candidate available, and `2/5` select unknown Qwen-family candidates. Existing non-final supervision is sufficient for a targeted next step: `55` non-final target contrasts have unsupported-claim evidence, including `29` same-citation unsupported-claim contrasts, `7` same-citation unsupported-longer contrasts, and `2` concise same-citation overexpansion contrasts. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote a selector, buy labels, or launch Prime/GPU. The next useful artifact is a targeted contrast packet and preregistered miss-aware selector trained on these mined non-final rows. This is better aligned with the paper question than more generic model scaling because it directly tests how to construct post-training data for citation-grounded correctness under evolving KB drift.

### D294. Use the targeted packet for post-training, not as a hand-written selector rule

Decision: Add `grounded-qa-distillation-targeted-miss-aware-selector-audit.mjs`, materialize `targeted-miss-aware-selector-audit-0-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call targeted-packet-plus-selector audit.

Reason: D293 found `55` non-final target contrasts, including `7` high-priority same-citation overexpansion contrasts. The next question was whether those mined rows immediately justify a deployable miss-aware selector, or whether they should be treated as post-training/evaluation data for a learned scaffold.

Result: The packet is useful but the hand-written selector is not. The high-priority shape guard matches `6/7` mined overexpansion contrasts, showing that the packet captures the intended local failure mode. But the preregistered deployable same-citation rescue rule over-applies on the final listwise pool: it switches `12` examples, rescues `3` previous misses, regresses `8` previously supported selections, and drops final support from the `44/49` source-prefix baseline to `39/49`. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the miss-aware selector, buy labels, or launch Prime/GPU. Keep the targeted packet as `allowed_nonfinal_targeted_post_training_data`; the next run should fit or train a bounded learner/scaffold on the packet and test temporal transfer instead of encoding the failure mode as a brittle hand-written listwise rule.

### D295. A bounded targeted-packet learner is unstable without broad preservation examples

Decision: Add `grounded-qa-distillation-targeted-packet-learner-transfer-audit.mjs`, materialize `targeted-packet-learner-transfer-audit-0-160-to-240-320-to-321-389-2026-06-28-v1`, and validate it as a zero-call bounded learner transfer audit.

Reason: D294 showed that a hand-written same-citation rescue rule over-applies. The next question was whether the targeted packet can support a learned scaffold instead. To avoid final-label tuning, the audit fits a small pairwise logistic learner on early non-final targeted rows (`0-80` and `80-160`), validates the overlay rule on the later `240-320` targeted rows, and uses final `321-389` labels only for reporting.

Result: The targeted packet contains a real but unstable signal. The learner underfits the early targeted train rows at `14/38`, while scoring `16/17` on the later targeted validation window. Because the preregistered overlay rule requires both train accuracy `>=0.55` and validation accuracy `>=0.80`, the selected overlay alpha is `0`; final heldout selection stays at the source-prefix baseline of `44/49` with no switches, rescues, or regressions. No OpenAI calls or rented compute were used, so total spend remains `$13.5076056` of the `$100` cap.

Tradeoff: Do not promote the targeted learner overlay, buy labels, or launch Prime/GPU. Keep the targeted packet, but the next training-data construction step must balance targeted overexpansion rows with broad preservation examples so the learner does not simply encode a temporally unstable answer-shape preference.
