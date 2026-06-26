# Novelty Audit

Status: preliminary literature and internet scan, not a completion claim.

Date checked: 2026-06-26

## Question

Is the hard grounded research benchmark genuinely novel relative to current RAG, grounded QA, citation faithfulness, temporal conflict, and long-context benchmarks?

## Adjacent Work Found

| Area | Representative source | What it already covers | Implication for this benchmark |
| --- | --- | --- | --- |
| RAG generation under insufficient and contradictory evidence | [LIT-RAGBench](https://arxiv.org/html/2603.06198v1) | Generator behavior when context is insufficient or contradictory. | Insufficiency and contradiction alone are not novel. Our benchmark must combine those with source authority, lifecycle, temporal, and citation-overreach slices. |
| Citation faithfulness | [Correctness is not Faithfulness in Retrieval Augmented Generation](https://dl.acm.org/doi/10.1145/3731120.3744592) | Distinguishes correct answers from faithful citations; reports widespread post-rationalized citation failures. | The "citation supports fact but not conclusion" category is adjacent and needs a sharper sentence-level conclusion-support rubric. |
| Temporal knowledge conflicts | [Reproducibility Insights from Unifying DYNAMICQA and MULAN](https://arxiv.org/html/2603.15892v1) | Reproduces and compares temporal conflict/updateability benchmarks. | Stale-vs-current and as-of-date questions are not novel by themselves. They become stronger when tied to document provenance and research-answer citation constraints. |
| Human grounding annotations for RAG | [GaRAGe](https://aclanthology.org/2025.findings-acl.875.pdf) | Long-form RAG answers with passage-level grounding annotations over web/private document sets. | Grounding annotations are covered elsewhere. Our contribution should be failure-mode taxonomy and adversarial research tasks rather than generic grounded long-form QA. |
| RAG faithfulness leaderboards | [FaithJudge](https://aclanthology.org/2025.emnlp-industry.54/) | Benchmarks hallucination/faithfulness in RAG across summarization, QA, and data-to-text. | Faithfulness scoring alone is not enough. We need task families where the model can cite true evidence but still make the wrong research judgment. |
| Conflicting evidence in RAG | [Retrieval-Augmented Generation with Conflicting Evidence](https://openreview.net/forum?id=z1MHB2m3V9) | Benchmark and methods for ambiguity, conflicting evidence, and misinformation in retrieval scenarios. | Cross-document contradiction is already an active benchmark area. Our differentiator should be broader hard-research categories and source authority/lifecycle semantics. |
| Long-context vs RAG | [LaRA](https://openreview.net/forum?id=CLF25dahgA) and [Long²RAG overview](https://www.emergentmind.com/topics/long-2-rag-benchmark) | Compares long-context and RAG under large/noisy contexts. | Large-corpus scale is not enough. The publishable claim must be about which grounded research tasks are hard, not only context length. |
| Temporal reasoning benchmarks | [TRD](https://aclanthology.org/2026.iwsds-1.19/) and [TIME](https://huggingface.co/papers/2505.12891) | Programmatic and real-world temporal reasoning tasks. | Temporal reasoning is crowded. Our temporal slice should be "as of date X using only valid document snapshots" rather than generic date arithmetic or event ordering. |

## Preliminary Novelty Claim

The benchmark is not novel if framed as "a RAG benchmark with citations" or "a benchmark for contradiction/abstention." Those areas are already active.

The plausible novel claim is narrower:

> Existing benchmarks tend to isolate retrieval, answer faithfulness, contradiction, temporal reasoning, or long-context performance. This benchmark treats grounded research QA as a bundle of document-state and evidence-use failures: stale/current conflicts, appended-document lifecycle changes, table-plus-text interpretation, source-authority conflicts, abstention, citation-overreach, entity ambiguity, as-of-date constraints, and cross-document contradiction in one executable suite.

## Required Work Before Paper-Worthy

1. Convert seed examples into a larger sampled/adversarial suite with at least 30-50 reviewed items per category.
2. Add explicit rubrics for conclusion-support, source authority, document lifecycle, and as-of-date validity.
3. Add at least three non-oracle baselines: lexical retrieval plus answer extraction, native-context LLM answerer, and citation-aware verifier.
4. Run at least two frontier or open models and report category-level failure profiles.
5. Add human review/adjudication fields for synthetic lifecycle, authority, and stale/current perturbations.
6. Re-run this novelty audit before any completion claim and update it with newly found June 2026 papers.

## Decision

Do not claim novelty yet. Treat novelty as a release gate that requires evidence from the broader benchmark literature and a category-by-category comparison table in the paper draft.
