# Hard Grounded Research Paper Tables

This generated pack materializes the paper-facing tables and figure data from canonical benchmark artifacts. It is intended to prevent manual copy drift between the benchmark, dataset card, release gate, and paper draft.

## Summary

- Paper tables ready: true
- Tables: 6
- Categories: 10
- Source datasets: 5
- Scaled public items: 270
- Scored systems: 5
- Challenge rows: 40
- Failure modes: 8
- Novelty sources: 22
- Release blockers: 7
- Target reviewed items total: 300
- Completion claim allowed: false

## Benchmark Taxonomy and Construct Operationalization

Each hard-grounded category is tied to source datasets, rubric dimensions, target metrics, novelty risk, and reviewed-gold coverage.

| category | datasets | seed_tasks | rubric_dimensions | target_metrics | novelty_risk | reviewed_gold |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | 1.000 | hop_coverage<br>bridge_entity_resolution<br>minimal_citation_set | answer_correct<br>evidence_recall<br>citation_precision | high | 0/30 |
| stale-vs-current document conflicts | tdiggelm/climate_fever | 1.000 | document_date_identification<br>stale_evidence_rejection<br>current_state_grounding | answer_correct<br>citation_faithfulness<br>conclusion_support | medium | 0/30 |
| appended document lifecycle changes | allenai/qasper | 1.000 | section_provenance<br>supersession_detection<br>original_vs_appended_scope | answer_correct<br>conclusion_support<br>citation_faithfulness | low | 0/30 |
| table + text reasoning | danwakeem/wikitablequestions-wtq | 1.000 | table_denotation<br>calculation_trace<br>textual_interpretation_support | answer_correct<br>evidence_recall<br>conclusion_support | high | 0/30 |
| source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | 1.000 | source_type_identification<br>authority_ranking<br>conflict_resolution | answer_correct<br>conclusion_support<br>abstention_quality | medium | 0/30 |
| evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | 1.000 | missing_evidence_identification<br>abstention_precision<br>non_hallucination | abstention_quality<br>answer_correct<br>citation_faithfulness | high | 0/30 |
| citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>Pavithree/eli5 | 1.000 | sentence_level_support<br>premise_conclusion_separation<br>unsupported_inference_detection | conclusion_support<br>citation_faithfulness<br>citation_precision | medium | 0/30 |
| entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | 1.000 | entity_identity_match<br>alias_resolution<br>distractor_rejection | answer_correct<br>evidence_recall<br>citation_faithfulness | medium | 0/30 |
| temporal questions: as of date X | tdiggelm/climate_fever | 1.000 | as_of_filtering<br>future_evidence_exclusion<br>date_qualified_answer | answer_correct<br>citation_faithfulness<br>conclusion_support | high | 0/30 |
| cross-document contradiction | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | 1.000 | contradiction_detection<br>evidence_partitioning<br>uncertainty_calibration | abstention_quality<br>conclusion_support<br>answer_correct | high | 0/30 |

## Pilot Baseline Macro Results

Current pilot results for oracle sanity, non-oracle heuristics, and imported external model reports. Intervals are descriptive over the 30-item pilot.

| system_id | tasks | answer_correct | answer_correct_ci95 | evidence_recall | citation_faithfulness | conclusion_support | abstention_quality |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | 30.000 | 1.000 | 1.000<br>1.000 | 1.000 | 1.000 | 0.900 | 1.000 |
| lexical-evidence-baseline-v1 | 30.000 | 0.200 | 0.054<br>0.346 | 0.698 | 0.600 | 0.533 | 0.700 |
| citation-aware-verifier-v1 | 30.000 | 0.167 | 0.031<br>0.302 | 0.498 | 0.583 | 0.633 | 0.600 |
| anthropic-grounded-baseline-v1 | 30.000 | 0.367 | 0.191<br>0.542 | 0.290 | 0.400 | 0.300 | 0.433 |
| openai-grounded-baseline-v1 | 30.000 | 0.400 | 0.222<br>0.578 | 0.485 | 0.700 | 0.600 | 0.600 |

## Challenge-Type Diagnostic Matrix

Per-system challenge slices showing whether failures are concentrated in temporal, authority, contradiction, overreach, lifecycle, insufficiency, native, or stale/current probes.

