# Benchmarks for Hard Grounded Research: Paper Draft

Status: working paper scaffold generated from repository artifacts, not a submission-ready manuscript.

## Abstract Draft

Grounded research QA is often evaluated as retrieval plus answer correctness, but research failures frequently arise after the relevant text has already been retrieved. We introduce a benchmark scaffold for hard grounded research that tests 10 failure categories across 6 Hugging Face datasets and 30 pilot items. The benchmark targets multi-hop synthesis, stale-vs-current document conflicts, appended document lifecycle changes, table-plus-text reasoning, source authority conflicts, evidence insufficiency, citation overreach, entity disambiguation, as-of-date questions, and cross-document contradiction. Early non-oracle baselines show that lexical evidence selection is insufficient: failures cluster by challenge type and include missing evidence, unsupported conclusions, abstention errors, and citation faithfulness gaps. Gold release is intentionally gated on double review, disagreement resolution, and item-quality checks.

## Central Claim

The benchmark should not be framed as another RAG or long-context leaderboard. The paper claim is narrower: grounded research is hard because systems must reason about document state, source authority, temporal validity, evidence sufficiency, and whether citations support conclusions rather than merely nearby facts.

## Contributions

1. A taxonomy of 10 hard grounded research failure modes beyond simple lookup.
2. A Hugging Face-grounded pilot suite spanning 6 public datasets and 8 challenge types.
3. A scoring contract with answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality.
4. A review workflow with double review, disagreement queues, reviewer agreement metrics, quality hints, annotation import/export checks, and strict gold promotion gates.
5. A baseline analysis that reports macro, category, and challenge-type failures for oracle sanity, lexical, citation-aware verifier, and external model systems.

## Dataset Grounding

The scaled public package currently contains 270 review-pending items, 15 distinct source rows, and 891 evidence units after license remediation and pointer-only packaging. This corpus audit is evidence for benchmark construction scope, not a substitute for human-reviewed gold labels.

The generated public package integrity report verifies 2 public package suites with 300 JSON items and 300 JSONL rows. It currently records 0 integrity findings and 0 pointer-only text leaks.

The generated public package schema report verifies 2 public package suites with 300 items and 996 evidence units against the downstream evaluator field contract. It currently records 0 schema violations.

The generated source-diversity plan sets a paper target of 30 distinct source rows per category (300 total). Current scaled artifacts cover 15 distinct source rows, leaving a 246-row deficit before large-corpus category claims are defensible.

The source acquisition manifest converts this into 17 Hugging Face sampling batches for 246 new distinct source rows, with 174 known-license rows preferred before 72 pointer-only rows.

The source acquisition packets materialize 17 JSONL queues with 246 target row slots. These packets define the next executable acquisition step, but acquired rows still require deduplication, task materialization, double review, and gold promotion before paper claims.

The source acquisition audit validates 246/246 packet rows with 0 findings, so packet drift is caught before acquisition starts.

The source acquisition fetch report executed those queues against the Hugging Face dataset viewer and fetched 246/246 distinct source rows with 0 findings. The current queue is now feasible as a source-row acquisition substrate, but the fetched rows still need task materialization, reviewer export, double review, and adjudication before they can support large-corpus paper claims.

The source acquisition candidate suite converts the fetched rows into 246 review-pending task drafts across 10 categories, with 492 required independent review rows. These drafts are a materialization queue, not evaluated gold.

The source acquisition review workbooks export those drafts into 20 category-level reviewer files with 492 total rows. This closes the acquisition-to-review handoff, while final paper claims remain blocked until reviewers return labels and merge/adjudication passes.

The source acquisition review preflight currently reports 0/492 completed review rows, so it is a validation target for returned packets rather than evidence of completed human annotation.

The generated source lineage ledger maps 276 pilot and acquisition-candidate rows to 261 distinct Hugging Face source rows across 6/6 registered datasets. This is the paper's auditable source-grounding bridge from dataset names to row-level provenance, license state, package policy, and review state.

| Dataset | License | Families | Categories | Distinct source rows |
| --- | --- | --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | pilot_suite<br>source_acquisition_candidate | citation supports fact but not conclusion<br>cross-document contradiction<br>entity disambiguation<br>multi-hop synthesis<br>stale-vs-current document conflicts<br>temporal questions: as of date X | 57 |
| tdiggelm/climate_fever | unknown | pilot_suite<br>source_acquisition_candidate | cross-document contradiction<br>evidence insufficiency / abstention<br>source authority conflicts<br>stale-vs-current document conflicts<br>temporal questions: as of date X | 63 |
| allenai/qasper | cc-by-4.0 | pilot_suite<br>source_acquisition_candidate | appended document lifecycle changes<br>citation supports fact but not conclusion<br>cross-document contradiction<br>evidence insufficiency / abstention<br>multi-hop synthesis<br>table + text reasoning | 77 |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | pilot_suite<br>source_acquisition_candidate | citation supports fact but not conclusion<br>entity disambiguation<br>table + text reasoning | 19 |
| Pavithree/eli5 | unknown | pilot_suite<br>source_acquisition_candidate | source authority conflicts | 15 |
| DongfuJiang/FeTaQA | mit | source_acquisition_candidate | citation supports fact but not conclusion<br>entity disambiguation<br>table + text reasoning | 30 |

Reviewer calibration is represented as 10 controlled sentinels across 10 categories with minimum reviewer accuracy 0.9. These sentinels screen reviewers before batch assignment and are explicitly excluded from benchmark gold promotion.

The annotation quality-control plan governs 1092 review rows with 5 pre-registered QA rules: calibration before assignment, double blind overlap, citation-support validation, disagreement adjudication, and agreement-claim gating. It explicitly forbids sentinel rows from entering benchmark gold.

| Dataset | License | Benchmark roles |
| --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | multi-hop synthesis<br>citation supports fact but not conclusion<br>entity disambiguation<br>cross-document contradiction |
| allenai/qasper | cc-by-4.0 | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>appended document lifecycle changes |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| DongfuJiang/FeTaQA | mit | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion |
| tdiggelm/climate_fever | unknown | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| Pavithree/eli5 | unknown | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion |

## Task Taxonomy

| Category | HF datasets | Seed tasks |
| --- | --- | --- |
| multi-hop synthesis | hotpotqa/hotpot_qa<br>allenai/qasper<br>Pavithree/eli5 | hgr_multi_hop_001 |
| stale-vs-current document conflicts | tdiggelm/climate_fever | hgr_stale_current_001 |
| appended document lifecycle changes | allenai/qasper | hgr_appendix_lifecycle_001 |
| table + text reasoning | danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | hgr_table_text_001 |
| source authority conflicts | tdiggelm/climate_fever<br>Pavithree/eli5 | hgr_authority_conflict_001 |
| evidence insufficiency / abstention | allenai/qasper<br>tdiggelm/climate_fever | hgr_abstain_001 |
| citation supports fact but not conclusion | hotpotqa/hotpot_qa<br>allenai/qasper<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA<br>Pavithree/eli5 | hgr_citation_overreach_001 |
| entity disambiguation | hotpotqa/hotpot_qa<br>danwakeem/wikitablequestions-wtq<br>DongfuJiang/FeTaQA | hgr_entity_disambiguation_001 |
| temporal questions: as of date X | tdiggelm/climate_fever | hgr_as_of_date_001 |
| cross-document contradiction | hotpotqa/hotpot_qa<br>tdiggelm/climate_fever | hgr_contradiction_001 |

## Construct Validity Map

The taxonomy is operationalized as a generated construct map, not only as category labels. It currently maps 10/10 constructs to rubrics, examples, scoring metrics, novelty risk, and review status. Reviewed-gold coverage remains 0 constructs, so this is construct-readiness evidence rather than a completed validity claim.

