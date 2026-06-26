# Hard Grounded Research Novelty Evidence

This generated registry records related-work evidence checked for the benchmark novelty argument. It is not a final completion audit and does not allow a novelty claim by itself.

## Summary

- Date checked: 2026-06-26
- Sources: 12
- Evidence status: preliminary_registry_not_final_completion_audit
- Completion claim allowed: false

## Source Registry

| ID | Source | Year | Overlap | Paper-use note |
| --- | --- | --- | --- | --- |
| occ-rag-2026 | [OCC-RAG: Optimal Cognitive Core for Faithful Question Answering](https://arxiv.org/html/2606.00683v1) | 2026 | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation faithfulness | Cite as close work on faithful QA and multi-hop grounded answer generation; do not claim multi-hop or abstention alone as novel. |
| chronoqa-2025 | [ChronoQA: A Question Answering Dataset for Temporal-Sensitive Retrieval-Augmented Generation](https://www.nature.com/articles/s41597-025-06098-y) | 2025 | temporal questions: as of date X<br>stale-vs-current document conflicts | Cite as close temporal RAG work; position hard-grounded temporal tasks around document snapshot validity and source-state conflict, not generic temporal QA. |
| bridge-2026 | [BRIDGE: Benchmark for multi-hop Reasoning In long multimodal Documents with Grounded Evidence](https://arxiv.org/html/2603.07931v1) | 2026 | multi-hop synthesis<br>table + text reasoning<br>grounded scientific evidence | Cite as close work on long-document grounded evidence; separate our claim by source authority, lifecycle, stale/current, and conclusion-overreach categories. |
| lit-ragbench-2026 | [LIT-RAGBench: Benchmarking Generator Capabilities of Large Language Models in Retrieval-Augmented Generation](https://arxiv.org/html/2603.06198v1) | 2026 | evidence insufficiency / abstention<br>cross-document contradiction | Cite as close RAG generator benchmark; avoid claiming contradiction or insufficiency alone as novel. |
| t2-ragbench-2026 | [T2-RAGBench: Text-and-Table Benchmark for Evaluating Retrieval-Augmented Generation](https://huggingface.co/datasets/G4KMU/t2-ragbench) | 2026 | table + text reasoning<br>financial document RAG<br>retrieval plus numerical reasoning | Cite as close text-and-table RAG work; frame our table tasks as one category inside a broader hard-grounded research failure taxonomy. |
| citation-closure-2026 | [Citation-Closure Retrieval and Per-Rule Attribution for Real-World Compliance RAG](https://arxiv.org/html/2605.29742v1) | 2026 | source authority conflicts<br>citation closure<br>authority traceability | Cite as close authority/citation-closure work; distinguish our contribution by evaluating authority conflicts alongside lifecycle, temporal, insufficiency, contradiction, and citation-overreach categories. |
| legal-claim-rag-2026 | [Fine-grained Claim-level RAG Benchmark for Law](https://arxiv.org/html/2605.21071v1) | 2026 | claim-level RAG<br>contradicted claims<br>legal evidence grounding | Cite as close contradiction and claim-level RAG work; avoid claiming contradiction detection alone as novel. |
| enterprise-rag-bench-2026 | [EnterpriseRAG-Bench](https://huggingface.co/datasets/onyx-dot-app/EnterpriseRAG-Bench) | 2026 | large-corpus enterprise RAG<br>realistic document QA | Cite as close large-corpus RAG work; position our benchmark around controlled failure categories rather than corpus realism alone. |
| corpusqa-2026 | [CorpusQA: A 10 Million Token Benchmark for Corpus-Level Question Answering](https://arxiv.org/html/2601.14952v1) | 2026 | corpus-level QA<br>global information synthesis<br>RAG collapse under scale | Cite as close corpus-level QA work; keep our novelty claim centered on hard-grounded evidence semantics, not corpus length alone. |
| longbench-pro-2026 | [LongBench Pro: A More Realistic and Comprehensive Bilingual Long-Context Evaluation Benchmark](https://huggingface.co/datasets/caskcsg/LongBench-Pro) | 2026 | long-context evaluation<br>realistic reasoning tasks | Cite as close long-context evaluation work; use it to avoid overclaiming novelty from long inputs or hard examples alone. |
| longcite-2024 | [LongCite and LongBench-Cite](https://github.com/THUDM/LongCite) | 2024 | citation supports fact but not conclusion<br>citation faithfulness<br>long-context QA | Cite as close citation benchmark; define our differentiator as conclusion support rather than citation presence or localized attribution alone. |
| 100-longbench-2025 | [100-LongBench: Are de facto Long-Context Benchmarks Literally Evaluating Long-Context Ability?](https://aclanthology.org/2025.findings-acl.903/) | 2025 | long-context evaluation validity | Cite for benchmark-design caution; use to justify controlled hard-grounded failure modes rather than context length as the central axis. |

## Claim Guidance

| Claim | Status | Reason |
| --- | --- | --- |
| Generic RAG benchmark | not_novel | Adjacent RAG and long-context benchmarks are abundant. |
| Temporal QA benchmark | not_novel_alone | ChronoQA already targets temporal-sensitive RAG. |
| Citation faithfulness benchmark | not_novel_alone | LongCite and related citation benchmarks cover attribution quality. |
| Unified hard-grounded research failure taxonomy | plausibly_differentiated_pending_final_audit | The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data. |

## Category Evidence Map

| Category | Novelty risk | Closest source ids |
| --- | --- | --- |
| multi-hop synthesis | high | occ-rag-2026<br>bridge-2026 |
| stale-vs-current document conflicts | medium | chronoqa-2025 |
| appended document lifecycle changes | low | bridge-2026 |
| table + text reasoning | high | bridge-2026<br>t2-ragbench-2026 |
| source authority conflicts | medium | citation-closure-2026<br>legal-claim-rag-2026<br>lit-ragbench-2026 |
| evidence insufficiency / abstention | high | occ-rag-2026<br>lit-ragbench-2026 |
| citation supports fact but not conclusion | medium | longcite-2024 |
| entity disambiguation | medium | occ-rag-2026 |
| temporal questions: as of date X | high | chronoqa-2025 |
| cross-document contradiction | high | lit-ragbench-2026<br>legal-claim-rag-2026 |
