# Hard Grounded Research Annotation Protocol

This generated protocol defines how pilot and expansion review workbooks should be completed. It is an instruction artifact, not completed review data.

## Summary

- Protocol version: 0.1.0
- Pilot workbooks: 20
- Pilot review rows: 60
- Expansion workbooks: 60
- Expansion review rows: 540
- Independent reviews per item: 2
- Annotation protocol ready: true

## Required Reviewer Fields

- `final_label`
- `final_answer`
- `required_citation_ids`
- `insufficient_or_conflicting_evidence`
- `notes`
- `reviewer_confidence`

Expansion candidate reviews additionally require:

- `category_fit`
- `generation_defect`

## Final Labels

| Label | Use when | Citation rule |
| --- | --- | --- |
| SUPPORTED | The supplied evidence directly supports the final answer and required conclusion. | At least one required citation id is required; cite every evidence unit needed for the conclusion. |
| REFUTED | The supplied evidence directly contradicts the candidate answer or claim. | At least one required citation id is required; cite the refuting evidence. |
| INSUFFICIENT | The supplied evidence may be relevant but does not establish the requested answer or conclusion. | Do not provide required citation ids; set insufficient_or_conflicting_evidence=true. |
| CONFLICT | Supplied documents conflict and the task does not provide a controlling source, date, or authority. | Cite the conflicting evidence ids and set insufficient_or_conflicting_evidence=true. |
| INVALID_ITEM | The benchmark item is malformed, impossible to review, off-category, or has unusable evidence. | Do not provide required citation ids unless the defect itself depends on specific evidence. |

## Expansion Category Fit

| Value | Meaning |
| --- | --- |
| IN_CATEGORY | The item tests the intended hard-grounded category. |
| WRONG_CATEGORY | The item primarily tests a different category. |
| AMBIGUOUS_CATEGORY | The item plausibly spans categories and needs adjudicator review. |

## Expansion Generation Defects

| Value | Meaning |
| --- | --- |
| NONE | No machine-generation defect is visible. |
| BAD_SOURCE_ROW | The source row is mismatched, unusable, or not the claimed provenance. |
| BAD_EVIDENCE | Evidence units are missing, irrelevant, malformed, or insufficient for the item. |
| BAD_QUESTION | The question is unclear, unanswerable for the wrong reason, or not grounded. |
| BAD_EXPECTED_ANSWER | The expected answer is wrong or not supported by the evidence. |
| DUPLICATE | The candidate duplicates another item too closely. |
| OTHER | A defect exists but is not covered by the other codes; explain in notes. |

## Category Rubrics

| Category | Required dimensions | Strong answer | Near miss | Hard negative |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | hop_coverage<br>bridge_entity_resolution<br>minimal_citation_set | The answer states the conclusion, cites every required hop, and explains how the hops connect. | The answer is factually correct but cites only one hop or uses a distractor page as if it were required. | A topically related source supports one premise but not the bridge inference. |
| stale-vs-current document conflicts | document_date_identification<br>stale_evidence_rejection<br>current_state_grounding | The answer marks stale claims, uses current evidence for the final conclusion, and cites dates or version markers. | The answer mentions both sources but blends stale and current facts into one statement. | Older evidence is true for its time but false or superseded for the requested state. |
| appended document lifecycle changes | section_provenance<br>supersession_detection<br>original_vs_appended_scope | The answer identifies which section controls the conclusion and whether earlier text is superseded or merely supplemented. | The answer cites appended text but does not explain how it changes the original body. | Original-body evidence supports a conclusion that the appended material qualifies or reverses. |
| table + text reasoning | table_denotation<br>calculation_trace<br>textual_interpretation_support | The answer computes or selects the correct table value and separately cites text that supports the interpretation of the column or row. | The answer extracts the right cell but makes an unsupported trend, causal, or comparative claim. | A table cell is numerically correct but cannot support the narrative conclusion. |
| source authority conflicts | source_type_identification<br>authority_ranking<br>conflict_resolution | The answer names the conflict, ranks source authority, and bases the final conclusion on the highest-authority applicable source. | The answer picks the clearest or most recent prose without explaining authority. | A lower-authority source states a plausible answer that conflicts with a primary or expert source. |
| evidence insufficiency / abstention | missing_evidence_identification<br>abstention_precision<br>non_hallucination | The answer abstains, cites the insufficiency, and names the specific missing evidence needed to answer. | The answer gives a hedged guess instead of an explicit abstention. | Available evidence supports related facts but not the requested conclusion. |
| citation supports fact but not conclusion | sentence_level_support<br>premise_conclusion_separation<br>unsupported_inference_detection | Every conclusion sentence has direct support, and unsupported causal/comparative claims are removed or marked unproven. | The answer cites a true premise and then adds a conclusion not entailed by that premise. | A citation verifies a named entity, number, or event but not the interpretive conclusion drawn from it. |
| entity disambiguation | entity_identity_match<br>alias_resolution<br>distractor_rejection | The answer identifies the intended entity and rejects confusing same-name or near-name evidence. | The answer uses facts from two entities with similar names. | A distractor entity shares a name, title, place, abbreviation, or table row context. |
| temporal questions: as of date X | as_of_filtering<br>future_evidence_exclusion<br>date_qualified_answer | The answer states the as-of date, excludes later evidence, and qualifies the conclusion by temporal scope. | The answer is currently true but was not knowable or valid as of the requested date. | Later evidence makes the answer easier but is invalid for the question date. |
| cross-document contradiction | contradiction_detection<br>evidence_partitioning<br>uncertainty_calibration | The answer partitions supporting and refuting evidence and either resolves the contradiction with authority/recency rules or reports CONFLICT. | The answer averages or synthesizes incompatible claims into an unsupported compromise. | Each document is internally plausible but cross-document comparison reveals incompatibility. |

## Adjudication Rules

- Two independent complete reviews are required before merge.
- Exact agreement promotes an item to merge-ready if validation checks pass.
- Any disagreement in final_label, final_answer, required_citation_ids, or insufficiency/conflict flag requires adjudication.
- Expansion candidates cannot be promoted to paper-scale gold until expansion review preflight and merge both pass.
- INVALID_ITEM rows must be repaired, replaced, or explicitly excluded before final gold release.
