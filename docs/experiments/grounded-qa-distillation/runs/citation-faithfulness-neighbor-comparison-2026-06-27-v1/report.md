# Citation Faithfulness Neighbor Comparison

Generated: 2026-06-27T02:08:26.624Z

## Close Neighbors

- [Faithful in Steps: Improving Generalization and Citation in RAG via Query Decomposition](https://ojs.aaai.org/index.php/AAAI/article/view/40879) (high)
- [What Should I Cite? A RAG Benchmark for Academic Citation Prediction](https://arxiv.org/abs/2601.14949) (medium_high)
- [Faithfulness-Aware Multi-Objective Context Ranking for Retrieval-Augmented Generation](https://dl.acm.org/doi/10.1145/3797161.3797180) (high)
- [Generate but Verify: Answering with Faithfulness in RAG-based Question Answering](https://aclanthology.org/2025.ijcnlp-long.56/) (high)

## Framing

- Overlap: The new close neighbors pressure citation RAG through query decomposition/reranking, academic citation prediction, faithfulness-aware context ranking, and generate-then-verify pipelines.
- Distinction: The project survives only as update-heldout model/scaffold-side amortization with answer support, citation support, abstention support, coverage, temporal/update validity, and cost measured together.

## Dimensions

### retrieval_side_decomposition

Do query decomposition or reranking methods solve the same problem?

- qdrag_neighbor: QDRAG-style decomposition can improve citation RAG attribution, but it is an online retrieval/ranking strategy rather than amortized post-training into a deployed answerer/scaffold.
- current_project: Current compact evidence packs are fixed before answer generation; the project has not yet compared against query decomposition over the same evolving KB windows.

### academic_citation_prediction

Are scientific citation-prediction benchmarks the same as answer-support citations?

- citerag_neighbor: CiteRAG predicts scholarly references for academic writing; this project uses evidence ids as support citations for answer claims inside a compact evidence pack.
- current_project: Manuscript wording must distinguish source-support evidence citations from bibliography/reference recommendation.

### faithfulness_ranking

Could support gains come from ranking/filtering rather than a trained student?

- direct_mini_repair: 64.1%; Direct baseline answers many rows but support is incomplete.
- claim_entailment_guard: 74.1%; Current support-first guard improves support through filtering/ranking-like suppression but loses coverage.
- faithfulness_aware_context_ranking_neighbor: Faithfulness-aware context ranking is a plausible retrieval-side baseline if the paper claims support preservation from data construction.

### generate_then_verify

Does verification alone satisfy the final target?

- generate_but_verify_neighbor: Generate-then-verify overlaps with the project's teacher repair and guard stages.
- candidate_pool_oracle: Even oracle selection over existing verified candidates answers only 46/69 (66.7%), below the 70% answer-rate target.
- repair_signal: The Qwen packet has 41 train repair contrasts for 34 oracle-gap examples, so the next test is generation/repair, not only verification.

### citation_syntax_vs_support

Can citation metrics be satisfied by formatting alone?

- longcite_comparison: longcite-style-citation-sft-comparison-2026-06-26-v1 and local citation-repair controls show citation syntax is not support evidence.
- citation_grounding_memory_comparison: citation-grounding-memory-comparison-2026-06-27-v1 requires citation existence, support/relevance, and temporal/update validity to be reported separately.

### final_claim_boundary

What claim survives these neighbors?

- qwen_target: The surviving claim requires the missing joint-action-qwen3b-smoke-eval-v1 predictions and paid judge result: >=70% answer rate with answer support above direct baseline, citation support/recall, abstention support, and amortized cost reported together.
- allowed_framing: Data construction and evaluation for amortized grounded QA over evolving KB states, not first citation RAG, first verifier, first reranker, or first academic citation benchmark.

## Claim Boundary

- Do not claim first query-decomposition, reranking, or faithfulness-aware context-selection method for citation RAG.
- Do not claim academic citation prediction as the task; answer-support evidence citations are different.
- Do not present generate-then-verify as the deployed contribution unless the verification cost is included.
- The Qwen 3B result must demonstrate generation/repair beyond selection-only verification because the current candidate-pool oracle is coverage-limited.

## Required After Qwen Smoke

- Report whether trained Qwen improves support at >=70% answer rate compared with direct repair, guard/ranking-like filters, and the candidate-pool oracle boundary.
- If reviewers press on QDRAG/ranking, run or scope a retrieval-side decomposition/ranking baseline on the same final window.
- If reviewers press on Generate-but-Verify, report online verification cost separately from amortized student/scaffold cost.

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
