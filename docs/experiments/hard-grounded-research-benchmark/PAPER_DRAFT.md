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
4. A review workflow with double review, disagreement queues, reviewer agreement metrics, quality hints, annotation import/export checks, and strict gold promotion gates.
5. A baseline analysis that reports macro, category, and challenge-type failures for oracle sanity, lexical, citation-aware verifier, and external model systems.

## Dataset Grounding

The scaled public package currently contains 270 review-pending items, 15 distinct source rows, and 891 evidence units after license remediation and pointer-only packaging. This corpus audit is evidence for benchmark construction scope, not a substitute for human-reviewed gold labels.

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
| anthropic-grounded-baseline-v1 | 30 | 0.3667 | 0.2902 | 0.4000 | 0.3000 | 0.4333 |
| openai-grounded-baseline-v1 | 30 | 0.4000 | 0.4848 | 0.7000 | 0.6000 | 0.6000 |

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
| anthropic-grounded-baseline-v1 | as_of_date_constraint | 3 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| anthropic-grounded-baseline-v1 | authority_conflict | 3 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| anthropic-grounded-baseline-v1 | citation_overreach_probe | 3 | 1.0000 | 0.4905 | 1.0000 | 0.0000 |
| anthropic-grounded-baseline-v1 | cross_document_contradiction | 3 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| anthropic-grounded-baseline-v1 | document_lifecycle_appendix | 3 | 0.6667 | 1.0000 | 0.8333 | 0.8333 |
| anthropic-grounded-baseline-v1 | insufficiency_probe | 3 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| anthropic-grounded-baseline-v1 | native_row | 9 | 0.6667 | 0.4704 | 0.7222 | 0.7222 |
| anthropic-grounded-baseline-v1 | stale_current_conflict | 3 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| openai-grounded-baseline-v1 | as_of_date_constraint | 3 | 0.0000 | 0.2500 | 0.5000 | 0.5000 |
| openai-grounded-baseline-v1 | authority_conflict | 3 | 0.0000 | 0.5000 | 0.5000 | 0.5000 |
| openai-grounded-baseline-v1 | citation_overreach_probe | 3 | 1.0000 | 0.3952 | 1.0000 | 0.0000 |
| openai-grounded-baseline-v1 | cross_document_contradiction | 3 | 0.0000 | 0.2643 | 0.5000 | 0.5000 |
| openai-grounded-baseline-v1 | document_lifecycle_appendix | 3 | 0.6667 | 1.0000 | 0.8333 | 0.8333 |
| openai-grounded-baseline-v1 | insufficiency_probe | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 |
| openai-grounded-baseline-v1 | native_row | 9 | 0.6667 | 0.5630 | 0.8333 | 0.8333 |
| openai-grounded-baseline-v1 | stale_current_conflict | 3 | 0.0000 | 0.2500 | 0.5000 | 0.5000 |

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
| anthropic-grounded-baseline-v1 | answer_correct | 0.3667 | [0.1913, 0.5421] |
| anthropic-grounded-baseline-v1 | citation_faithfulness | 0.4000 | [0.2280, 0.5720] |
| anthropic-grounded-baseline-v1 | conclusion_support | 0.3000 | [0.1400, 0.4600] |
| anthropic-grounded-baseline-v1 | abstention_quality | 0.4333 | [0.2530, 0.6137] |
| openai-grounded-baseline-v1 | answer_correct | 0.4000 | [0.2217, 0.5783] |
| openai-grounded-baseline-v1 | citation_faithfulness | 0.7000 | [0.6108, 0.7892] |
| openai-grounded-baseline-v1 | conclusion_support | 0.6000 | [0.4908, 0.7092] |
| openai-grounded-baseline-v1 | abstention_quality | 0.6000 | [0.4217, 0.7783] |

These intervals are descriptive task-level estimates over the current 30-item pilot, not final submission power estimates.

## External Model Baselines

Eligible external model baselines currently recorded by the model-run index: anthropic-grounded-baseline-v1, openai-grounded-baseline-v1.

| Run | Manifest | Tasks | Answer | Scored report |
| --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | run_manifest | 30 | 0.3667 | yes |
| openai-grounded-baseline-v1 | run_manifest | 30 | 0.4000 | yes |

## Review Execution Readiness

These checks prove the mechanics around review handoff, import, merge, and gold-shape promotion. They do not substitute for real human review.

- Annotation export ready: true (124 rows across 30 files)
- Annotation import smoke ready: true (124 fixture rows, findings=0)
- Annotation import path ready: true (124/124 rows importable; applied=false)
- Release-gate annotation import check: yes (124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false)
- Annotator agreement report ready: true (0 completed metric pairs; agreement claim allowed=false)
- Release-gate annotator agreement check: yes (completed_metric_pairs=0; agreement_claim_allowed=false)
- Pilot gold promotion smoke ready: true (30/30 fixture gold items; release eligible=false)
- Release-gate pilot smoke check: yes (30/30 fixture gold items; release_eligible=false)
- Expansion promotion smoke ready: true (270/270 fixture expansion items; release eligible=false)
- Release-gate expansion smoke check: yes (270/270 fixture expansion items merge-ready; release_eligible=false)

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
- Packaged license clearance ready: true
- Unknown-license replacement candidates: 54
- Unknown-license pointer-only candidates: 81
- Pointer-only package items: 15
- Release gate status: blocked
- Release blockers: 7

