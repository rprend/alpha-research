# Hard Grounded Research Error Codebook

This generated codebook defines qualitative error codes for pilot and future gold analysis. It is diagnostic until human review, category scale, and final novelty gates pass.

## Summary

- Error codebook ready: true
- Version: error-codebook-v1
- Error codes: 8
- Categories covered: 10
- Observed pilot failure cases: 116
- Completion claim allowed: false
- Qualitative claims allowed now: pilot-diagnostic only

## Error Codes

| Code | Label | Observed Cases | Include When | Exclude When |
| --- | --- | --- | --- | --- |
| missing_required_evidence | Missing required evidence | 95 | The answer omits at least one evidence unit needed to support the final conclusion, bridge hop, table interpretation, authority rule, or temporal scope. | Do not use this code for extra unsupported citations when all required evidence is already present; use citation_not_faithful_to_answer. |
| citation_does_not_support_conclusion | Citation supports fact but not conclusion | 93 | The citation supports a premise, entity mention, or table cell but does not license the answer conclusion or comparison being made. | If the citation is irrelevant to both the premise and conclusion, use citation_not_faithful_to_answer. |
| citation_not_faithful_to_answer | Citation not faithful to answer | 86 | A cited evidence unit does not directly support the answer sentence attached to it, even if the evidence is true or topically related. | If the cited evidence supports the sentence but not the final inference, use citation_does_not_support_conclusion. |
| wrong_answer | Wrong final answer | 86 | The final answer contradicts reviewed task labels, gives a value outside the valid answer set, or answers a different entity/date/scope. | Use a citation or evidence code instead when the answer is correct but the cited support is incomplete or misattached. |
| bad_abstention_or_conflict_behavior | Bad abstention or conflict behavior | 50 | The system answers when evidence is insufficient, abstains when evidence is sufficient, or fails to name unresolved conflict as the reason for refusing. | Do not apply only because the wording is cautious; the decision must be wrong under the insufficiency or conflict label. |
| contradiction_resolution_failure | Contradiction resolution failure | 12 | The answer blends conflicting documents, averages incompatible claims, or fails to identify a contradiction that controls the task. | Use source authority or temporal scope codes when the apparent contradiction is resolved by an explicit source ranking or as-of date. |
| authority_resolution_failure | Authority resolution failure | 10 | The answer chooses lower-authority evidence, fails to state the authority rule, or treats equally topical sources as equally authoritative when the task defines a ranking. | Use temporal_scope_failure when the controlling distinction is document date rather than source authority. |
| temporal_scope_failure | Temporal scope failure | 10 | The answer uses evidence outside the requested as-of date, treats stale evidence as current, or ignores lifecycle/appended-document boundaries. | Use contradiction_resolution_failure if the central failure is unresolved conflict without a time boundary. |

## Category Guidance

| Category | Rubric Dimensions | Expected Error Codes |
| --- | --- | --- |
| multi-hop synthesis | hop_coverage, bridge_entity_resolution, minimal_citation_set | missing_required_evidence, citation_not_faithful_to_answer, wrong_answer |
| stale-vs-current document conflicts | document_date_identification, stale_evidence_rejection, current_state_grounding | missing_required_evidence, citation_does_not_support_conclusion, temporal_scope_failure |
| appended document lifecycle changes | section_provenance, supersession_detection, original_vs_appended_scope | missing_required_evidence, citation_does_not_support_conclusion, temporal_scope_failure |
| table + text reasoning | table_denotation, calculation_trace, textual_interpretation_support | missing_required_evidence, citation_not_faithful_to_answer, wrong_answer |
| source authority conflicts | source_type_identification, authority_ranking, conflict_resolution | missing_required_evidence, citation_does_not_support_conclusion, authority_resolution_failure |
| evidence insufficiency / abstention | missing_evidence_identification, abstention_precision, non_hallucination | missing_required_evidence, wrong_answer, bad_abstention_or_conflict_behavior |
| citation supports fact but not conclusion | sentence_level_support, premise_conclusion_separation, unsupported_inference_detection | missing_required_evidence, citation_does_not_support_conclusion, citation_not_faithful_to_answer |
| entity disambiguation | entity_identity_match, alias_resolution, distractor_rejection | missing_required_evidence, citation_not_faithful_to_answer, wrong_answer |
| temporal questions: as of date X | as_of_filtering, future_evidence_exclusion, date_qualified_answer | missing_required_evidence, citation_does_not_support_conclusion, temporal_scope_failure |
| cross-document contradiction | contradiction_detection, evidence_partitioning, uncertainty_calibration | missing_required_evidence, citation_does_not_support_conclusion, contradiction_resolution_failure |

## Reviewer Rules

| # | Rule |
| --- | --- |
| 1 | Assign all codes that apply; codes are not mutually exclusive. |
| 2 | Code answer correctness before coding evidence behavior. |
| 3 | Use citation_not_faithful_to_answer for sentence-level unsupported citations. |
| 4 | Use citation_does_not_support_conclusion when evidence supports a true premise but not the final conclusion. |
| 5 | Record abstention behavior from answer, abstained, and evidence_assessment fields together. |
| 6 | Escalate disagreements to adjudication when reviewers differ on any primary error code. |
