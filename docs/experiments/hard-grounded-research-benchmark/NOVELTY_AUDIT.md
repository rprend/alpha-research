# Novelty Audit

Status: preliminary literature and internet scan, not a completion claim.

Date checked: 2026-06-26

## Question

Is the hard grounded research benchmark genuinely novel relative to current RAG, grounded QA, citation faithfulness, temporal conflict, and long-context benchmarks?

## Current Position

Plausibly differentiated only as a unified hard-grounded research QA failure taxonomy; not novel as generic RAG, citation, temporal, contradiction, or multi-hop QA.

Completion claim allowed: false

## Adjacent Work Found

| Representative source | Year | What it already covers | Gap / implication for this benchmark |
| --- | --- | --- | --- |
| [OCC-RAG: Optimal Cognitive Core for Faithful Question Answering](https://arxiv.org/html/2606.00683v1) | 2026 | multi-hop synthesis<br>evidence insufficiency / abstention<br>source-grounded citation traces | Optimizes context QA models and synthetic training data for multi-hop, faithfulness, and abstention, but does not organize evaluation around research-document lifecycle, authority, stale/current, citation-overreach, and temporal snapshot failure modes in one benchmark. |
| [ChronoQA: A Question Answering Dataset for Temporal-Sensitive Retrieval-Augmented Generation](https://www.nature.com/articles/s41597-025-06098-y) | 2025 | temporal questions: as of date X<br>multi-document temporal reasoning | Strong temporal RAG coverage, including multi-document temporal questions, but not a broad grounded-research taxonomy covering authority conflicts, appended document lifecycle, conclusion-support overreach, and abstention together. |
| [BRIDGE: Benchmark for multi-hop Reasoning In long multimodal Documents with Grounded Evidence](https://arxiv.org/html/2603.07931v1) | 2026 | multi-hop synthesis<br>table + text reasoning<br>grounded evidence in scientific papers | Covers long scientific documents and text/table/figure evidence, but focuses on multimodal multi-hop reasoning rather than stale/current conflicts, source authority, insufficiency, citation-overreach, entity ambiguity, and cross-document contradiction as a unified failure taxonomy. |
| [LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation](https://arxiv.org/html/2603.06198v1) | 2026 | evidence insufficiency / abstention<br>cross-document contradiction<br>incomplete chunks | Directly adjacent for insufficiency and contradiction, but smaller and aspect-based; it does not test document lifecycle, source authority hierarchy, as-of snapshot semantics, entity disambiguation, and citation support versus conclusion support in one large-corpus research QA suite. |
| [LongCite / LongBench-Cite](https://github.com/THUDM/LongCite) | 2024 | fine-grained citations<br>long-context QA citation quality | Evaluates citation generation and correctness in long-context QA, but citation quality alone does not distinguish cases where a cited sentence supports a fact while failing to support the research conclusion. |
| [100-LongBench: Are de facto Long-Context Benchmarks Literally Evaluating Long-Context Ability?](https://aclanthology.org/2025.findings-acl.903/) | 2025 | long-context evaluation<br>length-controllable tasks | Targets long-context measurement validity, not grounded research QA failure categories or evidence-use semantics. |

## Category-Level Novelty Risk

| Category | Novelty risk | Closest sources | Differentiator required |
| --- | --- | --- | --- |
| multi-hop synthesis | high | occ-rag-2026<br>bridge-2026 | Must be framed as one slice inside a broader hard-grounded research taxonomy, not as a standalone multi-hop benchmark. |
| stale-vs-current document conflicts | medium | chronoqa-2025<br>occ-rag-2026 | Focus on conflicting document snapshots and explicit stale-evidence rejection rather than generic temporal reasoning or counterfactual context faithfulness. |
| appended document lifecycle changes | low | bridge-2026 | Document-state changes from appendices, errata, or later sections remain underrepresented in adjacent RAG benchmarks. |
| table + text reasoning | high | bridge-2026<br>occ-rag-2026 | Needs to stress cross-format evidence use inside research QA rather than claim novelty over text/table reasoning itself. |
| source authority conflicts | medium | lit-ragbench-2026 | Authority hierarchy is distinct from arbitrary contradiction when the benchmark encodes which source controls the conclusion. |
| evidence insufficiency / abstention | high | occ-rag-2026<br>lit-ragbench-2026 | Abstention is not novel alone; contribution depends on pairing it with citation-overreach, authority, lifecycle, and temporal constraints. |
| citation supports fact but not conclusion | medium | longcite-2024<br>lit-ragbench-2026 | The key distinction is conclusion support, not whether the cited text is real or relevant to a subfact. |
| entity disambiguation | medium | occ-rag-2026 | Needs adversarial same-name or near-name entities where citations must identify the right referent. |
| temporal questions: as of date X | high | chronoqa-2025 | Should be scoped to document snapshot validity and citation dates, not broad temporal QA. |
| cross-document contradiction | high | lit-ragbench-2026 | Contradiction is crowded; benchmark value comes from combining contradiction with source authority and research conclusions. |

## Required Work Before Paper-Worthy

1. Convert seed examples into a larger sampled/adversarial suite with at least 30-50 reviewed items per category.
2. Add explicit rubrics for conclusion-support, source authority, document lifecycle, and as-of-date validity.
3. Add at least three non-oracle baselines: lexical retrieval plus answer extraction, native-context LLM answerer, and citation-aware verifier.
4. Run at least two frontier or open models and report category-level failure profiles.
5. Complete human review/adjudication fields for synthetic lifecycle, authority, and stale/current perturbations.
6. Re-run this novelty audit before any completion claim and update it with newly found June 2026 papers.

## Decision

Do not claim novelty yet. Treat novelty as a release gate that requires evidence from the broader benchmark literature and a category-by-category comparison table in the paper draft.