| Category | Rubric dimensions | Target metrics | Novelty risk | Reviewed gold |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | hop_coverage<br>bridge_entity_resolution<br>minimal_citation_set | answer_correct<br>evidence_recall<br>citation_precision | high | 0/30 |
| stale-vs-current document conflicts | document_date_identification<br>stale_evidence_rejection<br>current_state_grounding | answer_correct<br>citation_faithfulness<br>conclusion_support | medium | 0/30 |
| appended document lifecycle changes | section_provenance<br>supersession_detection<br>original_vs_appended_scope | answer_correct<br>conclusion_support<br>citation_faithfulness | low | 0/30 |
| table + text reasoning | table_denotation<br>calculation_trace<br>textual_interpretation_support | answer_correct<br>evidence_recall<br>conclusion_support | high | 0/30 |
| source authority conflicts | source_type_identification<br>authority_ranking<br>conflict_resolution | answer_correct<br>conclusion_support<br>abstention_quality | medium | 0/30 |
| evidence insufficiency / abstention | missing_evidence_identification<br>abstention_precision<br>non_hallucination | abstention_quality<br>answer_correct<br>citation_faithfulness | high | 0/30 |
| citation supports fact but not conclusion | sentence_level_support<br>premise_conclusion_separation<br>unsupported_inference_detection | conclusion_support<br>citation_faithfulness<br>citation_precision | medium | 0/30 |
| entity disambiguation | entity_identity_match<br>alias_resolution<br>distractor_rejection | answer_correct<br>evidence_recall<br>citation_faithfulness | medium | 0/30 |
| temporal questions: as of date X | as_of_filtering<br>future_evidence_exclusion<br>date_qualified_answer | answer_correct<br>citation_faithfulness<br>conclusion_support | high | 0/30 |
| cross-document contradiction | contradiction_detection<br>evidence_partitioning<br>uncertainty_calibration | abstention_quality<br>conclusion_support<br>answer_correct | high | 0/30 |

## Difficulty Mechanism Ledger

The paper question is not only whether systems can find facts, but which mechanisms make grounded research hard after plausible evidence is in context. The generated difficulty mechanism ledger maps every category to concrete mechanisms, observed baseline failure cases, target metrics, and claim blockers. It currently records 20 mechanisms across 10 categories and 116 observed pilot failure cases; 10 category claims remain blocked until review scale and final novelty gates clear.

| Category | Mechanisms | Target metrics | Failure cases | Claim status |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | requires evidence composition across separate facts<br>distractors can support one hop without supporting the final answer | answer_correct<br>evidence_recall<br>citation_precision | 10 | blocked_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | requires rejecting plausible stale evidence<br>requires selecting the controlling current document snapshot | answer_correct<br>citation_faithfulness<br>conclusion_support | 12 | blocked_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | requires tracking document state after appendices or errata<br>requires recognizing when later appended material supersedes body text | answer_correct<br>conclusion_support<br>citation_faithfulness | 8 | blocked_until_review_scale_and_novelty_clear |
| table + text reasoning | requires joining structured table cells with textual qualifiers<br>requires numeric or tabular grounding plus prose interpretation | answer_correct<br>evidence_recall<br>conclusion_support | 12 | blocked_until_review_scale_and_novelty_clear |
| source authority conflicts | requires resolving evidence by authority hierarchy<br>requires ignoring lower-authority evidence that is locally plausible | answer_correct<br>conclusion_support<br>abstention_quality | 11 | blocked_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | requires distinguishing relevant context from sufficient evidence<br>requires abstaining when citations are near misses | abstention_quality<br>answer_correct<br>citation_faithfulness | 12 | blocked_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | requires checking whether cited facts license the final conclusion<br>requires detecting conclusion overreach despite faithful subfact citation | conclusion_support<br>citation_faithfulness<br>citation_precision | 15 | blocked_until_review_scale_and_novelty_clear |
| entity disambiguation | requires binding evidence to the intended referent<br>requires resisting same-name or near-name distractors | answer_correct<br>evidence_recall<br>citation_faithfulness | 12 | blocked_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | requires answering relative to an explicit date<br>requires excluding evidence outside the requested temporal snapshot | answer_correct<br>citation_faithfulness<br>conclusion_support | 12 | blocked_until_review_scale_and_novelty_clear |
| cross-document contradiction | requires reporting conflict or applying a control rule<br>requires avoiding synthesis across incompatible documents | abstention_quality<br>conclusion_support<br>answer_correct | 12 | blocked_until_review_scale_and_novelty_clear |

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

## Failure Atlas

The generated failure atlas records 116 pilot failure cases across 8 failure modes from 5 scored systems. These examples support qualitative diagnosis of the benchmark surface; they do not support final paper claims until human review, scale, and final novelty checks pass.

The generated error codebook defines 8 qualitative error codes and 6 reviewer coding rules. It turns failure modes into reproducible coding instructions so pilot examples and future gold errors can be analyzed under the same definitions.

| Failure mode | Cases | Systems | Categories | Challenge types |
| --- | --- | --- | --- | --- |
| missing_required_evidence | 95 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_does_not_support_conclusion | 93 | 5 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_not_faithful_to_answer | 86 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| wrong_answer | 86 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| bad_abstention_or_conflict_behavior | 50 | 4 | 7 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| contradiction_resolution_failure | 12 | 4 | 1 | cross_document_contradiction |
| authority_resolution_failure | 10 | 4 | 1 | authority_conflict |
| temporal_scope_failure | 10 | 4 | 1 | as_of_date_constraint |

| System | Category | Challenge | Failure modes | Metrics |
| --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 |

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

## Paper Tables And Figure Data

The generated paper table pack contains 6 synchronized tables covering taxonomy constructs, macro results, challenge diagnostics, failure modes, novelty claim boundaries, and remaining paper-readiness blockers. The manuscript should cite `PAPER_TABLES.md` and `generated/paper-tables.json` as the source for copied tables to avoid drift from benchmark artifacts.

## Statistical Analysis Plan

The generated analysis plan pre-specifies 4 hypotheses, 4 model families, 7 covariates, and 3 claim gates for answering the central paper question. It allows pilot diagnostics now, but blocks category-level conclusions until 300 reviewed target items and final novelty checks are available.

The generated hypothesis test matrix makes those hypotheses category-specific: 10 difficulty hypotheses are tied to primary metrics, expected failure signatures, current pilot evidence, and explicit claim gates. It currently finds expected failure signatures in 10/10 categories, but all rows remain diagnostic-only until double review, category scale, and final novelty gates clear.

| Category | Hypothesis | Primary metrics | Observed expected modes | Claim status |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | Models will retrieve individually relevant hops but lose answer correctness or conclusion support when the final answer requires evidence composition. | answer_correct<br>evidence_recall<br>conclusion_support | missing_evidence<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | Models will overuse plausible stale evidence unless the scoring source forces recency-conditioned citation and answer selection. | answer_correct<br>citation_faithfulness<br>conclusion_support | stale_evidence_used<br>temporal_scope_error | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | Models will treat appended or corrective text as additive context instead of a document-state transition that can supersede earlier content. | answer_correct<br>evidence_recall<br>conclusion_support | lifecycle_state_missed<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | Models will cite the correct table cell while failing the prose qualifier or interpretation required to make the answer grounded. | answer_correct<br>citation_precision<br>conclusion_support | table_text_join_error<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | Models will synthesize lower- and higher-authority sources unless the task requires an explicit authority hierarchy. | answer_correct<br>citation_faithfulness<br>abstention_quality | authority_resolution_error<br>contradiction_missed | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | Models will answer from near-miss evidence instead of abstaining when relevance is present but sufficiency is absent. | abstention_quality<br>conclusion_support<br>citation_faithfulness | abstention_error<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | Models will cite true premises and still make unsupported comparative, causal, or interpretive conclusions. | conclusion_support<br>citation_faithfulness<br>answer_correct | citation_overreach<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | Models will retrieve or cite same-name evidence while answering about the wrong referent. | answer_correct<br>evidence_recall<br>citation_precision | entity_binding_error<br>wrong_evidence | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | Models will answer using globally current or generally true evidence rather than the requested as-of date. | answer_correct<br>citation_faithfulness<br>abstention_quality | temporal_scope_error<br>stale_evidence_used | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | Models will merge incompatible documents into a single unsupported answer instead of reporting conflict or applying a control rule. | abstention_quality<br>conclusion_support<br>citation_faithfulness | contradiction_missed<br>unsupported_conclusion | diagnostic_only_until_review_scale_and_novelty_clear |

