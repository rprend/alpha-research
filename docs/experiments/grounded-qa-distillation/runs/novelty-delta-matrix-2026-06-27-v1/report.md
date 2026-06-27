# Novelty Delta Matrix

Generated: 2026-06-27T03:46:43.920Z

Status: `surviving_claim_conditional_on_qwen3b_and_judge`

## Matrix

| Claim ID | Status | Broad Claim | Surviving Delta |
| --- | --- | --- | --- |
| not_generic_rag_to_slm_distillation | rejected_as_not_novel | We introduce RAG-to-small-model distillation. | Only a narrower claim can survive: data construction and evaluation for citation-grounded answer/abstention behavior on compact evidence packs under update-heldout KB states. |
| not_citation_sft_or_citation_metric | rejected_as_not_novel | We train models to cite evidence. | Citation syntax must be treated as a contract surface; novelty can only rest on preserving citation support, abstention support, temporal validity, and cost under amortized deployment. |
| not_dynamic_qa_or_updated_corpus_benchmark | rejected_as_not_novel | We evaluate QA over changing knowledge. | The benchmark story must be subordinated to amortized post-training/scaffold behavior; updated-corpus benchmark construction is already crowded. |
| not_online_agentic_rag_training | rejected_as_not_novel | We distill agentic RAG or deep-research search behavior. | The deployed artifact must be a cheaper answer/scaffold policy over retrieved evidence packs, not an online search/routing agent; online agentic costs must remain a teacher or baseline. |
| not_compact_faithful_context_qa | rejected_as_not_novel | We build a compact faithful context-QA model with citations and abstention. | The paper must show why evolving-KB update splits, amortized teacher/scaffold data, and support/cost preservation are the contribution beyond compact faithful context QA. |
| not_memory_or_index_only_amortization | rejected_or_scoped_out | We amortize RAG by changing the KB, memory, or index. | Model/scaffold-side amortization remains distinct only if write-back, compact-memory, and grounded-index approaches are treated as competing or scoped amortization targets. |
| not_retrieval_side_faithfulness_or_generate_verify | rejected_as_not_novel | We improve citation faithfulness using retrieval/ranking or generate-then-verify. | Retrieval-side decomposition/ranking and online verification are neighbors; the project can only claim that the final cheap model/scaffold preserves support after those expensive teacher/filtering steps are amortized. |
| surviving_conditional_core_claim | conditionally_survives_but_blocked | We provide a measured recipe for amortized grounded QA over evolving domain/private-KB states. | The defensible core is a conjunction: post-training/scaffold data construction, compact evidence packs, inline citations as support contracts, abstention on insufficient evidence, update-heldout KB evaluation, and explicit cost amortization. |

## Allowed Claim Now

A scoped, conditional novelty hypothesis survives: amortized model/scaffold-side grounded QA over update-heldout domain KB states may be novel if the trained Qwen 3B result and paid grounded judge show support preservation with explicit cost accounting. The current artifacts do not yet prove that claim.

## Prohibited Claims Now

- First RAG-to-SLM distillation method.
- First citation SFT, citation-grounding metric, or citation-enforced RAG system.
- First dynamic QA, updated-corpus RAG benchmark, or domain RAG data-generation method.
- First compact faithful context-QA model with citations and abstention.
- First online agentic RAG or enterprise-KB agentic retrieval system.
- First memory/index/write-back amortization method for RAG.
- First retrieval-side citation-faithfulness ranking or generate-then-verify RAG strategy.
- A private enterprise-KB proof.

## Required Before Submission Claim

- Run or report the bounded Qwen 3B joint-action trained-student smoke.
- Run the paid grounded-correctness judge and report support/abstention/citation slices.
- Update the cost/coverage/support Pareto table with actual GPU and judge spend.
- Refresh novelty search at submission time and update this matrix if any close neighbor changes.
- Keep the private-KB claim scoped unless a real versioned private/domain KB benchmark is added.

No OpenAI calls, GPU jobs, or new spend were made for this matrix.