| system_id | challenge_type | tasks | answer_correct | evidence_recall | citation_faithfulness | conclusion_support |
| --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | as_of_date_constraint | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | authority_conflict | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | citation_overreach_probe | 3.000 | 1.000 | 1.000 | 1.000 | 0.000 |
| local-rule-agent-v1 | cross_document_contradiction | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | document_lifecycle_appendix | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | insufficiency_probe | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | native_row | 9.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| local-rule-agent-v1 | stale_current_conflict | 3.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| lexical-evidence-baseline-v1 | as_of_date_constraint | 3.000 | 0.333 | 0.500 | 0.667 | 0.667 |
| lexical-evidence-baseline-v1 | authority_conflict | 3.000 | 0.333 | 1.000 | 0.667 | 0.667 |
| lexical-evidence-baseline-v1 | citation_overreach_probe | 3.000 | 0.333 | 0.395 | 0.667 | 0.000 |
| lexical-evidence-baseline-v1 | cross_document_contradiction | 3.000 | 0.000 | 0.395 | 0.500 | 0.500 |
| lexical-evidence-baseline-v1 | document_lifecycle_appendix | 3.000 | 0.000 | 1.000 | 0.500 | 0.500 |
| lexical-evidence-baseline-v1 | insufficiency_probe | 3.000 | 0.000 | 1.000 | 0.500 | 0.500 |
| lexical-evidence-baseline-v1 | native_row | 9.000 | 0.222 | 0.730 | 0.611 | 0.611 |
| lexical-evidence-baseline-v1 | stale_current_conflict | 3.000 | 0.333 | 0.500 | 0.667 | 0.667 |
| citation-aware-verifier-v1 | as_of_date_constraint | 3.000 | 0.333 | 0.250 | 0.667 | 0.667 |
| citation-aware-verifier-v1 | authority_conflict | 3.000 | 0.333 | 0.500 | 0.667 | 0.667 |
| citation-aware-verifier-v1 | citation_overreach_probe | 3.000 | 0.000 | 0.395 | 0.500 | 1.000 |
| citation-aware-verifier-v1 | cross_document_contradiction | 3.000 | 0.000 | 0.395 | 0.500 | 0.500 |
| citation-aware-verifier-v1 | document_lifecycle_appendix | 3.000 | 0.000 | 0.500 | 0.500 | 0.500 |
| citation-aware-verifier-v1 | insufficiency_probe | 3.000 | 0.000 | 0.500 | 0.500 | 0.500 |
| citation-aware-verifier-v1 | native_row | 9.000 | 0.222 | 0.730 | 0.611 | 0.611 |
| citation-aware-verifier-v1 | stale_current_conflict | 3.000 | 0.333 | 0.250 | 0.667 | 0.667 |
| anthropic-grounded-baseline-v1 | as_of_date_constraint | 3.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| anthropic-grounded-baseline-v1 | authority_conflict | 3.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| anthropic-grounded-baseline-v1 | citation_overreach_probe | 3.000 | 1.000 | 0.490 | 1.000 | 0.000 |
| anthropic-grounded-baseline-v1 | cross_document_contradiction | 3.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| anthropic-grounded-baseline-v1 | document_lifecycle_appendix | 3.000 | 0.667 | 1.000 | 0.833 | 0.833 |
| anthropic-grounded-baseline-v1 | insufficiency_probe | 3.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| anthropic-grounded-baseline-v1 | native_row | 9.000 | 0.667 | 0.470 | 0.722 | 0.722 |
| anthropic-grounded-baseline-v1 | stale_current_conflict | 3.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| openai-grounded-baseline-v1 | as_of_date_constraint | 3.000 | 0.000 | 0.250 | 0.500 | 0.500 |
| openai-grounded-baseline-v1 | authority_conflict | 3.000 | 0.000 | 0.500 | 0.500 | 0.500 |
| openai-grounded-baseline-v1 | citation_overreach_probe | 3.000 | 1.000 | 0.395 | 1.000 | 0.000 |
| openai-grounded-baseline-v1 | cross_document_contradiction | 3.000 | 0.000 | 0.264 | 0.500 | 0.500 |
| openai-grounded-baseline-v1 | document_lifecycle_appendix | 3.000 | 0.667 | 1.000 | 0.833 | 0.833 |
| openai-grounded-baseline-v1 | insufficiency_probe | 3.000 | 0.333 | 0.500 | 0.667 | 0.667 |
| openai-grounded-baseline-v1 | native_row | 9.000 | 0.667 | 0.563 | 0.833 | 0.833 |
| openai-grounded-baseline-v1 | stale_current_conflict | 3.000 | 0.000 | 0.250 | 0.500 | 0.500 |

## Observed Pilot Failure Modes

Cross-system qualitative failure modes extracted from scored pilot reports. These are diagnostic examples, not final human-reviewed claims.

| failure_mode | cases | systems | categories | challenge_types |
| --- | --- | --- | --- | --- |
| missing_required_evidence | 95.000 | 4.000 | 10.000 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_does_not_support_conclusion | 93.000 | 5.000 | 10.000 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_not_faithful_to_answer | 86.000 | 4.000 | 10.000 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| wrong_answer | 86.000 | 4.000 | 10.000 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| bad_abstention_or_conflict_behavior | 50.000 | 4.000 | 7.000 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| contradiction_resolution_failure | 12.000 | 4.000 | 1.000 | cross_document_contradiction |
| authority_resolution_failure | 10.000 | 4.000 | 1.000 | authority_conflict |
| temporal_scope_failure | 10.000 | 4.000 | 1.000 | as_of_date_constraint |

## Allowed and Prohibited Novelty Claims

Current June 2026 related-work registry boundaries. Final novelty remains blocked until the literature audit is refreshed before submission.

| paper_claim | status | reason |
| --- | --- | --- |
| We introduce a generic RAG benchmark. | prohibited_or_unsupported | Too broad and already covered by many RAG, long-context, and domain QA benchmarks. |
| We introduce a multi-hop RAG benchmark. | prohibited_or_unsupported | Multi-hop RAG is already directly benchmarked; this can only be a component category. |
| We introduce a temporal RAG benchmark. | prohibited_or_unsupported | Temporal RAG and temporal QA already have dedicated benchmarks. |
| We introduce citation faithfulness evaluation. | prohibited_or_unsupported | Citation and context faithfulness are already benchmarked; our narrower claim must be conclusion-support overreach. |
| We benchmark a unified taxonomy of hard grounded research QA failures beyond fact lookup. | allowed_with_evidence | This is the defensible claim if the paper shows reviewed items spanning lifecycle, authority, stale/current, conclusion-overreach, insufficiency, entity ambiguity, table/text, multi-hop, temporal, and contradiction categories. |
| The benchmark is paper-ready and genuinely novel as of June 2026. | prohibited_or_unsupported | This requires completed human review, category scale, and a final refreshed novelty audit. |

## Remaining Paper-Readiness Blockers

Current release-gate blockers that prevent treating the pilot package as a completed benchmark paper.

| check_id | detail | required_action |
| --- | --- | --- |
| gold_review_complete | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_preflight_ready | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| expansion_review_preflight_ready | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |

