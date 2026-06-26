# Hard Grounded Research Novelty Evidence

This generated registry records related-work evidence checked for the benchmark novelty argument. It is not a final completion audit and does not allow a novelty claim by itself.

## Summary

- Date checked: 2026-06-26
- Sources: 22
- Evidence status: preliminary_registry_not_final_completion_audit
- Completion claim allowed: false
- Allowed claims: 1
- Prohibited or unsupported claims: 5

## June 2026 Search Provenance

| Query | Purpose |
| --- | --- |
| 2025 2026 benchmark grounded research QA large corpus multi-hop citation faithfulness temporal conflicts RAG benchmark | Find broad large-corpus and grounded-research QA benchmarks that could subsume the proposed contribution. |
| 2025 2026 citation supports fact but not conclusion benchmark grounded QA RAG faithfulness | Stress-test the citation-overreach category against citation faithfulness and context-faithfulness benchmarks. |
| 2026 temporal question answering stale current document conflict benchmark RAG | Stress-test as-of-date and stale/current document conflict tasks against temporal RAG and knowledge-drift work. |
| TEMPRAGEVAL temporal RAG benchmark 2025 arxiv | Check for temporal RAG benchmarks specifically named around time-sensitive retrieval and generation. |
| MultiHop-RAG benchmark 2024 multi-hop retrieval augmented generation | Check whether multi-hop synthesis is already covered by dedicated RAG benchmarks. |
| MAGIC benchmark multi-hop question answering RAG 2025 | Check newer multi-hop and inference-heavy QA benchmarks that may overlap with the proposed taxonomy. |

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
| step-context-faithfulness-2026 | [A Benchmark for Evaluating Step-by-Step Context Faithfulness in Retrieval-Augmented Language Models](https://arxiv.org/html/2601.09414v2) | 2026 | citation supports fact but not conclusion<br>evidence insufficiency / abstention<br>intermediate-step faithfulness | Cite as close work on faithfulness of reasoning steps to retrieved context; distinguish our conclusion-overreach category by requiring citations that support a fact but not the final research conclusion. |
| ragbench-leaderboard-2025 | [Evaluation of RAG Metrics for Question Answering in the Telecom Domain](https://arxiv.org/html/2503.06887v2) | 2025 | RAG faithfulness metrics<br>answer relevance<br>domain QA | Cite as evidence that RAG faithfulness and answer-quality metrics are already benchmarked; position our contribution as task construction for hard grounded research failures rather than another metric leaderboard. |
| tdbench-2025 | [TDBench: A Benchmark for Temporal Database Question Answering](https://openreview.net/forum?id=qJmLk5mSZz) | 2025 | temporal questions: as of date X<br>temporal database QA<br>time-aware retrieval | Cite as close temporal QA work; distinguish hard-grounded as-of-date tasks by evidence snapshot validity, stale/current document conflict, and citation-grounded abstention rather than database temporal querying alone. |
| knowledge-drift-2025 | [Has Your Knowledge Been Updated or Still Outdated? Understanding and Detecting Knowledge Drift in Large Language Models](https://arxiv.org/html/2504.08700v1) | 2025 | stale-vs-current document conflicts<br>knowledge drift<br>temporal validity | Cite as close knowledge-drift work; keep the benchmark claim focused on document-grounded conflict resolution where both stale and current evidence are visible. |
| decaf-2025 | [Claim-Aware RAG: Truthful & Reliable Long-Form Generation with Dynamic Evidence Trees](https://arxiv.org/html/2502.20129v1) | 2025 | claim-level RAG<br>citation faithfulness<br>long-form grounded generation | Cite as close claim-aware RAG work; distinguish this benchmark by evaluating failure categories across research QA items rather than proposing a generation architecture. |
| entitymatch-2025 | [EntityMatch: Evaluating Entity Ambiguity in Visual Language Models](https://openreview.net/forum?id=8mF1lKKDEi) | 2025 | entity disambiguation<br>ambiguous named entities | Cite as evidence that entity ambiguity is an active benchmark dimension; frame our entity-disambiguation tasks around textual corpus-grounded research QA and citation requirements. |
| temprageval-2025 | [TEMPRAGEVAL: Temporal RAG Evaluation](https://arxiv.org/abs/2507.02457) | 2025 | temporal questions: as of date X<br>temporal RAG<br>time-sensitive retrieval | Cite as close temporal RAG evaluation; avoid claiming temporal robustness as novel and distinguish by visible stale/current source conflicts and as-of-date citation semantics. |
| multihop-rag-2024 | [MultiHop-RAG: Benchmarking Retrieval-Augmented Generation for Multi-Hop Queries](https://arxiv.org/abs/2401.15391) | 2024 | multi-hop synthesis<br>RAG retrieval over multiple documents | Cite as close multi-hop RAG work; do not claim multi-hop RAG as novel except as one category inside the hard-grounded research taxonomy. |
| magic-2025 | [MAGIC: A Multi-Hop and Generation-Intensive Chinese Benchmark for LLM Evaluation](https://arxiv.org/abs/2506.05732) | 2025 | multi-hop synthesis<br>generation-intensive QA | Cite as another multi-hop/generation benchmark; keep the claim boundary on grounded evidence semantics rather than generation difficulty alone. |
| faitheval-2024 | [FaithEval: Can Your Language Model Stay Faithful to Context, Even If "The Moon is Made of Marshmallows"?](https://arxiv.org/abs/2410.03727) | 2024 | context faithfulness<br>evidence insufficiency / abstention<br>stale-vs-current document conflicts | Cite as close context-faithfulness work; distinguish the benchmark by research QA categories where the cited evidence may support local facts but not final conclusions. |

## Claim Guidance

| Claim | Status | Reason |
| --- | --- | --- |
| Generic RAG benchmark | not_novel | Adjacent RAG and long-context benchmarks are abundant. |
| Temporal QA benchmark | not_novel_alone | ChronoQA already targets temporal-sensitive RAG. |
| Citation faithfulness benchmark | not_novel_alone | LongCite and related citation benchmarks cover attribution quality. |
| Unified hard-grounded research failure taxonomy | plausibly_differentiated_pending_final_audit | The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data. |
| A paper-ready benchmark with reliable labels | not_yet_supported | Human review, adjudication, category scale, and final novelty checks are still release blockers. |

## Paper Claim Boundaries

| Paper claim | Status | Reason | Relevant source ids |
| --- | --- | --- | --- |
| We introduce a generic RAG benchmark. | prohibited / not yet supported | Too broad and already covered by many RAG, long-context, and domain QA benchmarks. | lit-ragbench-2026<br>enterprise-rag-bench-2026<br>corpusqa-2026 |
| We introduce a multi-hop RAG benchmark. | prohibited / not yet supported | Multi-hop RAG is already directly benchmarked; this can only be a component category. | multihop-rag-2024<br>bridge-2026<br>occ-rag-2026<br>magic-2025 |
| We introduce a temporal RAG benchmark. | prohibited / not yet supported | Temporal RAG and temporal QA already have dedicated benchmarks. | chronoqa-2025<br>tdbench-2025<br>temprageval-2025<br>knowledge-drift-2025 |
| We introduce citation faithfulness evaluation. | prohibited / not yet supported | Citation and context faithfulness are already benchmarked; our narrower claim must be conclusion-support overreach. | longcite-2024<br>step-context-faithfulness-2026<br>faitheval-2024 |
| We benchmark a unified taxonomy of hard grounded research QA failures beyond fact lookup. | allowed with evidence | This is the defensible claim if the paper shows reviewed items spanning lifecycle, authority, stale/current, conclusion-overreach, insufficiency, entity ambiguity, table/text, multi-hop, temporal, and contradiction categories. | citation-closure-2026<br>chronoqa-2025<br>longcite-2024<br>lit-ragbench-2026<br>corpusqa-2026 |
| The benchmark is paper-ready and genuinely novel as of June 2026. | prohibited / not yet supported | This requires completed human review, category scale, and a final refreshed novelty audit. | n/a |

## Category Evidence Map

| Category | Novelty risk | Closest source ids |
| --- | --- | --- |
| multi-hop synthesis | high | multihop-rag-2024<br>occ-rag-2026<br>bridge-2026<br>magic-2025<br>decaf-2025 |
| stale-vs-current document conflicts | medium | chronoqa-2025<br>temprageval-2025<br>knowledge-drift-2025<br>faitheval-2024 |
| appended document lifecycle changes | low | bridge-2026 |
| table + text reasoning | high | bridge-2026<br>t2-ragbench-2026 |
| source authority conflicts | medium | citation-closure-2026<br>legal-claim-rag-2026<br>lit-ragbench-2026<br>decaf-2025 |
| evidence insufficiency / abstention | high | occ-rag-2026<br>lit-ragbench-2026<br>step-context-faithfulness-2026<br>faitheval-2024 |
| citation supports fact but not conclusion | medium | longcite-2024<br>step-context-faithfulness-2026<br>ragbench-leaderboard-2025<br>faitheval-2024 |
| entity disambiguation | medium | occ-rag-2026<br>entitymatch-2025 |
| temporal questions: as of date X | high | chronoqa-2025<br>tdbench-2025<br>temprageval-2025<br>knowledge-drift-2025 |
| cross-document contradiction | high | lit-ragbench-2026<br>legal-claim-rag-2026 |

## Adversarial Novelty Comparison

| Dimension | Closest source ids | Position to defend |
| --- | --- | --- |
| Context length or corpus realism | corpusqa-2026<br>longbench-pro-2026<br>enterprise-rag-bench-2026 | Not novel alone; use these sources to avoid overclaiming scale and to motivate controlled failure categories inside large-corpus research QA. |
| Temporal validity | chronoqa-2025<br>tdbench-2025<br>temprageval-2025<br>knowledge-drift-2025 | Not novel alone; hard-grounded research should focus on as-of-date citation semantics, stale/current document conflict, and visible evidence-state changes. |
| Citation faithfulness | longcite-2024<br>step-context-faithfulness-2026<br>ragbench-leaderboard-2025<br>faitheval-2024 | Not novel alone; the benchmark must test whether citations support the final conclusion, not merely whether cited spans are relevant to local facts. |
| Source authority and claim-level evidence | citation-closure-2026<br>legal-claim-rag-2026<br>decaf-2025 | Partly covered elsewhere; the defensible angle is combining authority conflicts with lifecycle, temporal, insufficiency, and contradiction tasks under one annotation protocol. |
| Entity ambiguity | entitymatch-2025<br>occ-rag-2026 | Not novel as a standalone phenomenon; include it because large-corpus research QA frequently fails by citing the right-looking source for the wrong entity. |
