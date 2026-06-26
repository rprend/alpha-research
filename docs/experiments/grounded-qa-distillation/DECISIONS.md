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
