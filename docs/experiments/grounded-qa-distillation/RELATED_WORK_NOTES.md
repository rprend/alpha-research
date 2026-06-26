# Related Work Notes

This is a living novelty log. It is not yet a complete literature review.

## Preliminary Search Date

2026-06-26

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

## Current Novelty Hypothesis

The potentially defensible contribution is:

> A data-construction and evaluation framework for amortizing expensive grounded research agents over evolving private KBs, where generated post-training examples explicitly supervise answer synthesis, citation placement, abstention, claim tables, and update robustness.

This remains unproven. Before a paper-complete claim, we need a full literature review through June 2026 and experiments showing that our update-aware data construction beats generic RAG distillation or passage-selection baselines.
