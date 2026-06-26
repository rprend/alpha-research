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

The generated source-diversity plan sets a paper target of 30 distinct source rows per category (300 total). Current scaled artifacts cover 15 distinct source rows, leaving a 246-row deficit before large-corpus category claims are defensible.

The source acquisition manifest converts this into 17 Hugging Face sampling batches for 246 new distinct source rows, with 174 known-license rows preferred before 72 pointer-only rows.

The source acquisition packets materialize 17 JSONL queues with 246 target row slots. These packets define the next executable acquisition step, but acquired rows still require deduplication, task materialization, double review, and gold promotion before paper claims.

The source acquisition audit validates 246/246 packet rows with 0 findings, so packet drift is caught before acquisition starts.

The source acquisition fetch report executed those queues against the Hugging Face dataset viewer and fetched 246/246 distinct source rows with 0 findings. The current queue is now feasible as a source-row acquisition substrate, but the fetched rows still need task materialization, reviewer export, double review, and adjudication before they can support large-corpus paper claims.

The source acquisition candidate suite converts the fetched rows into 246 review-pending task drafts across 10 categories, with 492 required independent review rows. These drafts are a materialization queue, not evaluated gold.

The source acquisition review workbooks export those drafts into 20 category-level reviewer files with 492 total rows. This closes the acquisition-to-review handoff, while final paper claims remain blocked until reviewers return labels and merge/adjudication passes.

The source acquisition review preflight currently reports 0/492 completed review rows, so it is a validation target for returned packets rather than evidence of completed human annotation.

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

## Paper Claim Ledger

The generated paper claim ledger maps 8 manuscript claims to current evidence: 3 allowed, 2 diagnostic-only, and 3 prohibited until review, scale, and novelty gates pass. This ledger is the manuscript claim boundary until final human-review and June 2026 novelty gates are complete.

The generated supplement index maps 5 supplement sections, 6 paper tables, and 8 claims to source artifacts. It should be used as the reviewer-facing navigation layer for supplementary materials.

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

The generated artifact checklist records 32 reproduction commands and 29/29 ready artifact classes. It also carries the release blockers into the manuscript surface, so the paper cannot imply completion while the release gate remains `blocked`.

The generated version manifest records SHA-256 digests for 24 package-critical artifacts totaling 394978 bytes. A submitted manuscript should cite `VERSION_MANIFEST.md` and `generated/version-manifest.json` so reviewers can identify the exact benchmark state behind the tables and claims.

The generated review execution plan records 600 remaining reviewer rows and an estimated 74.4 reviewer-hours including adjudication reserve. It turns the current review blockers into 2 waves with explicit acceptance gates, but it does not count as completed review.

