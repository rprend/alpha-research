# Hard Grounded Research Scoring Contract

This generated contract defines metric formulas, aggregation rules, and claim limits for scored submissions. It is intentionally stricter than the submission schema because the benchmark targets grounded research failures where a citation may support a fact but not the conclusion.

## Summary

- Scoring contract ready: true
- Version: scoring-contract-v1
- Metrics: 8
- Required metrics covered: 6/6
- Categories mapped: 10
- Public leaderboard allowed: false
- Completion claim allowed: false

## Metric Definitions

| Metric | Unit | Formula | Claim Boundary |
| --- | --- | --- | --- |
| answer_correctness | task | 1 when the final answer matches the reviewed gold answer or correctly abstains; 0 otherwise. | Diagnostic on pilot labels; publishable only on reviewed gold. |
| evidence_recall | task | required_gold_evidence_units_cited / required_gold_evidence_units; abstentions with insufficient evidence use abstention_quality instead. | Requires reviewed gold evidence-unit labels. |
| citation_precision | citation | supported_citations / submitted_citations after rejecting citations outside the task evidence set. | Requires citation-level support review before paper claims. |
| citation_faithfulness | answer_sentence | 1 only when each non-abstention answer sentence is directly supported by the cited evidence attached to it. | Separates fact support from conclusion support; not a lexical-overlap metric. |
| conclusion_support | task | 1 when cited evidence supports the final conclusion, not merely a true premise or related fact. | Primary metric for citation-supports-fact-but-not-conclusion failures. |
| conflict_handling | task | 1 when the answer names and resolves stale, contradictory, or lower-authority evidence according to the task rubric. | Report by conflict category only after category-scale review passes. |
| temporal_validity | task | 1 when cited evidence is valid for the requested as-of date or explicitly excluded as later/stale contrast. | Requires document-date and lifecycle labels. |
| abstention_quality | task | 1 when abstention is triggered by reviewed insufficiency or unresolved conflict and names the missing or conflicting evidence. | False abstentions are scored as answer errors, not cautious successes. |

## Category Metric Map

| Category | Rubric Dimensions | Primary Metrics |
| --- | --- | --- |
| multi-hop synthesis | hop_coverage, bridge_entity_resolution, minimal_citation_set | answer_correctness, evidence_recall, citation_precision |
| stale-vs-current document conflicts | document_date_identification, stale_evidence_rejection, current_state_grounding | conflict_handling, temporal_validity |
| appended document lifecycle changes | section_provenance, supersession_detection, original_vs_appended_scope | conflict_handling, temporal_validity |
| table + text reasoning | table_denotation, calculation_trace, textual_interpretation_support | answer_correctness, evidence_recall, citation_precision |
| source authority conflicts | source_type_identification, authority_ranking, conflict_resolution | conclusion_support, conflict_handling |
| evidence insufficiency / abstention | missing_evidence_identification, abstention_precision, non_hallucination | answer_correctness, abstention_quality |
| citation supports fact but not conclusion | sentence_level_support, premise_conclusion_separation, unsupported_inference_detection | citation_faithfulness, conclusion_support |
| entity disambiguation | entity_identity_match, alias_resolution, distractor_rejection | answer_correctness, evidence_recall, citation_precision |
| temporal questions: as of date X | as_of_filtering, future_evidence_exclusion, date_qualified_answer | conflict_handling, temporal_validity |
| cross-document contradiction | contradiction_detection, evidence_partitioning, uncertainty_calibration | conclusion_support, conflict_handling |

## Validation Rules

| # | Rule |
| --- | --- |
| 1 | Reject any non-abstention answer with zero citations before metric scoring. |
| 2 | Reject citations that are not task evidence-unit ids under the submission contract. |
| 3 | Score citation_faithfulness separately from answer_correctness so a true fact cannot launder an unsupported conclusion. |
| 4 | Score abstention_quality only for tasks labeled insufficient, contradictory beyond resolution, or impossible under the as-of date. |
| 5 | Macro-average by category after item-level scoring; do not publish category claims until category_scale_ready passes. |
| 6 | Do not publish leaderboard rankings while responsible-use public_leaderboard_allowed is false. |
