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