## Release Gate Snapshot

| Check | Passed | Detail |
| --- | --- | --- |
| gold_review_complete | no | 0/30 valid reviewed items |
| annotation_protocol_present | yes | 60 pilot review rows; 540 expansion review rows |
| review_preflight_ready | no | 0/60 complete review rows |
| review_operations_ready | yes | 60 pilot incomplete rows; 540 expansion incomplete rows |
| review_triage_present | yes | 23 urgent/high pilot items ranked from 2 model baselines |
| annotation_assignment_plan_present | yes | 12 pilot assignments; 10 expansion assignments; first-wave expansion rows=100 |
| reviewer_handoff_ready | yes | 124 handoff rows across 30 files; gates=5/5 |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |
| adjudication_readiness_ready | yes | pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false |
| annotator_agreement_ready | yes | completed_metric_pairs=0; agreement_claim_allowed=false |
| annotation_export_ready | yes | 124 exported rows across 30 files; pilot=24; expansion=100 |
| annotation_import_smoke_ready | yes | 124 returned fixture rows checked across 30 files; findings=0 |
| annotation_import_path_ready | yes | 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false |
| gold_promotion_smoke_ready | yes | 30/30 fixture gold items; release_eligible=false |
| expansion_promotion_smoke_ready | yes | 270/270 fixture expansion items merge-ready; release_eligible=false |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items |
| review_merge_ready | no | 0/30 merge-ready items |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed |
| unknown_license_resolved | yes | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true |
| license_impact_clear | yes | 135/270 expansion candidates depend on unknown-license sources; 54 replaced; 81 pointer-only; packaged clearance=true |
| license_remediation_plan_present | yes | 54 replacement-path candidates; 81 pointer-only candidates |
| license_remediated_expansion_candidates_present | yes | 54/54 replacement-path candidates materialized |
| public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |
| scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |
| repair_queue_clear | yes | 0 repair-before-gold items |
| frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |
| baseline_uncertainty_present | yes | 5 systems with descriptive task-level intervals |
| model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |
| novelty_audit_final | no | checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5 |
| novelty_evidence_registry_present | yes | 18 related-work sources registered; completion_claim_allowed=false |
| corpus_audit_ready | yes | 5 source datasets; 270 scaled public items; 891 scaled evidence units; pointer_only=108 |

## Novelty Position

The novelty audit currently rejects broad claims such as "a RAG benchmark with citations" or "a contradiction benchmark." The defensible novelty position is the combined failure-mode bundle: document lifecycle, source authority, temporal validity, table/text interpretation, citation-overreach, insufficiency, disambiguation, and contradiction inside one executable grounded research QA harness. The current novelty evidence registry contains 18 sources and still disallows completion claims.

| Claim | Status | Reason |
| --- | --- | --- |
| Generic RAG benchmark | not_novel | Adjacent RAG and long-context benchmarks are abundant. |
| Temporal QA benchmark | not_novel_alone | ChronoQA already targets temporal-sensitive RAG. |
| Citation faithfulness benchmark | not_novel_alone | LongCite and related citation benchmarks cover attribution quality. |
| Unified hard-grounded research failure taxonomy | plausibly_differentiated_pending_final_audit | The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data. |

## Adversarial Related-Work Comparison

| Dimension | Closest source ids | Position to defend |
| --- | --- | --- |
| Context length or corpus realism | corpusqa-2026<br>longbench-pro-2026<br>enterprise-rag-bench-2026 | Not novel alone; use these sources to avoid overclaiming scale and to motivate controlled failure categories inside large-corpus research QA. |
| Temporal validity | chronoqa-2025<br>tdbench-2025<br>knowledge-drift-2025 | Not novel alone; hard-grounded research should focus on as-of-date citation semantics, stale/current document conflict, and visible evidence-state changes. |
| Citation faithfulness | longcite-2024<br>step-context-faithfulness-2026<br>ragbench-leaderboard-2025 | Not novel alone; the benchmark must test whether citations support the final conclusion, not merely whether cited spans are relevant to local facts. |
| Source authority and claim-level evidence | citation-closure-2026<br>legal-claim-rag-2026<br>decaf-2025 | Partly covered elsewhere; the defensible angle is combining authority conflicts with lifecycle, temporal, insufficiency, and contradiction tasks under one annotation protocol. |
| Entity ambiguity | entitymatch-2025<br>occ-rag-2026 | Not novel as a standalone phenomenon; include it because large-corpus research QA frequently fails by citing the right-looking source for the wrong entity. |

## Required Before Submission

1. Scale from 30 pilot items to at least 30-50 double-reviewed items per category.
2. Complete independent double review and adjudicate disagreements until gold promotion succeeds.
3. Run at least two frontier or open model baselines over the same scoring source.
4. Refresh the June 2026 novelty audit with paper citations immediately before any completion claim.
5. Convert this scaffold into a full manuscript with related work, annotation protocol, limitations, and statistical uncertainty.