The generated result interpretation guide pre-registers how reviewed results should be read: 30 rules define confirm, partial-support, and falsification/revision conditions across 10 category hypotheses. This prevents the paper from turning pilot failures into mechanism conclusions without reviewed scale and uncertainty evidence.

| Category | Confirm | Partial support | Falsify or revise |
| --- | --- | --- | --- |
| multi-hop synthesis | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for multi-hop synthesis vs native single-row or first-evidence baselines and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| stale-vs-current document conflicts | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for stale evidence distractors vs current controlling evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| appended document lifecycle changes | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for body-only evidence vs appended lifecycle evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| table + text reasoning | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for table-only extraction vs table-plus-text interpretation and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| source authority conflicts | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for authority-ranked evidence vs locally plausible lower-authority evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| evidence insufficiency / abstention | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for near-miss evidence vs sufficient evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| citation supports fact but not conclusion | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for premise-supported citation vs conclusion-supported citation and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| entity disambiguation | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for intended entity evidence vs same-name distractor evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| temporal questions: as of date X | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for as-of-date snapshot vs outside-window evidence and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |
| cross-document contradiction | After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for conflicting evidence bundle vs non-conflicting bundle and the expected failure signature appears in reviewed errors. | Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit. | Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls. |

The generated evidence sufficiency audit keeps the benchmark grounded at item level: 30/30 pilot items have required evidence contracts, 30 expose trap/control signals, and all 30 remain diagnostic-only until review scale and novelty gates clear.

| Category | Evidence contracts | Trap/control items | Insufficiency/overreach | Temporal/contradiction | Claim status |
| --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | 3/3 | 3 | 0/0 | 3/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | 3/3 | 3 | 3/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | 3/3 | 3 | 0/3 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | 3/3 | 3 | 0/0 | 0/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | 3/3 | 3 | 0/0 | 3/0 | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | 3/3 | 3 | 0/0 | 0/3 | diagnostic_only_until_review_scale_and_novelty_clear |

The generated estimand registry defines the confirmatory target for each category hypothesis before any final results are interpreted: 10 estimands specify target population, analysis unit, primary contrast, metrics, estimator, uncertainty method, minimum reviewed sample, and claim gates. This makes the paper's empirical claims auditable even while all estimands remain diagnostic-only.

| Category | Unit | Primary contrast | Primary metrics | Estimator | Claim status |
| --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | item_system_response | multi-hop synthesis vs native single-row or first-evidence baselines | answer_correct<br>evidence_recall<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | item_system_response | stale evidence distractors vs current controlling evidence | answer_correct<br>citation_faithfulness<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | item_system_response | body-only evidence vs appended lifecycle evidence | answer_correct<br>evidence_recall<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | item_system_response | table-only extraction vs table-plus-text interpretation | answer_correct<br>citation_precision<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | item_system_response | authority-ranked evidence vs locally plausible lower-authority evidence | answer_correct<br>citation_faithfulness<br>abstention_quality | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | item_system_response | near-miss evidence vs sufficient evidence | abstention_quality<br>conclusion_support<br>citation_faithfulness | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | item_system_response | premise-supported citation vs conclusion-supported citation | conclusion_support<br>citation_faithfulness<br>answer_correct | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | item_system_response | intended entity evidence vs same-name distractor evidence | answer_correct<br>evidence_recall<br>citation_precision | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | item_system_response | as-of-date snapshot vs outside-window evidence | answer_correct<br>citation_faithfulness<br>abstention_quality | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | item_system_response | conflicting evidence bundle vs non-conflicting bundle | abstention_quality<br>conclusion_support<br>citation_faithfulness | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | diagnostic_only_until_review_scale_and_novelty_clear |

The generated sensitivity analysis plan pre-registers 6 robustness checks before reviewed results are interpreted. It requires claims to be narrowed or marked exploratory when metric strictness, abstention policy, aggregation, model eligibility, missing review data, or multiple-testing assumptions change the conclusion.

| Check | Affected metrics | Estimand link | Decision rule |
| --- | --- | --- | --- |
| metric_strictness | citation_faithfulness<br>conclusion_support | All category estimands with citation or conclusion metrics. | If a qualitative conclusion changes sign or interval interpretation under strict support, report the claim as sensitivity-dependent. |
| abstention_policy | answer_correctness<br>abstention_quality | Evidence insufficiency, cross-document contradiction, and temporal estimands. | Claims about abstention quality require the same direction under strict and lenient policies. |
| aggregation_weighting | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All benchmark-level and category-level estimands. | Benchmark-level claims must disclose when category weighting changes model ordering or effect magnitude by more than the planned uncertainty interval. |
| model_eligibility | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | System comparison estimands and reporting-card claims. | Do not promote a model comparison claim if it appears only after adding diagnostic systems excluded by the reporting card. |
| missing_review_data | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All confirmatory reviewed-data estimands. | No category claim is allowed when worst-case missing-review bounds cross the null or contradict the primary direction. |
| multiple_testing | answer_correct<br>evidence_recall<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All category hypotheses in the estimand registry. | Treat claims that survive only unadjusted intervals as exploratory, not confirmatory. |

The generated lookup contrast registry states the simple fact-lookup control and the additional hard-grounding operation for each category. This is the direct paper bridge from taxonomy to the question of what makes grounded research hard beyond lookup.

| Category | Simple lookup control | Hard grounding operation | Lookup-only failure | Primary metrics |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | Retrieve one page or one sentence containing a relevant entity fact. | Compose two or more required hops and reject a topically relevant but nonessential page. | The answer may be correct but the cited evidence misses one required hop or includes a distractor as if it were necessary. | answer_correct<br>evidence_recall<br>conclusion_support |
| stale-vs-current document conflicts | Find a document that contains the requested claim text. | Select the controlling current snapshot and mark stale evidence as non-controlling. | The answer blends old and current snapshots or treats stale evidence as equally valid. | answer_correct<br>citation_faithfulness<br>conclusion_support |
| appended document lifecycle changes | Find the original paper body passage that states a relevant claim. | Detect appended or lifecycle material that narrows, qualifies, or supersedes the original body. | The answer cites original-body evidence for a conclusion controlled by the appended material. | answer_correct<br>evidence_recall<br>conclusion_support |
| table + text reasoning | Extract a table cell or caption fact. | Combine table denotation with surrounding text before drawing the conclusion. | The answer extracts the right cell but draws a conclusion the text or caption does not support. | answer_correct<br>citation_precision<br>conclusion_support |
| source authority conflicts | Find a clear source that says a plausible answer. | Rank sources by authority and explain why lower-authority evidence is rejected. | The answer chooses the clearest prose instead of the highest-authority source. | answer_correct<br>citation_faithfulness<br>abstention_quality |
| evidence insufficiency / abstention | Find a related fact or candidate evidence passage. | Decide whether the evidence entails the requested conclusion and abstain when it does not. | The answer supplies a plausible conclusion from evidence that supports only a related premise. | abstention_quality<br>conclusion_support<br>citation_faithfulness |
| citation supports fact but not conclusion | Find a citation that supports a true premise. | Separate premise support from conclusion support and reject unsupported inference. | The answer uses a true citation as post-hoc support for a broader conclusion it does not entail. | conclusion_support<br>citation_faithfulness<br>answer_correct |
| entity disambiguation | Find a fact about a name, title, place, or abbreviation. | Resolve the intended entity and reject same-name or same-title distractors. | The answer merges entities that share a surface form. | answer_correct<br>evidence_recall<br>citation_precision |
| temporal questions: as of date X | Find the most salient or newest relevant evidence. | Filter evidence by the requested as-of date and exclude future or stale evidence. | The answer leaks later evidence into an as-of answer or ignores the date constraint. | answer_correct<br>citation_faithfulness<br>abstention_quality |
| cross-document contradiction | Find documents that mention the topic. | Partition incompatible evidence and report conflict or apply the stated control rule. | The answer smooths contradictory evidence into a false consensus. | abstention_quality<br>conclusion_support<br>citation_faithfulness |

