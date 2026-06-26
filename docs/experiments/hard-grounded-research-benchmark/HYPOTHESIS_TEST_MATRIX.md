# Hard Grounded Research Hypothesis Test Matrix

This generated matrix turns the benchmark's difficulty mechanisms into testable empirical predictions. It is a paper-planning artifact: current rows are diagnostic because human review, category scale, and final novelty gates are still blocked.

## Summary

- Matrix ready: true
- Version: hypothesis-test-matrix-v1
- Categories: 10
- Hypotheses: 10
- Categories with observed expected failure modes: 10
- Observed failure cases: 116
- Reviewed item deficit: 300
- Diagnostic-only categories: 10
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_testable_hypotheses | true | 10/10 categories mapped to hypotheses and metrics |
| baseline_results_linked | true | 5 baseline systems; minimum category systems=2 |
| failure_signatures_partly_observed | true | 10/10 categories show at least one expected failure signature in pilot failure atlas |
| statistical_claims_blocked | true | 4/4 claim gates still blocked |

## Hypothesis Rows

| Category | Hypothesis | Primary metrics | Expected failure signature | Observed expected modes | Pilot metric ranges | Claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | Models will retrieve individually relevant hops but lose answer correctness or conclusion support when the final answer requires evidence composition. | answer_correct<br>evidence_recall<br>conclusion_support | missing_evidence<br>unsupported_conclusion | missing_evidence<br>unsupported_conclusion | answer_correct: 0.000-0.000<br>evidence_recall: 0.667-0.667<br>conclusion_support: 0.500-0.500 | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | Models will overuse plausible stale evidence unless the scoring source forces recency-conditioned citation and answer selection. | answer_correct<br>citation_faithfulness<br>conclusion_support | stale_evidence_used<br>temporal_scope_error | stale_evidence_used<br>temporal_scope_error | answer_correct: 0.000-0.000<br>citation_faithfulness: 0.000-0.500<br>conclusion_support: 0.000-0.500 | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | Models will treat appended or corrective text as additive context instead of a document-state transition that can supersede earlier content. | answer_correct<br>evidence_recall<br>conclusion_support | lifecycle_state_missed<br>unsupported_conclusion | lifecycle_state_missed<br>unsupported_conclusion | answer_correct: 0.000-1.000<br>evidence_recall: 0.500-1.000<br>conclusion_support: 0.500-1.000 | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | Models will cite the correct table cell while failing the prose qualifier or interpretation required to make the answer grounded. | answer_correct<br>citation_precision<br>conclusion_support | table_text_join_error<br>unsupported_conclusion | table_text_join_error<br>unsupported_conclusion | answer_correct: 0.000-0.000<br>citation_precision: n/a<br>conclusion_support: 0.000-0.500 | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | Models will synthesize lower- and higher-authority sources unless the task requires an explicit authority hierarchy. | answer_correct<br>citation_faithfulness<br>abstention_quality | authority_resolution_error<br>contradiction_missed | authority_resolution_error<br>contradiction_missed | answer_correct: 0.000-0.000<br>citation_faithfulness: 0.000-0.500<br>abstention_quality: 0.000-0.333 | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | Models will answer from near-miss evidence instead of abstaining when relevance is present but sufficiency is absent. | abstention_quality<br>conclusion_support<br>citation_faithfulness | abstention_error<br>unsupported_conclusion | abstention_error<br>unsupported_conclusion | abstention_quality: 0.000-1.000<br>conclusion_support: 0.000-1.000<br>citation_faithfulness: 0.000-1.000 | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | Models will cite true premises and still make unsupported comparative, causal, or interpretive conclusions. | conclusion_support<br>citation_faithfulness<br>answer_correct | citation_overreach<br>unsupported_conclusion | citation_overreach<br>unsupported_conclusion | conclusion_support: 0.000-1.000<br>citation_faithfulness: 0.500-1.000<br>answer_correct: 0.000-1.000 | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | Models will retrieve or cite same-name evidence while answering about the wrong referent. | answer_correct<br>evidence_recall<br>citation_precision | entity_binding_error<br>wrong_evidence | entity_binding_error<br>wrong_evidence | answer_correct: 0.000-1.000<br>evidence_recall: 0.500-1.000<br>citation_precision: n/a | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | Models will answer using globally current or generally true evidence rather than the requested as-of date. | answer_correct<br>citation_faithfulness<br>abstention_quality | temporal_scope_error<br>stale_evidence_used | temporal_scope_error<br>stale_evidence_used | answer_correct: 0.000-0.000<br>citation_faithfulness: 0.000-0.500<br>abstention_quality: 0.000-0.000 | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | Models will merge incompatible documents into a single unsupported answer instead of reporting conflict or applying a control rule. | abstention_quality<br>conclusion_support<br>citation_faithfulness | contradiction_missed<br>unsupported_conclusion | contradiction_missed<br>unsupported_conclusion | abstention_quality: 0.000-1.000<br>conclusion_support: 0.000-1.000<br>citation_faithfulness: 0.000-1.000 | diagnostic_only_until_review_scale_and_novelty_clear |

## Claim Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| gold_review_complete | false | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| category_scale_ready | false | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| review_merge_ready | false | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
