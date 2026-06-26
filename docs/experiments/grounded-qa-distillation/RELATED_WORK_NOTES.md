# Related Work Notes

This is a living novelty log. It is not yet a complete literature review.

## Preliminary Search Date

2026-06-26

## Current Structured Watchlist

See `runs/novelty-watchlist-2026-06-26-v1/` for the current structured novelty-pressure artifact. It expands this preliminary note with close neighbors on RAG-to-SLM distillation, citation SFT, dynamic QA, grounded response/abstention, and evidence write-back amortization. The artifact is zero-cost and records claims the paper must avoid.

## Close Neighbors Found

### DRAG: Distilling RAG for SLMs from LLMs to Transfer Knowledge

Source: [arXiv HTML](https://arxiv.org/html/2506.01954v1), [ACL PDF](https://aclanthology.org/2025.acl-long.358.pdf)

Relevance: Directly studies distilling RAG behavior from large LMs into small LMs, with evidence-based distillation and hallucination reduction.

Novelty pressure: Very high. Our paper cannot claim generic RAG-to-SLM distillation as new. It must focus on evolving private KBs, citation-grounded correctness, update amortization, and post-training data construction policies.

### Generate-then-Ground in Retrieval-Augmented Generation for Multi-Hop Question Answering

Source: [ACL 2024](https://aclanthology.org/2024.acl-long.397/), [arXiv](https://arxiv.org/html/2406.14891v1)

Relevance: Proposes grounding behavior and instructional grounding distillation for smaller models.

Novelty pressure: High. Our distinction must be citation-faithful QA over changing domain KBs, not just grounding smaller models.

### Rationale Distillation in Retrieval-Augmented Generation

Source: [arXiv HTML](https://arxiv.org/html/2412.08519v2), [ACL Findings PDF](https://aclanthology.org/2025.findings-acl.220.pdf)

Relevance: Distills rationale signals to improve RAG reranking and supportive-document selection.

Novelty pressure: High for evidence selection. Our evidence-selector work should cite this and avoid claiming utility/rationale distillation is new.

### Utility-Based Passage Selection for RAG

Source: [arXiv HTML](https://arxiv.org/html/2507.19102v1)

Relevance: Distills utility-based passage selection from a large teacher into a smaller selector.

Novelty pressure: High for the selector component. Our contribution must be broader than passage selection alone.

### Domain-Specific RAG QA Dataset Construction

Source: [Processes 2026](https://www.mdpi.com/2227-9717/14/1/99)

Relevance: Builds domain QA examples with grounded reference answers and evidence spans.

Novelty pressure: Medium. Dataset construction with evidence is not enough; the paper needs evolving-KB amortization and distillation experiments.

### LongCite: Enabling LLMs to Generate Fine-grained Citations in Long-Context QA

Source: [ACL Findings 2025](https://aclanthology.org/2025.findings-acl.264/)

Relevance: Uses synthetic supervised data to teach fine-grained citation behavior in long-context QA.

Novelty pressure: Very high for citation SFT. Our paper cannot claim citation-supervised QA examples as new; it must measure citation support under compact evidence packs, abstention, and update robustness.

### DynaQuest: A Dynamic Question Answering Dataset Reflecting Real-World Knowledge Updates

Source: [ACL Findings 2025](https://aclanthology.org/2025.findings-acl.1380/)

Relevance: Dynamic QA benchmark targeting real-world knowledge updates.

Novelty pressure: High for evolving QA. Our paper must claim amortized grounded-research training/evaluation over evolving private or domain KBs, not dynamic QA itself.

### GRACE: Reinforcement Learning for Grounded Response and Abstention under Contextual Evidence

Source: [arXiv 2026](https://arxiv.org/html/2601.04525v1)

Relevance: Trains grounded response and abstention behavior under evidence sufficiency.

Novelty pressure: Very high for the joint answer/abstain objective. Our joint-action packet should be framed as data construction and amortization over evolving KBs, not as the first grounded-abstention objective.

### Training the Knowledge Base through Evidence Distillation and Write-Back Enrichment

Source: [arXiv 2026](https://arxiv.org/abs/2603.25737)

Relevance: Offline evidence distillation and write-back is another way to amortize expensive RAG behavior.

Novelty pressure: High. The paper should compare against a KB write-back baseline or explicitly scope model/scaffold distillation as the amortization target.

## Current Novelty Hypothesis

The potentially defensible contribution is:

> A data-construction and evaluation framework for amortizing expensive grounded research agents over evolving private KBs, where generated post-training examples explicitly supervise answer synthesis, citation placement, abstention, claim tables, and update robustness.

This remains unproven. Before a paper-complete claim, we need a full literature review through June 2026 and experiments showing that our update-aware data construction beats generic RAG distillation or passage-selection baselines.