The generated statistical reporting template defines the minimum reviewed-result table contract before category claims can be upgraded from diagnostic to supported. Each category row must carry the estimand, lookup contrast, denominator rule, uncertainty method, sensitivity status, and claim gate.

| Category | Estimand | Primary metrics | Uncertainty | Claim status |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | estimand_multi_hop_synthesis | answer_correct<br>evidence_recall<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | estimand_stale_vs_current_document_conflicts | answer_correct<br>citation_faithfulness<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | estimand_appended_document_lifecycle_changes | answer_correct<br>evidence_recall<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | estimand_table_text_reasoning | answer_correct<br>citation_precision<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | estimand_source_authority_conflicts | answer_correct<br>citation_faithfulness<br>abstention_quality | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | estimand_evidence_insufficiency_abstention | abstention_quality<br>conclusion_support<br>citation_faithfulness | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | estimand_citation_supports_fact_but_not_conclusion | conclusion_support<br>citation_faithfulness<br>answer_correct | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | estimand_entity_disambiguation | answer_correct<br>evidence_recall<br>citation_precision | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | estimand_temporal_questions_as_of_date_x | answer_correct<br>citation_faithfulness<br>abstention_quality | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | estimand_cross_document_contradiction | abstention_quality<br>conclusion_support<br>citation_faithfulness | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |

The generated control ablation plan defines category-specific negative controls and ablations so future results can distinguish intended hard-grounding mechanisms from source-count, prompt-length, citation-count, dataset-identity, or surface-form confounds.

| Category | Negative control | Ablations | Diagnostic question |
| --- | --- | --- | --- |
| multi-hop synthesis | single-hop variant containing one required entity fact and no bridge requirement | remove_second_hop_evidence<br>replace_distractor_with_same_entity_page<br>balance_source_count_to_two_documents | Does performance drop only when the answer requires composing both hops rather than retrieving either fact? |
| stale-vs-current document conflicts | current-only variant with stale snapshot removed | remove_document_dates<br>swap_stale_and_current_order<br>balance_snapshot_count | Does performance depend on temporal/source-state control rather than claim-text retrieval? |
| appended document lifecycle changes | original-body-only variant where no appendix or lifecycle update changes the answer | remove_appendix_update<br>hide_appendix_label<br>append_update_as_unlabeled_evidence | Does performance drop when appended material supersedes or qualifies the original body? |
| table + text reasoning | table-cell lookup variant whose answer is entailed by the cell alone | remove_surrounding_text<br>remove_table_caption<br>shuffle_nonanswer_rows | Does performance depend on integrating table denotation with surrounding text? |
| source authority conflicts | single-authority variant where all cited sources agree and have equal authority | remove_authority_metadata<br>reverse_source_order<br>balance_authority_source_count | Does performance depend on authority ranking rather than selecting the clearest prose? |
| evidence insufficiency / abstention | sufficient-evidence variant with explicit entailment for the answer | add_related_but_nonentailed_premise<br>remove_insufficiency_label<br>balance_candidate_evidence_count | Does performance distinguish related evidence from evidence that entails the conclusion? |
| citation supports fact but not conclusion | premise-and-conclusion variant where the citation entails both fact and conclusion | remove_conclusion_support_sentence<br>keep_true_premise_only<br>balance_citation_count | Does performance separate premise support from conclusion support? |
| entity disambiguation | unambiguous entity variant with no same-name distractor | remove_disambiguating_context<br>add_same_surface_form_distractor<br>balance_entity_mention_count | Does performance depend on resolving the intended entity rather than matching surface form? |
| temporal questions: as of date X | timeless variant where the same answer is valid before and after the as-of date | remove_as_of_date<br>add_future_evidence<br>balance_pre_and_post_date_evidence | Does performance depend on applying the as-of date rather than retrieving the newest evidence? |
| cross-document contradiction | consensus variant where all documents support the same conclusion | remove_conflicting_document<br>hide_conflict_marker<br>balance_support_and_refute_source_count | Does performance identify contradiction instead of smoothing evidence into consensus? |

## Paper Claim Ledger

The generated paper claim ledger maps 8 manuscript claims to current evidence: 3 allowed, 2 diagnostic-only, and 3 prohibited until review, scale, and novelty gates pass. This ledger is the manuscript claim boundary until final human-review and June 2026 novelty gates are complete.

The generated supplement index maps 6 supplement sections, 6 paper tables, and 8 claims to source artifacts. It should be used as the reviewer-facing navigation layer for supplementary materials.

The generated reviewer FAQ answers 6 likely reviewer objections using current release blockers, novelty boundaries, source-package policy, and validity risks. It should be kept with the supplement for submission and rebuttal preparation.

## Responsible Use And Leaderboard Policy

The generated responsible-use policy contains 6 rules and 2 active restrictions. It disallows public leaderboards and completion claims while review, scale, and novelty gates remain incomplete, and requires pointer-only handling for license-sensitive evidence.

The generated data statement records 6 source datasets, 270 scaled public items, 15 pointer-only package items, intended uses, out-of-scope uses, and review-state limits. It is the package-facing datasheet companion to the dataset card.

## Scale And Power Plan

The paper target is 30 double-reviewed items per category (300 total). The current pilot remains diagnostic because it has 30 pilot items and 0 valid reviewed items. The generated plan uses conservative normal-approximation intervals for bounded task metrics and keeps category-scale claims blocked until review completes.

| Scope | Planning n | Worst-case 95% half-width | Detectable delta | Interpretation |
| --- | --- | --- | --- | --- |
| current_pilot_overall | 30 | 0.1789 | undefined | Descriptive pilot diagnostics only; not enough for category-level paper claims. |
| current_pilot_per_category | 3 | 0.5658 | undefined | Too wide for category-level claims; each category currently has only pilot seeds. |
| paper_target_per_category | 30 | 0.1789 | undefined | Minimum category-level descriptive target; still reports uncertainty, not a fine-grained leaderboard. |
| paper_target_overall | 300 | 0.0566 | undefined | Overall benchmark-level estimates become substantially tighter after all categories are reviewed. |

## Reproducibility Artifact Checklist

The generated artifact checklist records 60 reproduction commands and 62/62 ready artifact classes. It also carries the release blockers into the manuscript surface, so the paper cannot imply completion while the release gate remains `blocked`.

The generated version manifest records SHA-256 digests for 93 package-critical artifacts totaling 1617217 bytes. A submitted manuscript should cite `VERSION_MANIFEST.md` and `generated/version-manifest.json` so reviewers can identify the exact benchmark state behind the tables and claims.

The generated reproduction capsule `reproduction-capsule-v1` records 60 reproduction commands, 3 validation commands, 93 artifact hashes, and 7 expected release blockers. It is the reviewer start-here artifact for reproducing the current package state.

The generated citation metadata `citation-metadata-v1` defines the provisional citation key `hard_grounded_research_benchmark_2026` and 6 citation caveats. It ties citation text to 93 package hashes and explicitly prevents final novelty, completion, or leaderboard claims from being inferred from the citation.

