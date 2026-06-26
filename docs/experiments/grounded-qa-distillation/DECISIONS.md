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
