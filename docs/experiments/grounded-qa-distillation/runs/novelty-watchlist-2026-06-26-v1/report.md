# Grounded QA Novelty Watchlist

Search date: 2026-06-26

This is a live novelty-pressure artifact, not a complete related-work section.

## Close Neighbors

| Work | Venue/status | Pressure | Overlap axes | Source |
| --- | --- | --- | --- | --- |
| DRAG: Distilling RAG for SLMs from LLMs to Transfer Knowledge and Mitigate Hallucination via Evidence and Graph-based Distillation | ACL 2025 | very_high | rag_to_slm_distillation, evidence_distillation, hallucination_mitigation | [source](https://aclanthology.org/2025.acl-long.358/) |
| Generate-then-Ground in Retrieval-Augmented Generation for Multi-hop Question Answering | ACL 2024 | high | multi_step_rag, grounding_corrections, instructional_distillation_to_smaller_models | [source](https://aclanthology.org/2024.acl-long.397/) |
| Bridging Relevance and Reasoning: Rationale Distillation in Retrieval-Augmented Generation | ACL Findings 2025 | high | rationale_distillation, reranker_alignment, support_document_selection | [source](https://aclanthology.org/2025.findings-acl.220/) |
| LongCite: Enabling LLMs to Generate Fine-grained Citations in Long-Context QA | ACL Findings 2025 | very_high | citation_generation, synthetic_sft_data, long_context_qa | [source](https://aclanthology.org/2025.findings-acl.264/) |
| DynaQuest: A Dynamic Question Answering Dataset Reflecting Real-World Knowledge Updates | ACL Findings 2025 | high | dynamic_qa, knowledge_updates, time_sensitive_questions | [source](https://aclanthology.org/2025.findings-acl.1380/) |
| DRAGOn: Designing RAG On Periodically Updated Corpus | EACL SRW 2026 / arXiv 2025 | very_high | periodically_updated_corpus, rag_benchmarking, question_generation, automatic_evaluation | [source](https://arxiv.org/abs/2507.05713) |
| DRAGON: Domain-specific Robust Automatic Data Generation for RAG | EACL Findings 2026 / arXiv 2025 | high | domain_specific_rag, synthetic_data_generation, multi_hop_queries, retriever_robustness | [source](https://arxiv.org/abs/2505.10989) |
| GRACE: Reinforcement Learning for Grounded Response and Abstention under Contextual Evidence | arXiv 2026 | very_high | grounded_response, abstention, evidence_sufficiency, rl_training | [source](https://arxiv.org/html/2601.04525v1) |
| Search-P1: Path-Centric Reward Shaping for Stable and Efficient Agentic RAG Training | arXiv 2026 | high | agentic_rag_training, path_rewards, offline_reference_planners, sample_efficiency | [source](https://arxiv.org/abs/2602.22576) |
| Training the Knowledge Base through Evidence Distillation and Write-Back Enrichment | arXiv 2026 | high | evidence_distillation, offline_preprocessing, knowledge_base_training, rag_transfer | [source](https://arxiv.org/abs/2603.25737) |
| KohakuRAG: A simple RAG framework with hierarchical document indexing | arXiv 2026 | high | citation_ready_rag, hierarchical_document_indexing, abstention_aware_voting, document_grounded_qa | [source](https://arxiv.org/abs/2603.07612) |
| GROUNDEDKG-RAG: Grounded Knowledge Graph Index for Long-document Question Answering | arXiv 2026 | medium_high | grounded_kg_index, long_document_qa, source_sentence_grounding, cost_latency_reduction | [source](https://arxiv.org/abs/2604.04359) |
| LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation | arXiv 2026 | medium | rag_benchmarking, evidence_integration, abstention, long_context | [source](https://arxiv.org/html/2603.06198v1) |

## Implications

- drag_rag_distillation_slm: Generic RAG-to-small-model distillation is not novel. The grounded-QA project must claim update-aware, citation-grounded, abstention-calibrated data construction rather than generic RAG distillation.
- genground_instructional_grounding: Multi-step generate/ground behavior and smaller-model grounding distillation already exist. The project needs a stronger distinction around evolving private KB snapshots, inline citation contracts, and amortized post-training examples.
- radio_rationale_distillation: Evidence/rationale selection alone is crowded. The project should keep selector baselines as controls, not the main contribution.
- longcite_citation_sft: Citation-supervised SFT data is not novel. The project must evaluate citation-grounded correctness under compact evidence packs, abstention, and evolving-KB update amortization.
- dynaquest_dynamic_qa: Dynamic QA datasets already cover real-world knowledge updates. The grounded-QA project should not claim dynamic QA itself; it should claim amortized grounded-research training/evaluation over evolving private/domain KBs.
- dragon_periodically_updated_rag: Updated-corpus RAG benchmarking and automatic fresh-question generation are close to the evolving-KB evaluation story. The project must emphasize amortized post-training/scaffold behavior and citation-grounded answer support, not just dynamic benchmark construction.
- dragon_domain_rag_data_generation: Domain-specific RAG data generation is not enough for novelty. The project should frame its generated examples as post-training supervision for answer synthesis, inline citations, abstention, and update transfer rather than generic RAG dataset synthesis.
- grace_grounded_response_abstention: Joint answer/abstain training under contextual evidence is now a direct neighbor. The project should position joint-action SFT/DPO as a data-construction and amortization study, not as the first joint grounding-abstention objective.
- search_p1_agentic_rag_training: Training agentic RAG trajectories is an active neighboring path. The grounded-QA project should avoid claiming agentic-search training as new and instead test whether expensive grounded research traces can be amortized into cheaper citation-faithful answer/scaffold behavior over update-heldout KB states.
- writeback_rag_evidence_distillation: Offline evidence distillation into the corpus is a close amortization alternative. The project should compare model/scaffold distillation against KB write-back or explicitly scope it as a different amortization target.
- kohakurag_hierarchical_citation_rag: Citation-ready document RAG with hierarchy and abstention-aware voting is a close system-level baseline. The project should avoid claiming citation-grounded RAG itself and instead emphasize amortized post-training data and update-heldout grounded correctness.
- groundedkg_rag_grounded_graph_index: Grounded indexes can reduce context cost without training a student. The paper should treat grounded retrieval/index construction as a competing amortization path or make clear that the target here is model/scaffold behavior distilled from expensive agents.
- lit_ragbench_generator_capabilities: Generator benchmarking for RAG includes abstention and evidence integration. The project needs a stronger evaluation claim around update robustness, cost per grounded answer, and citation-support correctness.

## Current Novelty Hypothesis

The defensible contribution is not generic RAG distillation, citation SFT, dynamic QA, or abstention training. It is a measured data-construction and evaluation recipe for amortizing expensive grounded research behavior over evolving private/domain KBs, preserving inline citation support and abstention calibration under update splits.

## Claims To Avoid

- First RAG-to-small-model distillation method.
- First citation-grounded QA SFT dataset.
- First dynamic QA benchmark.
- First updated-corpus RAG benchmark or automatic RAG data-generation framework.
- First joint grounded-answer and abstention objective.
- First agentic RAG training or trajectory-distillation method.
- First evidence-distillation amortization method for RAG.

## Required Before Paper Claim

- Run the bounded Qwen 3B joint-action smoke and evaluate grounded correctness on the held-out future window.
- Show that the contribution is not explainable as updated-corpus benchmark construction or domain RAG data generation alone.
- Compare against a generic DRAG-like RAG distillation baseline or clearly justify why the available implementation is not comparable.
- Compare against a LongCite-style citation SFT framing by reporting citation support, not just citation syntax.
- Position agentic-RAG trajectory training as a neighbor and report why the cheaper deployed artifact is a model/scaffold for grounded citation QA rather than an online search agent.
- Add a KB-update baseline inspired by WriteBack-RAG or state why model-side amortization is the target.
- Use a trusted dated/private KB snapshot rather than only arXiv-id-inferred temporal splits.

## Budget

No OpenAI API calls, no GPU jobs, and no new spend.