The generated review execution plan records 600 remaining reviewer rows and an estimated 74.4 reviewer-hours including adjudication reserve. It turns the current review blockers into 2 waves with explicit acceptance gates, but it does not count as completed review.

The generated review packet audit verifies 40 first-wave reviewer files, 160 exported rows, and 10 expansion categories with 0 packet findings. This supports reviewer handoff reproducibility without substituting for returned human labels.

The generated review return contract specifies 40 returned files, 160 returned rows, and 6 rejection rules before annotations can be imported. It makes real human-label intake auditable without counting fixture returns as completed review.

The generated review return preflight reports 0/40 real returned files present, 40 missing files, and latest_import_ready=true. This separates a clean intake contract from the still-unmet requirement to collect real human annotations.

The generated review return checklist enumerates 40 exact returned-packet work units covering 160 rows, with 40 packets still missing. This gives the paper-review workflow a packet-level tracker rather than only aggregate row counts.

The generated review collection tracker prioritizes missing returns by release impact: 20 pilot-gold packets and 20 expansion-scale packets remain missing, with 0 packets returned pending import. It is the operational queue for clearing review gates without treating fixture returns as evidence.

The generated review wave schedule turns that queue into 2 collection waves across 40 exact returned-packet files. It puts pilot-gold packets first, preserves category balance, and keeps all review-completion claims blocked until real returned labels are imported and merged.

The generated review drop-off manifest binds those expected return files to 40 source export hashes, exact drop-off paths, editable reviewer fields, immutable-field policy, and dry-run/apply commands. It is an acceptance surface for real reviewer files, not evidence that labels have been returned.

The generated review intake validator joins that drop-off manifest with return preflight and the latest import dry-run. It currently records 0 accepted packets and 40 blocked packets, so reviewer returns remain blocked from apply until packet-level intake passes.

The generated review assignment audit checks blind double-review setup before labels are accepted: 22 assignments, 22 with distinct reviewer slots, and 0 blocked assignments under reviewer-field-only constraints.

The generated gold adjudication plan makes the pilot gold blocker item-level: 30 pilot items across 10 categories, 60 missing reviews, and 0 promotion-ready items. This is the promotion checklist for the eventual reviewed-gold table.

The generated scale adjudication plan makes the category-scale blocker batch-level: 30 expansion batches, 270 planned new items, 540 missing review rows, and 0 merge-ready expansion items. This is the promotion checklist for future category-level claims.

The generated scale gap ledger makes the paper-scale deficit category-level: 300 reviewed items still needed across 10 categories, backed by 270 planned candidates and 540 planned review rows. Category-level benchmark claims remain blocked until this deficit reaches zero and the release gate passes.

The generated source lineage ledger `source-lineage-ledger-v1` maps pilot and acquisition-candidate rows to Hugging Face source-row keys, dataset licenses, package policy, and review state. See `SOURCE_LINEAGE_LEDGER.md`.

The generated difficulty mechanism ledger keeps the central position-paper claim auditable: 20 category mechanisms are tied to current failure evidence, target metrics, and blocked category claims rather than left as prose-only taxonomy. See `DIFFICULTY_MECHANISM_LEDGER.md`.

The generated hypothesis test matrix `hypothesis-test-matrix-v1` turns those mechanisms into testable empirical predictions and metric contrasts. It is the manuscript bridge from taxonomy to falsifiable evaluation plan. See `HYPOTHESIS_TEST_MATRIX.md`.

The generated result interpretation guide `result-interpretation-guide-v1` defines what future reviewed results would need to show before a mechanism claim can be upgraded from diagnostic to supported. See `RESULT_INTERPRETATION_GUIDE.md`.

The generated evidence sufficiency audit `evidence-sufficiency-audit-v1` maps pilot items to required evidence, excluded/control evidence, insufficiency probes, overreach probes, temporal filters, and contradiction contracts. See `EVIDENCE_SUFFICIENCY_AUDIT.md`.

The generated estimand registry `estimand-registry-v1` binds category hypotheses to populations, units, contrasts, metrics, estimators, uncertainty methods, and claim gates. See `ESTIMAND_REGISTRY.md`.

The generated sensitivity analysis plan `sensitivity-analysis-plan-v1` pre-registers robustness checks for metric, model, aggregation, missing-data, and multiplicity assumptions. See `SENSITIVITY_ANALYSIS_PLAN.md`.

The generated lookup contrast registry `lookup-contrast-registry-v1` defines the simple lookup control and additional hard-grounding operation for each category. See `LOOKUP_CONTRAST_REGISTRY.md`.

The generated statistical reporting template `statistical-reporting-template-v1` defines the required result table sections, category reporting rows, metric columns, uncertainty fields, sensitivity links, and claim-gate columns for reviewed results. See `STATISTICAL_REPORTING_TEMPLATE.md`.

The generated control ablation plan `control-ablation-plan-v1` defines negative controls and ablation conditions for each category before mechanism attribution claims are allowed. See `CONTROL_ABLATION_PLAN.md`.

