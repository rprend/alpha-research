# Citation Grounding And Compact Memory Comparison

Generated: 2026-06-27T00:51:48.301Z

## Close Neighbors

- [Citation-Enforced RAG for Fiscal Document Intelligence: Cited, Explainable Knowledge Retrieval in Tax Compliance](https://arxiv.org/abs/2603.14170) (medium_high)
- [Citation Grounding: Detecting and Reducing LLM Citation Hallucinations via Legal Citation Graphs](https://arxiv.org/abs/2606.00898) (high)
- [FD-RAG: Federated Dual-System Retrieval-Augmented Generation](https://arxiv.org/abs/2605.27432) (high)

## Framing

- Overlap: Citation-enforced domain RAG, citation-grounding metrics, and compact QA memories overlap with the project's citation and amortization story.
- Distinction: The project must claim only update-heldout model/scaffold-side amortization from expensive grounded behavior, with citation existence, support/relevance, temporal validity, abstention support, coverage, and cost reported together.

## Dimensions

### citation_existence

Can cited source ids be made syntactically/existentially valid?

- citation_repaired_qwen3b_base: 100.0%; Deterministic citation repair reaches perfect inline citation syntax on the local Qwen 3B control.
- local_qwen05b_sft_answer_repeat2: 0.0%; Tiny SFT preserves citation format but not support.
- longcite_style_comparison: 0.0%; longcite-style-citation-sft-comparison-2026-06-26-v1 shows citation-SFT framing is necessary but insufficient.

### citation_support_relevance

Are claims supported by the cited evidence, not just cited?

- direct_mini_repair: 64.1%; Direct compact-RAG answers have meaningful but incomplete answer support.
- claim_entailment_guard: 74.1%; The current support-first guard improves support by losing coverage.
- citation_repaired_qwen3b_base: 0.0%; Syntax repair changes citation formatting but provides no judged support evidence.

### temporal_validity

Does the system respect dated/update-heldout KB state?

- copy_first_evidence_versioned_natural_questions: 0.0%; A naive cited-answer baseline fails stale-snapshot abstentions despite inline citation syntax.
- lexical_retriever_snapshot_guard: 100.0%; A simple snapshot-aware retriever solves the deterministic stale-snapshot diagnostic but is not a trained student.
- legal_citation_grounding_neighbor: 0.0%; Legal citation grounding makes temporal validity a first-class citation metric; this project must report analogous update validity instead of syntax alone.

### memory_side_amortization

Could the same economics be explained by compact memory or write-back instead of a distilled model/scaffold?

- leak_safe_train_writeback_only: 0.0%; Train-only write-back cannot answer eval updates on the versioned diagnostic.
- leak_safe_train_writeback_plus_live_snapshot: 100.0%; Live snapshot retrieval plus train write-back can solve the toy diagnostic, so memory-side amortization remains a real baseline family.
- fd_rag_compact_qa_memories_neighbor: 0.0%; FD-RAG-style compact QA memories are a close memory-side amortization neighbor that needs comparison or explicit scoping.

### model_scaffold_amortization_target

What is the paper target if citation grounding and compact memory already exist?

- current_target: 0.0%; The target remains unproven until trained Qwen 3B predictions and paid grounded judging exist.
- faithful_context_qa_positioning: 0.0%; faithful-context-qa-comparison-2026-06-27-v1 scopes compact faithful-context QA as a close final-system baseline.
- writeback_scope: 0.0%; writeback-kb-amortization-scoped-exclusion-2026-06-26-v1 scopes memory-side write-back as a competing amortization route, not the current claim.

## Claim Boundary

- Do not claim citation-enforced domain RAG as new.
- Do not claim citation grounding or citation-hallucination detection as new.
- Do not claim compact-memory or federated RAG amortization as the contribution.
- Claim model/scaffold-side amortization only after the trained Qwen 3B row passes support, coverage, temporal/update, and cost gates.

## True Baseline Or Scope Needed

- Report citation existence, citation support/relevance, and temporal/update validity separately.
- Compare against a compact-memory/write-back baseline on the final update-heldout window, or explicitly scope it as memory-side amortization with leakage risks.
- For any legal/fiscal citation-grounding comparison, explain domain-graph availability differences instead of implying direct comparability.
- After Qwen 3B smoke, add the trained row to this comparison and the distillation-loss accounting table.

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
