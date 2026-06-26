# Benchmarks for Hard Grounded Research: Paper Draft

Status: working paper scaffold generated from repository artifacts, not a submission-ready manuscript.

## Abstract Draft

Grounded research QA is often evaluated as retrieval plus answer correctness, but research failures frequently arise after the relevant text has already been retrieved. We introduce a benchmark scaffold for hard grounded research that tests 10 failure categories across 5 Hugging Face datasets and 30 pilot items. The benchmark targets multi-hop synthesis, stale-vs-current document conflicts, appended document lifecycle changes, table-plus-text reasoning, source authority conflicts, evidence insufficiency, citation overreach, entity disambiguation, as-of-date questions, and cross-document contradiction. Early non-oracle baselines show that lexical evidence selection is insufficient: failures cluster by challenge type and include missing evidence, unsupported conclusions, abstention errors, and citation faithfulness gaps. Gold release is intentionally gated on double review, disagreement resolution, and item-quality checks.

## Central Claim

The benchmark should not be framed as another RAG or long-context leaderboard. The paper claim is narrower: grounded research is hard because systems must reason about document state, source authority, temporal validity, evidence sufficiency, and whether citations support conclusions rather than merely nearby facts.

## Contributions

1. A taxonomy of 10 hard grounded research failure modes beyond simple lookup.
2. A Hugging Face-grounded pilot suite spanning 5 public datasets and 8 challenge types.
3. A scoring contract with answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality.
4. A review workflow with double review, disagreement queues, reviewer agreement metrics, quality hints, and strict gold promotion gates.
5. A baseline analysis that reports macro, category, and challenge-type failures for oracle sanity, lexical, and citation-aware verifier systems.

## Dataset Grounding

| Dataset | License | Benchmark roles |
| --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | multi-hop synthesis<br>citation supports fact but not conclusion<br>entity disambiguation<br>cross-document contradiction |
| allenai/qasper | cc-by-4.0 | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>appended document lifecycle changes |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| tdiggelm/climate_fever | unknown | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| Pavithree/eli5 | unknown | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion |

## Task Taxonomy

| Category | HF datasets | Seed tasks |
| --- | --- | --- |
| multi-hop synthesis | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | hgr_multi_hop_001 |
| stale-vs-current document conflicts | tdiggelm/climate_fever | hgr_stale_current_001 |
| appended document lifecycle changes | allenai/qasper | hgr_appendix_lifecycle_001 |
| table + text reasoning | danwakeem/wikitablequestions-wtq | hgr_table_text_001 |
| source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | hgr_authority_conflict_001 |
| evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | hgr_abstain_001 |
| citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>Pavithree/eli5 | hgr_citation_overreach_001 |
| entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | hgr_entity_disambiguation_001 |
| temporal questions: as of date X | tdiggelm/climate_fever | hgr_as_of_date_001 |
| cross-document contradiction | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | hgr_contradiction_001 |

## Construction Approaches

| Approach | Coverage | Covered categories |
| --- | --- | --- |
| Reuse existing QA and evidence labels | 10/10 | multi-hop synthesis<br>stale-vs-current document conflicts<br>appended document lifecycle changes<br>table + text reasoning<br>source authority conflicts<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>entity disambiguation<br>temporal questions: as of date X<br>cross-document contradiction |
| Compose multi-source suites | 8/10 | stale-vs-current document conflicts<br>table + text reasoning<br>source authority conflicts<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>entity disambiguation<br>temporal questions: as of date X<br>cross-document contradiction |
| Adversarially transform existing rows | 7/10 | stale-vs-current document conflicts<br>appended document lifecycle changes<br>source authority conflicts<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>temporal questions: as of date X<br>cross-document contradiction |

## Evaluation Contract

Systems submit one answer per task with citation ids and abstention state. The scorer reports:

- `answer_correct`: whether the answer matches the expected label or gold final answer.
- `evidence_recall`: required citation coverage.
- `citation_precision`: fraction of submitted citations that are required.
- `citation_faithfulness`: citation precision clipped when the answer is wrong.
- `conclusion_support`: explicit penalty for citation-overreach probes where evidence supports a fact but not the conclusion.
- `abstention_quality`: correct abstention on insufficient or conflicting evidence and non-abstention when an answer is warranted.

## Pilot Baselines

| System | Tasks | Answer | Evidence Recall | Citation Faithfulness | Conclusion Support | Abstention |
| --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | 30 | 1.0000 | 1.0000 | 1.0000 | 0.9000 | 1.0000 |
| lexical-evidence-baseline-v1 | 30 | 0.2000 | 0.6979 | 0.6000 | 0.5333 | 0.7000 |
| citation-aware-verifier-v1 | 30 | 0.1667 | 0.4979 | 0.5833 | 0.6333 | 0.6000 |

## Challenge-Type Results

