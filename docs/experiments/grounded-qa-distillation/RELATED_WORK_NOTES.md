# Related Work Notes

This is a living novelty log. It is not yet a complete literature review.

## Preliminary Search Date

2026-06-27

## Current Structured Watchlist

See `runs/novelty-watchlist-2026-06-26-v1/` for the current structured novelty-pressure artifact. It expands this preliminary note with close neighbors on RAG-to-SLM distillation, compact agentic RAG, citation SFT, dynamic QA, grounded response/abstention, compact faithful context QA, enterprise KB agentic RAG, and evidence write-back amortization. The artifact is zero-cost and records claims the paper must avoid.

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

### DRAGOn: Designing RAG On Periodically Updated Corpus

Source: [arXiv](https://arxiv.org/abs/2507.05713)

Relevance: Builds a benchmark/data-generation loop for RAG over periodically updated corpora.

Novelty pressure: Very high for the evolving-KB evaluation story. Our paper cannot claim updated-corpus RAG benchmarking or automatic fresh-question generation as new. The defensible axis is whether expensive grounded research behavior can be amortized into a cheaper citation-faithful model/scaffold under update-heldout KB states.

### DRAGON: Domain-specific Robust Automatic Data Generation for RAG

Source: [arXiv](https://arxiv.org/abs/2505.10989)

Relevance: Generates domain-specific RAG data, including more complex query forms.

Novelty pressure: High for data construction. Generic domain RAG data generation is not enough; the project needs post-training examples that supervise answer synthesis, inline citations, abstention, claim tables, and update transfer, then prove those choices improve grounded correctness.

### GRACE: Reinforcement Learning for Grounded Response and Abstention under Contextual Evidence

Source: [arXiv 2026](https://arxiv.org/html/2601.04525v1)

Relevance: Trains grounded response and abstention behavior under evidence sufficiency.

Novelty pressure: Very high for the joint answer/abstain objective. Our joint-action packet should be framed as data construction and amortization over evolving KBs, not as the first grounded-abstention objective.

### Search-P1: Path-Centric Reward Shaping for Stable and Efficient Agentic RAG Training

Source: [arXiv](https://arxiv.org/abs/2602.22576)

Relevance: Trains agentic RAG behavior with path-centric rewards and offline reference planners.

Novelty pressure: High for agentic-RAG training. Our paper should not claim agentic search training or trajectory distillation as new. The paper must distinguish a cheaper deployed artifact for citation-grounded QA from an online search agent trained with reward shaping.

### DGPO: Can Compact Language Models Search Like Agents?

Source: [ACL 2026](https://aclanthology.org/2026.acl-long.1751/)

Relevance: Directly targets compact model preservation of agentic RAG capabilities from teacher demonstrations.

Novelty pressure: Very high for compact agentic-RAG distillation. Our distinction must be update-heldout citation-grounded answer/abstention correctness and amortized deployed inference cost, not compact agentic RAG capability transfer in general.

### InfoSeek / Open Data Synthesis for Deep Research

Source: [OpenReview ICLR 2026](https://openreview.net/forum?id=2c9TjRbAib)

Relevance: Synthesizes large-scale open data for deep-research and agentic search-style training.

Novelty pressure: High for data synthesis. Our data examples must be positioned as compact evidence-pack post-training supervision with citations, abstention, and update snapshots rather than as the first deep-research data-generation pipeline.

### DeepSieve: Information Sieving via LLM-as-a-Knowledge-Router

Source: [EACL Findings 2026](https://aclanthology.org/2026.findings-eacl.160/)

Relevance: Uses an LLM as a knowledge router for agentic retrieval over heterogeneous sources.

Novelty pressure: High for online routing agents. Our paper should treat source-routing/search agents as expensive behavior to amortize or compare against, not as the deployed target.

### Training the Knowledge Base through Evidence Distillation and Write-Back Enrichment

Source: [arXiv 2026](https://arxiv.org/abs/2603.25737)

Relevance: Offline evidence distillation and write-back is another way to amortize expensive RAG behavior.

Novelty pressure: High. The paper should compare against a KB write-back baseline or explicitly scope model/scaffold distillation as the amortization target.

### KohakuRAG: Hierarchical Document Indexing for Citation-Ready RAG

Source: [arXiv 2026](https://arxiv.org/abs/2603.07612)

Relevance: Citation-ready RAG with hierarchical document indexing, evidence selection, and abstention-aware voting is close to the system surface of our task.

Novelty pressure: High. The paper should not claim citation-grounded RAG itself. The distinction must be amortized post-training or scaffold construction from expensive grounded behavior over update-heldout KB states.

### GROUNDEDKG-RAG: Grounded Knowledge Graph Index for Long-document QA

Source: [arXiv 2026](https://arxiv.org/abs/2604.04359)

Relevance: Grounded graph indexes provide another route to lower-cost source-grounded long-document QA without training a small answerer.

Novelty pressure: Medium-high. The paper should treat grounded retrieval/index construction as a competing amortization path and focus the main claim on preserving citation-grounded answer and abstention behavior in the cheaper model/scaffold.

### OCC-RAG: Optimal Cognitive Core for Faithful Question Answering

Source: [arXiv 2026](https://arxiv.org/html/2606.00683v1)

Relevance: Trains a compact model for faithful context QA with source citations and safe abstention.

Novelty pressure: Very high for the final student/scaffold surface. Our paper needs the evolving-KB/update-heldout protocol, amortization economics, and citation-grounded correctness evaluation to distinguish it from compact faithful-context-QA specialization.

### AgenticRAG: Agentic Retrieval for Enterprise Knowledge Bases

Source: [arXiv 2026](https://arxiv.org/html/2605.05538v1)

Relevance: Explicitly targets enterprise knowledge bases with agentic retrieval, citations, and deployment concerns.

Novelty pressure: High for the private/enterprise KB motivation. Our paper should not claim enterprise agentic RAG system design unless it adds a real versioned private/enterprise corpus; current claims stay on amortized post-training/scaffold behavior under update snapshots.

### Knowledge Distillation Must Account for What It Loses

Source: [arXiv 2026](https://arxiv.org/html/2604.25110v2)

Relevance: Argues that distillation evaluation must account for capability loss, not just headline task transfer.

Novelty pressure: High for evaluation framing. Our paper should explicitly report what the student/scaffold preserves and loses: answer support, citation support, abstention boundaries, update robustness, coverage, and cost.

## Current Novelty Hypothesis

The potentially defensible contribution is:

> A data-construction and evaluation framework for amortizing expensive grounded research agents over evolving private KBs, where generated post-training examples explicitly supervise answer synthesis, citation placement, abstention, claim tables, and update robustness.

This remains unproven. Before a paper-complete claim, we need a full literature review through June 2026 and experiments showing that our update-aware data construction beats generic RAG distillation or passage-selection baselines.

After the 2026-06-27 refresh, the stronger boundary is: do not claim compact agentic RAG transfer, deep-research data synthesis, compact faithful-context-QA specialization, or enterprise agentic RAG. The paper can only be novel if it demonstrates amortized grounded QA over evolving KB states with citation-support, abstention-support, coverage, and cost accounting.