| Artifact class | Status | Evidence |
| --- | --- | --- |
| taxonomy_and_constructs | ready | 10/10 constructs mapped to rubrics, metrics, examples, novelty risk, and review status. |
| corpus_and_public_package | ready | 270 scaled public items; 891 evidence units; 108 pointer-only evidence units. |
| source_diversity_expansion | ready | 15/300 target source rows; deficit=246. |
| source_acquisition_manifest | ready | 17 acquisition batches; 246 target new source rows. |
| source_acquisition_packets | ready | 17 packet files; 246 acquisition row slots. |
| source_acquisition_audit | ready | 246/246 packet rows audited; findings=0. |
| source_acquisition_fetch_report | ready | 246/246 source rows fetched from Hugging Face; findings=0. |
| source_acquisition_candidates | ready | 246 fetched-row candidates; 492 required review rows. |
| source_acquisition_review_workbooks | ready | 20 workbooks; 492 source-acquisition review rows. |
| source_acquisition_review_preflight | ready | 0/492 source-acquisition review rows complete; preflight_ready=false. |
| review_calibration | ready | 10 reviewer-screening sentinels across 10 categories; minimum_accuracy=0.9. |
| annotation_quality_control | ready | 1092 review rows governed by 5 QA rules; sentinel rows in gold=false. |
| annotation_and_review_workflow | ready | 124 exported review rows; 300 reviewed target items remaining. |
| review_execution_plan | ready | review-execution-plan-v1; rows remaining=600; reviewer hours=74.4; blocking checks=6. |
| submission_contract | ready | submission-contract-v1; pilot tasks=30; required fields=5. |
| scoring_contract | ready | scoring-contract-v1; metrics=8; required metrics=6/6. |
| error_codebook | ready | error-codebook-v1; codes=8; observed pilot failures=116. |
| baselines_and_scoring | ready | 5 scored systems; 2 eligible external model baselines. |
| model_reporting_card | ready | model-reporting-card-v1; systems=7; eligible=2; required fields=11. |
| statistics_and_scale | ready | 30 target reviewed items/category; 300 reviewed items remaining. |
| paper_tables_and_figures | ready | 6 paper tables; 40 challenge rows; 8 failure modes. |
| analysis_plan | ready | 4 hypotheses; 4 model families; 7 covariates. |
| paper_claim_ledger | ready | 8 claims mapped to evidence; prohibited=3; diagnostic=2. |
| supplement_index | ready | supplement-index-v1; sections=5; tables=6; claims=8. |
| reviewer_faq | ready | reviewer-faq-v1; questions=6; prohibited claims=3. |
| responsible_use | ready | 6 policy rules; active restrictions=2; public leaderboard allowed=false. |
| data_statement | ready | data-statement-v1; source datasets=6; scaled items=270; pointer-only items=15. |
| version_manifest | ready | version-manifest-v1; artifacts=24; bytes=394978. |
| novelty_and_claim_boundaries | ready | 22 related-work sources; 1 allowed claims; 5 prohibited claims; refresh queries=4. |

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

- Annotation export ready: true (124 rows across 30 files)
- Reviewer calibration ready: true (10 sentinels; gold promotion allowed=false)
- Annotation quality-control ready: true (1092 governed review rows; completion claim allowed=false)
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
| reviewer_handoff_ready | yes | 124 handoff rows across 30 files; gates=6/6 |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |
| review_execution_plan_ready | yes | review-execution-plan-v1; rows_remaining=600; reviewer_hours=74.4; blocking_review_checks=6 |
| adjudication_readiness_ready | yes | pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false |
| annotator_agreement_ready | yes | completed_metric_pairs=0; agreement_claim_allowed=false |
| annotation_export_ready | yes | 124 exported rows across 30 files; pilot=24; expansion=100 |
| annotation_return_readiness_ready | yes | 30 expected returned files; 124 expected returned rows |
| annotation_import_smoke_ready | yes | 124 returned fixture rows checked across 30 files; findings=0 |
| annotation_import_path_ready | yes | 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false |
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
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |
| scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |
| repair_queue_clear | yes | 0 repair-before-gold items |
| frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |
| baseline_uncertainty_present | yes | 5 systems with descriptive task-level intervals |
| failure_atlas_ready | yes | 116 failure cases; 8 failure modes; systems=5 |
| error_codebook_ready | yes | error-codebook-v1; codes=8; categories=10; observed_cases=116 |
| paper_tables_ready | yes | 6 paper tables; systems=5; blockers=7 |
| analysis_plan_ready | yes | 4 hypotheses; 4 model families; reviewed=0/300 |
| paper_claim_ledger_ready | yes | 8 claims; allowed=3; diagnostic=2; prohibited=3 |
| supplement_index_ready | yes | supplement-index-v1; sections=5; tables=6; claims=8 |
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
| construct_map_ready | yes | 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5 |
| artifact_checklist_ready | yes | 29/29 artifact classes ready; reproduction_commands=32; release_blockers=7 |
| version_manifest_ready | yes | version-manifest-v1; artifacts=24; blockers=7; bytes=394978 |
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