| System | Challenge | Tasks | Answer | Evidence Recall | Citation Faithfulness | Conclusion Support |
| --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | as_of_date_constraint | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | authority_conflict | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | citation_overreach_probe | 3 | 1.0000 | 1.0000 | 1.0000 | 0.0000 |
| local-rule-agent-v1 | cross_document_contradiction | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | document_lifecycle_appendix | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | insufficiency_probe | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | native_row | 9 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | stale_current_conflict | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| lexical-evidence-baseline-v1 | as_of_date_constraint | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 |
| lexical-evidence-baseline-v1 | authority_conflict | 3 | 0.3333 | 1.0000 | 0.6667 | 0.6667 |
| lexical-evidence-baseline-v1 | citation_overreach_probe | 3 | 0.3333 | 0.3952 | 0.6667 | 0.0000 |
| lexical-evidence-baseline-v1 | cross_document_contradiction | 3 | 0.0000 | 0.3952 | 0.5000 | 0.5000 |
| lexical-evidence-baseline-v1 | document_lifecycle_appendix | 3 | 0.0000 | 1.0000 | 0.5000 | 0.5000 |
| lexical-evidence-baseline-v1 | insufficiency_probe | 3 | 0.0000 | 1.0000 | 0.5000 | 0.5000 |
| lexical-evidence-baseline-v1 | native_row | 9 | 0.2222 | 0.7296 | 0.6111 | 0.6111 |
| lexical-evidence-baseline-v1 | stale_current_conflict | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 |
| citation-aware-verifier-v1 | as_of_date_constraint | 3 | 0.3333 | 0.2500 | 0.6667 | 0.6667 |
| citation-aware-verifier-v1 | authority_conflict | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 |
| citation-aware-verifier-v1 | citation_overreach_probe | 3 | 0.0000 | 0.3952 | 0.5000 | 1.0000 |
| citation-aware-verifier-v1 | cross_document_contradiction | 3 | 0.0000 | 0.3952 | 0.5000 | 0.5000 |
| citation-aware-verifier-v1 | document_lifecycle_appendix | 3 | 0.0000 | 0.5000 | 0.5000 | 0.5000 |
| citation-aware-verifier-v1 | insufficiency_probe | 3 | 0.0000 | 0.5000 | 0.5000 | 0.5000 |
| citation-aware-verifier-v1 | native_row | 9 | 0.2222 | 0.7296 | 0.6111 | 0.6111 |
| citation-aware-verifier-v1 | stale_current_conflict | 3 | 0.3333 | 0.2500 | 0.6667 | 0.6667 |

## Baseline Uncertainty

| System | Metric | Mean | 95% CI |
| --- | --- | --- | --- |
| local-rule-agent-v1 | answer_correct | 1.0000 | [1.0000, 1.0000] |
| local-rule-agent-v1 | citation_faithfulness | 1.0000 | [1.0000, 1.0000] |
| local-rule-agent-v1 | conclusion_support | 0.9000 | [0.7908, 1.0000] |
| local-rule-agent-v1 | abstention_quality | 1.0000 | [1.0000, 1.0000] |
| lexical-evidence-baseline-v1 | answer_correct | 0.2000 | [0.0544, 0.3456] |
| lexical-evidence-baseline-v1 | citation_faithfulness | 0.6000 | [0.5272, 0.6728] |
| lexical-evidence-baseline-v1 | conclusion_support | 0.5333 | [0.4401, 0.6265] |
| lexical-evidence-baseline-v1 | abstention_quality | 0.7000 | [0.5332, 0.8668] |
| citation-aware-verifier-v1 | answer_correct | 0.1667 | [0.0310, 0.3023] |
| citation-aware-verifier-v1 | citation_faithfulness | 0.5833 | [0.5155, 0.6512] |
| citation-aware-verifier-v1 | conclusion_support | 0.6333 | [0.5529, 0.7138] |
| citation-aware-verifier-v1 | abstention_quality | 0.6000 | [0.4217, 0.7783] |

These intervals are descriptive task-level estimates over the current 30-item pilot, not final submission power estimates.

## Gold Data Gate

- Gold ready: false
- Valid reviewed items: 0/30
- Missing-review items: 30
- Disagreement items: 0
- Exact agreement rate: n/a
- Label agreement rate: n/a
- Repair-before-gold items: 0
- License review status: blocked
- License blockers: 2
- Pointer-only package items: 15
- Release gate status: blocked
- Release blockers: 7

## Novelty Position

The novelty audit currently rejects broad claims such as "a RAG benchmark with citations" or "a contradiction benchmark." The defensible novelty position is the combined failure-mode bundle: document lifecycle, source authority, temporal validity, table/text interpretation, citation-overreach, insufficiency, disambiguation, and contradiction inside one executable grounded research QA harness.

| Claim | Status | Reason |
| --- | --- | --- |
| Generic RAG benchmark | not_novel | Adjacent RAG and long-context benchmarks are abundant. |
| Temporal QA benchmark | not_novel_alone | ChronoQA already targets temporal-sensitive RAG. |
| Citation faithfulness benchmark | not_novel_alone | LongCite and related citation benchmarks cover attribution quality. |
| Unified hard-grounded research failure taxonomy | plausibly_differentiated_pending_final_audit | The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data. |

## Required Before Submission

1. Scale from 30 pilot items to at least 30-50 double-reviewed items per category.
2. Complete independent double review and adjudicate disagreements until gold promotion succeeds.
3. Run at least two frontier or open model baselines over the same scoring source.
4. Refresh the June 2026 novelty audit with paper citations immediately before any completion claim.
5. Convert this scaffold into a full manuscript with related work, annotation protocol, limitations, and statistical uncertainty.
