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
