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

Reason: The project now requires tracking all LLM API calls made with the user's key. The OpenAI student, teacher, and judge runners record model, run id, split, example id, token usage, cost, and price source for every successful call. They refuse runs whose estimated cost plus ledgered spend would exceed the budget. Current ledgered spend is $1.37595460 across 1207 OpenAI calls.

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