| Artifact class | Status | Evidence |
| --- | --- | --- |
| taxonomy_and_constructs | ready | 10/10 constructs mapped to rubrics, metrics, examples, novelty risk, and review status. |
| corpus_and_public_package | ready | 270 scaled public items; 891 evidence units; 108 pointer-only evidence units. |
| public_package_integrity | ready | public-package-integrity-v1; suites=2; items=300; findings=0. |
| public_package_schema | ready | public-package-schema-v1; suites=2; items=300; schema violations=0. |
| source_diversity_expansion | ready | 15/300 target source rows; deficit=246. |
| source_acquisition_manifest | ready | 17 acquisition batches; 246 target new source rows. |
| source_acquisition_packets | ready | 17 packet files; 246 acquisition row slots. |
| source_acquisition_audit | ready | 246/246 packet rows audited; findings=0. |
| source_acquisition_fetch_report | ready | 246/246 source rows fetched from Hugging Face; findings=0. |
| source_acquisition_candidates | ready | 246 fetched-row candidates; 492 required review rows. |
| source_acquisition_review_workbooks | ready | 20 workbooks; 492 source-acquisition review rows. |
| source_acquisition_review_preflight | ready | 0/492 source-acquisition review rows complete; preflight_ready=false. |
| source_lineage_ledger | ready | source-lineage-ledger-v1; lineage rows=276; datasets=6/6; source rows=261. |
| difficulty_mechanism_ledger | ready | difficulty-mechanism-ledger-v1; categories=10; mechanisms=20; observed failure cases=116; reviewed deficit=300. |
| review_calibration | ready | 10 reviewer-screening sentinels across 10 categories; minimum_accuracy=0.9. |
| annotation_quality_control | ready | 1092 review rows governed by 5 QA rules; sentinel rows in gold=false. |
| annotation_and_review_workflow | ready | 160 exported review rows; 300 reviewed target items remaining. |
| review_execution_plan | ready | review-execution-plan-v1; rows remaining=600; reviewer hours=74.4; blocking checks=6. |
| review_packet_audit | ready | review-packet-audit-v1; files=40; rows=160; findings=0. |
| review_return_contract | ready | review-return-contract-v1; files=40; rows=160; findings=0. |
| review_return_preflight | ready | review-return-preflight-v1; present=0/40; missing=40; latest import ready=true. |
| review_return_checklist | ready | review-return-checklist-v1; packets=40; rows=160; missing=40. |
| review_collection_tracker | ready | review-collection-tracker-v1; packets=40; missing=40; returned=0. |
| review_wave_schedule | ready | review-wave-schedule-v1; waves=2; packets=40; scheduled missing=40. |
| review_dropoff_manifest | ready | review-dropoff-manifest-v1; packets=40; export hashes=40; rows=160. |
| review_intake_validator | ready | review-intake-validator-v1; packets=40; accepted=0; blocked=40. |
| review_assignment_audit | ready | review-assignment-audit-v1; assignments=22; double-review=22; blocked=0. |
| gold_adjudication_plan | ready | gold-adjudication-plan-v1; items=30; missing reviews=60; promotion-ready=0. |
| scale_adjudication_plan | ready | scale-adjudication-plan-v1; batches=30; missing review rows=540; merge-ready=0. |
| scale_gap_ledger | ready | scale-gap-ledger-v1; categories=10; reviewed deficit=300; planned review rows=540. |
| submission_contract | ready | submission-contract-v1; pilot tasks=30; required fields=5. |
| scoring_contract | ready | scoring-contract-v1; metrics=8; required metrics=6/6. |
| error_codebook | ready | error-codebook-v1; codes=8; observed pilot failures=116. |
| baselines_and_scoring | ready | 5 scored systems; 2 eligible external model baselines. |
| hypothesis_test_matrix | ready | hypothesis-test-matrix-v1; hypotheses=10; observed signature categories=10; diagnostic-only=10. |
| result_interpretation_guide | ready | result-interpretation-guide-v1; rules=30; target reviewed items=300; blocked gates=4. |
| evidence_sufficiency_audit | ready | evidence-sufficiency-audit-v1; items=30; evidence contracts=30; insufficiency=3; overreach=3. |
| estimand_registry | ready | estimand-registry-v1; estimands=10; target reviewed items=300; blocked gates=4. |
| sensitivity_analysis_plan | ready | sensitivity-analysis-plan-v1; checks=6; required metrics=6; blocked gates=4. |
| lookup_contrast_registry | ready | lookup-contrast-registry-v1; categories=10; lookup controls=10; estimand links=10. |
| statistical_reporting_template | ready | statistical-reporting-template-v1; categories=10; table sections=4; blocked gates=4. |
| control_ablation_plan | ready | control-ablation-plan-v1; categories=10; negative controls=10; ablations=30. |
| model_reporting_card | ready | model-reporting-card-v1; systems=7; eligible=2; required fields=11. |
| statistics_and_scale | ready | 30 target reviewed items/category; 300 reviewed items remaining. |
| paper_tables_and_figures | ready | 6 paper tables; 40 challenge rows; 8 failure modes. |
| analysis_plan | ready | 4 hypotheses; 4 model families; 7 covariates. |
| paper_claim_ledger | ready | 8 claims mapped to evidence; prohibited=3; diagnostic=2. |
| supplement_index | ready | supplement-index-v2; sections=6; tables=6; claims=8. |
| reproduction_capsule | ready | reproduction-capsule-v1; commands=60; validations=3; hashes=93. |
| citation_metadata | ready | citation-metadata-v1; caveats=6; artifact hashes=93; blockers=7. |
| reviewer_faq | ready | reviewer-faq-v1; questions=6; prohibited claims=3. |
| responsible_use | ready | 6 policy rules; active restrictions=2; public leaderboard allowed=false. |
| data_statement | ready | data-statement-v1; source datasets=6; scaled items=270; pointer-only items=15. |
| version_manifest | ready | version-manifest-v1; artifacts=93; bytes=1617696. |
| novelty_finalization_preflight | ready | novelty-finalization-preflight-v1; unresolved=4; high-risk unresolved=1; final allowed=false. |
| novelty_source_review_packets | ready | novelty-source-review-packets-v1; packets=4; high-risk=1; final allowed=false. |
| novelty_claim_revision_plan | ready | novelty-claim-revision-plan-v1; revisions=4; high-risk=1; linked claims=3. |
| novelty_link_audit | ready | novelty-link-audit-v1; checked=4; quarantined=4; title mismatches=1. |
| novelty_replacement_candidates | ready | novelty-replacement-candidates-v1; candidates=6; verified=6; covered quarantined=4. |
| novelty_overlap_adjudication | ready | novelty-overlap-adjudication-v1; candidates=6; high-overlap=2; pending dispositions=6. |
| novelty_refresh_ledger | ready | novelty-refresh-ledger-v1; sources=8; high-overlap categories=6; final allowed=false. |
| novelty_and_claim_boundaries | ready | 22 related-work sources; 4 watchlist sources; 4 unresolved watchlist sources; 4 claim revisions; 4 quarantined source links; 6 replacement candidates; 6 pending overlap dispositions; 8 refreshed adjacent sources; 5 prohibited claims; refresh queries=4. |

## Threats To Validity

The generated threats-to-validity report tracks 8 paper risks and links each risk to release checks. High-severity threats remain 3; this is why the current manuscript must be framed as a working scaffold rather than a final benchmark paper.

| Threat | Type | Severity | Mitigation |
| --- | --- | --- | --- |
| construct_undercoverage | construct_validity | medium | Keep construct map, category-specific rubric dimensions, and per-category review targets in the release gate. |
| machine_seeded_label_bias | internal_validity | high | Block gold release until double review, preflight, merge, and adjudication complete. |
| small_pilot_uncertainty | statistical_conclusion_validity | high | Report uncertainty and keep category-scale claims blocked until the planned reviewed sample is complete. |
| source_corpus_bias | external_validity | medium | Describe the benchmark as a controlled failure-mode suite rather than a universal research QA sample. |
| license_and_text_packaging | artifact_validity | medium | Use pointer-only packaging, hashes, replacement candidates, and explicit source-license reporting. |
| baseline_overfitting_and_prompt_variance | evaluation_validity | medium | Keep prompt packets, scored reports, and non-oracle local baselines reproducible; require at least two external baselines before paper claims. |
| novelty_overclaiming | novelty_validity | high | Claim novelty only for the unified hard-grounded failure taxonomy after a final literature refresh. |
| item_quality_and_review_burden | measurement_validity | medium | Carry quality findings into workbooks and keep repair queues visible before gold promotion. |

## External Model Baselines

Eligible external model baselines currently recorded by the model-run index: anthropic-grounded-baseline-v1, openai-grounded-baseline-v1.

The generated submission contract `submission-contract-v1` defines 5 required answer fields and 5 validation rules for external model outputs. It keeps pilot scoring separate from future reviewed gold scoring and disallows public leaderboard use while responsible-use gates remain closed.

The generated scoring contract `scoring-contract-v1` defines 8 metric formulas and 6 validation rules. The metric surface explicitly separates citation faithfulness, conclusion support, and abstention quality so a citation that supports a premise does not automatically support the answer conclusion.

The generated model reporting card `model-reporting-card-v1` records 7 reported systems, 2 eligible model baselines, 11 required reporting fields, and 5 reporting rules. It requires prompt-packet provenance and contract-version disclosure, and it keeps pilot model results diagnostic rather than leaderboard claims while 7 release blockers remain.

| Run | Manifest | Tasks | Answer | Scored report |
| --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | run_manifest | 30 | 0.3667 | yes |
| openai-grounded-baseline-v1 | run_manifest | 30 | 0.4000 | yes |

## Review Execution Readiness

These checks prove the mechanics around review handoff, import, merge, and gold-shape promotion. They do not substitute for real human review.

