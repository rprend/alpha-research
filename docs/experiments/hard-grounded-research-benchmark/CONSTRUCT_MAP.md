# Hard Grounded Research Construct Map

This generated map makes the benchmark taxonomy inspectable as a construct-validity artifact. It links each category to rubrics, datasets, pilot examples, challenge payloads, scoring metrics, novelty risk, and review status. It does not claim that any construct has completed gold labels.

## Summary

- Construct map ready: true
- Categories: 10
- Ready constructs: 10
- High novelty-risk constructs: 5
- Constructs with reviewed gold: 0
- Pilot items mapped: 30
- Reviewed item gap: 300
- Scored systems mapped: 5

## Construct Validity Matrix

| Category | Ready | Novelty risk | Datasets | Rubric dimensions | Target metrics | Pilot items | Reviewed gold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | yes | high | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | hop_coverage<br>bridge_entity_resolution<br>minimal_citation_set | answer_correct<br>evidence_recall<br>citation_precision | 3 | 0/30 |
| stale-vs-current document conflicts | yes | medium | tdiggelm/climate_fever | document_date_identification<br>stale_evidence_rejection<br>current_state_grounding | answer_correct<br>citation_faithfulness<br>conclusion_support | 3 | 0/30 |
| appended document lifecycle changes | yes | low | allenai/qasper | section_provenance<br>supersession_detection<br>original_vs_appended_scope | answer_correct<br>conclusion_support<br>citation_faithfulness | 3 | 0/30 |
| table + text reasoning | yes | high | danwakeem/wikitablequestions-wtq | table_denotation<br>calculation_trace<br>textual_interpretation_support | answer_correct<br>evidence_recall<br>conclusion_support | 3 | 0/30 |
| source authority conflicts | yes | medium | tdiggelm/climate_fever<br>Pavithree/eli5 | source_type_identification<br>authority_ranking<br>conflict_resolution | answer_correct<br>conclusion_support<br>abstention_quality | 3 | 0/30 |
| evidence insufficiency / abstention | yes | high | allenai/qasper<br>tdiggelm/climate_fever | missing_evidence_identification<br>abstention_precision<br>non_hallucination | abstention_quality<br>answer_correct<br>citation_faithfulness | 3 | 0/30 |
| citation supports fact but not conclusion | yes | medium | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>Pavithree/eli5 | sentence_level_support<br>premise_conclusion_separation<br>unsupported_inference_detection | conclusion_support<br>citation_faithfulness<br>citation_precision | 3 | 0/30 |
| entity disambiguation | yes | medium | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq | entity_identity_match<br>alias_resolution<br>distractor_rejection | answer_correct<br>evidence_recall<br>citation_faithfulness | 3 | 0/30 |
| temporal questions: as of date X | yes | high | tdiggelm/climate_fever | as_of_filtering<br>future_evidence_exclusion<br>date_qualified_answer | answer_correct<br>citation_faithfulness<br>conclusion_support | 3 | 0/30 |
| cross-document contradiction | yes | high | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | contradiction_detection<br>evidence_partitioning<br>uncertainty_calibration | abstention_quality<br>conclusion_support<br>answer_correct | 3 | 0/30 |

## Challenge And Scoring Surface

| Category | Construction types | Challenge types | Scoring focus | Closest related work |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | reuse_native_labels | native_row | answer_exactness<br>citation_minimality<br>required_hop_coverage | multihop-rag-2024<br>occ-rag-2026<br>bridge-2026<br>magic-2025<br>decaf-2025 |
| stale-vs-current document conflicts | composed_corpus_suite | stale_current_conflict | citation_date_use<br>stale_evidence_rejection<br>temporal_grounding | chronoqa-2025<br>temprageval-2025<br>knowledge-drift-2025<br>faitheval-2024 |
| appended document lifecycle changes | reuse_native_labels | document_lifecycle_appendix | document_lifecycle_awareness<br>section_provenance<br>supersession_handling | bridge-2026 |
| table + text reasoning | composed_corpus_suite | native_row | calculation_trace<br>table_denotation<br>textual_support | bridge-2026<br>t2-ragbench-2026 |
| source authority conflicts | composed_corpus_suite | authority_conflict | authority_ranking<br>conflict_resolution<br>source_type_transparency | citation-closure-2026<br>legal-claim-rag-2026<br>lit-ragbench-2026<br>decaf-2025 |
| evidence insufficiency / abstention | composed_corpus_suite | insufficiency_probe | abstention_precision<br>hallucination_avoidance<br>missing_evidence_identification | occ-rag-2026<br>lit-ragbench-2026<br>step-context-faithfulness-2026<br>faitheval-2024 |
| citation supports fact but not conclusion | composed_corpus_suite | citation_overreach_probe | claim_citation_alignment<br>sentence_level_support<br>unsupported_inference_detection | longcite-2024<br>step-context-faithfulness-2026<br>ragbench-leaderboard-2025<br>faitheval-2024 |
| entity disambiguation | composed_corpus_suite | native_row | citation_entity_match<br>distractor_rejection<br>entity_resolution | occ-rag-2026<br>entitymatch-2025 |
| temporal questions: as of date X | composed_corpus_suite | as_of_date_constraint | answer_date_qualification<br>as_of_filtering<br>time_bounded_citations | chronoqa-2025<br>tdbench-2025<br>temprageval-2025<br>knowledge-drift-2025 |
| cross-document contradiction | composed_corpus_suite | cross_document_contradiction | contradiction_detection<br>evidence_set_partitioning<br>uncertainty_calibration | lit-ragbench-2026<br>legal-claim-rag-2026 |

## Baseline Metric Ranges By Construct

| Category | Metric | Current pilot range across systems |
| --- | --- | --- |
| multi-hop synthesis | answer_correct | 0.3333-1 |
| multi-hop synthesis | evidence_recall | 0.6889-1 |
| multi-hop synthesis | citation_precision | 1-1 |
| stale-vs-current document conflicts | answer_correct | 0-1 |
| stale-vs-current document conflicts | citation_faithfulness | 0-1 |
| stale-vs-current document conflicts | conclusion_support | 0-1 |
| appended document lifecycle changes | answer_correct | 0-1 |
| appended document lifecycle changes | conclusion_support | 0.5-1 |
| appended document lifecycle changes | citation_faithfulness | 0.5-1 |
| table + text reasoning | answer_correct | 0-1 |
| table + text reasoning | evidence_recall | 0.1667-1 |
| table + text reasoning | conclusion_support | 0.1667-1 |
| source authority conflicts | answer_correct | 0-1 |
| source authority conflicts | conclusion_support | 0-1 |
| source authority conflicts | abstention_quality | 0-1 |
| evidence insufficiency / abstention | abstention_quality | 0-1 |
| evidence insufficiency / abstention | answer_correct | 0-1 |
| evidence insufficiency / abstention | citation_faithfulness | 0-1 |
| citation supports fact but not conclusion | conclusion_support | 0-1 |
| citation supports fact but not conclusion | citation_faithfulness | 0.5-1 |
| citation supports fact but not conclusion | citation_precision | 1-1 |
| entity disambiguation | answer_correct | 0.3333-1 |
| entity disambiguation | evidence_recall | 0.5-1 |
| entity disambiguation | citation_faithfulness | 0.6667-1 |
| temporal questions: as of date X | answer_correct | 0-1 |
| temporal questions: as of date X | citation_faithfulness | 0-1 |
| temporal questions: as of date X | conclusion_support | 0-1 |
| cross-document contradiction | abstention_quality | 0-1 |
| cross-document contradiction | conclusion_support | 0-1 |
| cross-document contradiction | answer_correct | 0-1 |