- Annotation export ready: true (160 rows across 40 files)
- Reviewer calibration ready: true (10 sentinels; gold promotion allowed=false)
- Annotation quality-control ready: true (1092 governed review rows; completion claim allowed=false)
- Annotation import smoke ready: true (160 fixture rows, findings=0)
- Annotation import path ready: true (160/160 rows importable; applied=false)
- Release-gate annotation import check: yes (160/160 importable returned rows; files=40/40; fixture_allowed=true; applied=false)
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
| review_assignment_audit_ready | yes | review-assignment-audit-v1; assignments=22; double_review=22; blocked=0 |
| reviewer_handoff_ready | yes | 160 handoff rows across 40 files; gates=6/6 |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |
| review_execution_plan_ready | yes | review-execution-plan-v1; rows_remaining=600; reviewer_hours=74.4; blocking_review_checks=6 |
| review_packet_audit_ready | yes | review-packet-audit-v1; files=40; rows=160; findings=0 |
| review_return_contract_ready | yes | review-return-contract-v1; files=40; rows=160; findings=0 |
| review_return_preflight_ready | yes | review-return-preflight-v1; present=0/40; missing=40; latest_import_ready=true |
| review_return_checklist_ready | yes | review-return-checklist-v1; packets=40; rows=160; missing=40 |
| review_collection_tracker_ready | yes | review-collection-tracker-v1; packets=40; missing=40; returned=0 |
| review_wave_schedule_ready | yes | review-wave-schedule-v1; waves=2; packets=40; missing=40 |
| review_dropoff_manifest_ready | yes | review-dropoff-manifest-v1; packets=40; hashes=40; rows=160 |
| review_intake_validator_ready | yes | review-intake-validator-v1; packets=40; accepted=0; blocked=40 |
| gold_adjudication_plan_ready | yes | gold-adjudication-plan-v1; items=30; missing_reviews=60; promotion_ready=0 |
| scale_adjudication_plan_ready | yes | scale-adjudication-plan-v1; batches=30; missing_review_rows=540; merge_ready=0 |
| scale_gap_ledger_ready | yes | scale-gap-ledger-v1; deficit=300; planned_candidates=270; planned_review_rows=540 |
| adjudication_readiness_ready | yes | pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false |
| annotator_agreement_ready | yes | completed_metric_pairs=0; agreement_claim_allowed=false |
| annotation_export_ready | yes | 160 exported rows across 40 files; pilot=60; expansion=100 |
| annotation_return_readiness_ready | yes | 40 expected returned files; 160 expected returned rows |
| annotation_import_smoke_ready | yes | 160 returned fixture rows checked across 40 files; findings=0 |
| annotation_import_path_ready | yes | 160/160 importable returned rows; files=40/40; fixture_allowed=true; applied=false |
| review_calibration_ready | yes | 10 calibration sentinels; minimum_accuracy=0.9; gold_promotion_allowed=false |
| annotation_quality_control_ready | yes | 1092 review rows governed; calibration_sentinels=10; completion_claim_allowed=false |
| gold_promotion_smoke_ready | yes | 30/30 fixture gold items; release_eligible=false |
| expansion_promotion_smoke_ready | yes | 270/270 fixture expansion items merge-ready; release_eligible=false |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items |
| review_merge_ready | no | 0/30 merge-ready items |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed |
| power_plan_ready | yes | 30 reviewed items/category; 300 total target; remaining=300 |
| unknown_license_resolved | yes | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true |
| license_impact_clear | yes | 135/270 expansion candidates depend on unknown-license sources; 54 replaced; 81 pointer-only; packaged clearance=true |
| license_remediation_plan_present | yes | 54 replacement-path candidates; 81 pointer-only candidates |
| license_remediated_expansion_candidates_present | yes | 54/54 replacement-path candidates materialized |
| public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |
| public_package_integrity_ready | yes | public-package-integrity-v1; suites=2; items=300; findings=0; pointer_text_leaks=0 |
| public_package_schema_ready | yes | public-package-schema-v1; suites=2; items=300; evidence_units=996; schema_violations=0 |
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |
| scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |
| repair_queue_clear | yes | 0 repair-before-gold items |
| frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |
| baseline_uncertainty_present | yes | 5 systems with descriptive task-level intervals |
| failure_atlas_ready | yes | 116 failure cases; 8 failure modes; systems=5 |
| hypothesis_test_matrix_ready | yes | hypothesis-test-matrix-v1; hypotheses=10; observed_signature_categories=10; reviewed_deficit=300 |
| result_interpretation_guide_ready | yes | result-interpretation-guide-v1; rules=30; target_n=300; blocked_gates=4 |
| evidence_sufficiency_audit_ready | yes | evidence-sufficiency-audit-v1; items=30; evidence_contracts=30; insufficiency=3; overreach=3 |
| estimand_registry_ready | yes | estimand-registry-v1; estimands=10; target_n=300; blocked_gates=4 |
| sensitivity_analysis_plan_ready | yes | sensitivity-analysis-plan-v1; checks=6; metrics=6; blocked_gates=4 |
| lookup_contrast_registry_ready | yes | lookup-contrast-registry-v1; categories=10; lookup_controls=10; estimand_links=10 |
| statistical_reporting_template_ready | yes | statistical-reporting-template-v1; categories=10; table_sections=4; blocked_gates=4 |
| control_ablation_plan_ready | yes | control-ablation-plan-v1; categories=10; negative_controls=10; ablations=30 |
| error_codebook_ready | yes | error-codebook-v1; codes=8; categories=10; observed_cases=116 |
| paper_tables_ready | yes | 6 paper tables; systems=5; blockers=7 |
| analysis_plan_ready | yes | 4 hypotheses; 4 model families; reviewed=0/300 |
| paper_claim_ledger_ready | yes | 8 claims; allowed=3; diagnostic=2; prohibited=3 |
| supplement_index_ready | yes | supplement-index-v2; sections=6; tables=6; claims=8 |
| reproduction_capsule_ready | yes | reproduction-capsule-v1; commands=60; hashes=93; blockers=7 |
| citation_metadata_ready | yes | citation-metadata-v1; artifact_hashes=93; caveats=6; release_blockers=7 |
| reviewer_faq_ready | yes | reviewer-faq-v1; questions=6; blockers=7; prohibited_claims=3 |
| responsible_use_ready | yes | 6 policy rules; active_restrictions=2; public_leaderboard_allowed=false |
| data_statement_ready | yes | data-statement-v1; source_datasets=6; scaled_items=270; pointer_only_items=15 |
| model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |
| model_reporting_card_ready | yes | model-reporting-card-v1; systems=7; eligible=2; leaderboard_allowed=false |
| submission_contract_ready | yes | submission-contract-v1; pilot_tasks=30; leaderboard_allowed=false |
| scoring_contract_ready | yes | scoring-contract-v1; metrics=8; required=6/6; leaderboard_allowed=false |
| novelty_audit_final | no | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 |
| novelty_refresh_ledger_ready | yes | 4 refresh queries; 10 related sources; completion_claim_allowed=false |
| novelty_evidence_registry_present | yes | 22 related-work sources registered; completion_claim_allowed=false |
| novelty_claim_boundaries_ready | yes | 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims |
| novelty_watchlist_ready | yes | novelty-watchlist-v1; sources=4; high_risk=1; completion_claim_allowed=false |
| novelty_resolution_matrix_ready | yes | novelty-resolution-matrix-v1; sources=4; unresolved=4; high_risk=1 |
| novelty_finalization_preflight_ready | yes | novelty-finalization-preflight-v1; unresolved=4; high_risk_unresolved=1; final_allowed=false |
| novelty_source_review_packets_ready | yes | novelty-source-review-packets-v1; packets=4; high_risk=1; final_allowed=false |
| novelty_claim_revision_plan_ready | yes | novelty-claim-revision-plan-v1; revisions=4; high_risk=1; linked_claims=3 |
| novelty_link_audit_ready | yes | novelty-link-audit-v1; checked=4; quarantined=4; title_mismatches=1 |
| novelty_replacement_candidates_ready | yes | novelty-replacement-candidates-v1; candidates=6; verified=6; covered_quarantined=4 |
| novelty_overlap_adjudication_ready | yes | novelty-overlap-adjudication-v1; candidates=6; high_overlap=2; pending=6 |
| novelty_refresh_ledger_ready | yes | novelty-refresh-ledger-v1; sources=8; high_overlap_categories=6; final_allowed=false |
| corpus_audit_ready | yes | 6 source datasets; 270 scaled public items; 891 scaled evidence units; pointer_only=108 |
| source_diversity_plan_ready | yes | 15/300 target source rows; deficit=246 |
| source_acquisition_manifest_ready | yes | 17 batches; target_rows=246; known_license_rows=174 |
| source_acquisition_packets_ready | yes | 17 packets; target_rows=246 |
| source_acquisition_audit_ready | yes | 246/246 packet rows audited; findings=0 |
| source_acquisition_fetch_report_ready | yes | 246/246 rows fetched; findings=0; full_ready=true |
| source_acquisition_fetch_full_ready | yes | 246/246 distinct fetched source rows; known_license=174; pointer_only=72 |
| source_acquisition_candidates_ready | yes | 246 candidates; categories=10; required_review_rows=492 |
| source_acquisition_review_workbooks_ready | yes | 20 workbooks; 492 review rows; pointer_only_rows=144 |
| source_acquisition_review_preflight_report_ready | yes | 0/492 review rows complete; preflight_ready=false |
| source_lineage_ledger_ready | yes | source-lineage-ledger-v1; rows=276; datasets=6/6; source_rows=261 |
| construct_map_ready | yes | 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5 |
| difficulty_mechanism_ledger_ready | yes | difficulty-mechanism-ledger-v1; mechanisms=20; failure_cases=116; reviewed_deficit=300; blocked_claim_categories=10 |
| artifact_checklist_ready | yes | 62/62 artifact classes ready; reproduction_commands=60; release_blockers=7 |
| version_manifest_ready | yes | version-manifest-v1; artifacts=93; blockers=7; bytes=1617696 |
| threats_validity_ready | yes | 8 threats tracked; high_severity=3; completion_claim_allowed=false |

## Novelty Position

The novelty audit currently rejects broad claims such as "a RAG benchmark with citations" or "a contradiction benchmark." The defensible novelty position is the combined failure-mode bundle: document lifecycle, source authority, temporal validity, table/text interpretation, citation-overreach, insufficiency, disambiguation, and contradiction inside one executable grounded research QA harness. The current novelty evidence registry contains 22 sources and still disallows completion claims.

| Claim | Status | Reason |
| --- | --- | --- |
| Generic RAG benchmark | not_novel | Adjacent RAG and long-context benchmarks are abundant. |
| Temporal QA benchmark | not_novel_alone | ChronoQA already targets temporal-sensitive RAG. |
| Citation faithfulness benchmark | not_novel_alone | LongCite and related citation benchmarks cover attribution quality. |
| Unified hard-grounded research failure taxonomy | plausibly_differentiated_pending_final_audit | The combined bundle of lifecycle changes, authority hierarchy, stale/current snapshots, conclusion-overreach, insufficiency, disambiguation, and contradiction remains the defensible contribution if supported by reviewed data. |
| A paper-ready benchmark with reliable labels | not_yet_supported | Human review, adjudication, category scale, and final novelty checks are still release blockers. |

The June 2026 scan records 6 search-query probes and 5 prohibited or unsupported claim framings. The refreshed novelty audit adds 4 current refresh probes over 10 adjacent sources while keeping completion claims blocked. The working paper must use the allowed claim boundary below, not the broader rejected framings.

The live-search novelty watchlist adds 4 sources, including 1 high-risk sources, that must be resolved before the novelty audit can become final. This watchlist is a final-audit input, not a novelty claim.

The generated novelty resolution matrix maps 4 watchlist sources to claim impacts, with 4 unresolved sources and 1 high-risk sources still requiring final adjudication. This matrix is the working related-work checklist for the final June 2026 audit.

The generated novelty finalization preflight keeps the final audit operational rather than rhetorical: it records 4 unresolved watchlist sources, 1 high-risk unresolved sources, and 6 review or scale blockers that must clear before any final novelty or completion claim.

The generated novelty source review packets turn those unresolved sources into 4 related-work adjudication tasks, including 1 high-risk task, each requiring overlap assessment, citation action, evidence-registry action, and final disposition.

The generated novelty claim revision plan maps the unresolved packets to 4 manuscript revision actions across 3 linked claims, with required boundary language and dispositions before any final novelty claim can be made.

The generated novelty link audit currently quarantines 4/4 unresolved related-work links because the recorded URL is missing, mismatched, or not verified as a primary source. These quarantines must be cleared before the related-work review can support a final novelty claim.

The generated novelty replacement-candidate report supplies 6 primary-source candidates for those quarantined links, including 6 verified title matches and 0 source that remains explicitly caveated before citation.

The generated novelty overlap adjudication worksheet converts those verified sources into 6 review rows, with 2 high-overlap candidates and 6 pending dispositions that must be resolved before final novelty can be claimed.

The generated novelty refresh ledger adds 8 newly refreshed adjacent sources from the June 26, 2026 live-search pass and marks 6 high-overlap category risks. The paper must cite, rule out, or narrow claims around those sources before the preliminary novelty audit can become final.

| Paper claim | Status | Reason |
| --- | --- | --- |
| We introduce a generic RAG benchmark. | prohibited / not yet supported | Too broad and already covered by many RAG, long-context, and domain QA benchmarks. |
| We introduce a multi-hop RAG benchmark. | prohibited / not yet supported | Multi-hop RAG is already directly benchmarked; this can only be a component category. |
| We introduce a temporal RAG benchmark. | prohibited / not yet supported | Temporal RAG and temporal QA already have dedicated benchmarks. |
| We introduce citation faithfulness evaluation. | prohibited / not yet supported | Citation and context faithfulness are already benchmarked; our narrower claim must be conclusion-support overreach. |
| We benchmark a unified taxonomy of hard grounded research QA failures beyond fact lookup. | allowed with evidence | This is the defensible claim if the paper shows reviewed items spanning lifecycle, authority, stale/current, conclusion-overreach, insufficiency, entity ambiguity, table/text, multi-hop, temporal, and contradiction categories. |
| The benchmark is paper-ready and genuinely novel as of June 2026. | prohibited / not yet supported | This requires completed human review, category scale, and a final refreshed novelty audit. |

## Adversarial Related-Work Comparison

| Dimension | Closest source ids | Position to defend |
| --- | --- | --- |
| Context length or corpus realism | corpusqa-2026<br>longbench-pro-2026<br>enterprise-rag-bench-2026 | Not novel alone; use these sources to avoid overclaiming scale and to motivate controlled failure categories inside large-corpus research QA. |
| Temporal validity | chronoqa-2025<br>tdbench-2025<br>temprageval-2025<br>knowledge-drift-2025 | Not novel alone; hard-grounded research should focus on as-of-date citation semantics, stale/current document conflict, and visible evidence-state changes. |
| Citation faithfulness | longcite-2024<br>step-context-faithfulness-2026<br>ragbench-leaderboard-2025<br>faitheval-2024 | Not novel alone; the benchmark must test whether citations support the final conclusion, not merely whether cited spans are relevant to local facts. |
| Source authority and claim-level evidence | citation-closure-2026<br>legal-claim-rag-2026<br>decaf-2025 | Partly covered elsewhere; the defensible angle is combining authority conflicts with lifecycle, temporal, insufficiency, and contradiction tasks under one annotation protocol. |
| Entity ambiguity | entitymatch-2025<br>occ-rag-2026 | Not novel as a standalone phenomenon; include it because large-corpus research QA frequently fails by citing the right-looking source for the wrong entity. |

## Required Before Submission

1. Scale from 30 pilot items to at least 30-50 double-reviewed items per category.
2. Complete independent double review and adjudicate disagreements until gold promotion succeeds.
3. Run at least two frontier or open model baselines over the same scoring source.
4. Refresh the June 2026 novelty audit with paper citations immediately before any completion claim.
5. Convert this scaffold into a full manuscript with related work, annotation protocol, limitations, and statistical uncertainty.
