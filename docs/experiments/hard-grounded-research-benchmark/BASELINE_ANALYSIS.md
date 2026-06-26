# Hard Grounded Research Baseline Analysis

This report is generated from checked-in run artifacts. It is a pilot result summary, not a paper claim over gold data.

## Readiness

- Gold ready: false
- Valid reviewed items: 0/30
- Unreviewed items: 30
- OpenAI prompt packet rows: 30
- OpenAI scored report present: false
- OpenAI calibration prompt packet rows: 30
- OpenAI calibration scored report present: false

## Macro Results

| System | Tasks | Answer correct | Evidence recall | Citation precision | Citation faithfulness | Conclusion support | Abstention quality |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | 30 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9000 | 1.0000 |
| lexical-evidence-baseline-v1 | 30 | 0.2000 | 0.6979 | 1.0000 | 0.6000 | 0.5333 | 0.7000 |
| citation-aware-verifier-v1 | 30 | 0.1667 | 0.4979 | 1.0000 | 0.5833 | 0.6333 | 0.6000 |

## Lexical Baseline Weakest Categories

| Category | Answer correct | Evidence recall | Citation faithfulness | Conclusion support | Abstention quality |
| --- | --- | --- | --- | --- | --- |
| cross-document contradiction | 0.0000 | 0.3952 | 0.5000 | 0.5000 | 1.0000 |
| appended document lifecycle changes | 0.0000 | 1.0000 | 0.5000 | 0.5000 | 1.0000 |
| evidence insufficiency / abstention | 0.0000 | 1.0000 | 0.5000 | 0.5000 | 0.0000 |
| table + text reasoning | 0.0000 | 1.0000 | 0.5000 | 0.5000 | 1.0000 |
| citation supports fact but not conclusion | 0.3333 | 0.3952 | 0.6667 | 0.0000 | 1.0000 |

## Challenge-Type Diagnostics

| System | Challenge | Tasks | Answer correct | Evidence recall | Citation faithfulness | Conclusion support | Abstention quality |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | as_of_date_constraint | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | authority_conflict | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | citation_overreach_probe | 3 | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 |
| local-rule-agent-v1 | cross_document_contradiction | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | document_lifecycle_appendix | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | insufficiency_probe | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | native_row | 9 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| local-rule-agent-v1 | stale_current_conflict | 3 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| lexical-evidence-baseline-v1 | as_of_date_constraint | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 | 0.3333 |
| lexical-evidence-baseline-v1 | authority_conflict | 3 | 0.3333 | 1.0000 | 0.6667 | 0.6667 | 0.3333 |
| lexical-evidence-baseline-v1 | citation_overreach_probe | 3 | 0.3333 | 0.3952 | 0.6667 | 0.0000 | 1.0000 |
| lexical-evidence-baseline-v1 | cross_document_contradiction | 3 | 0.0000 | 0.3952 | 0.5000 | 0.5000 | 1.0000 |
| lexical-evidence-baseline-v1 | document_lifecycle_appendix | 3 | 0.0000 | 1.0000 | 0.5000 | 0.5000 | 1.0000 |
| lexical-evidence-baseline-v1 | insufficiency_probe | 3 | 0.0000 | 1.0000 | 0.5000 | 0.5000 | 0.0000 |
| lexical-evidence-baseline-v1 | native_row | 9 | 0.2222 | 0.7296 | 0.6111 | 0.6111 | 1.0000 |
| lexical-evidence-baseline-v1 | stale_current_conflict | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 | 0.3333 |
| citation-aware-verifier-v1 | as_of_date_constraint | 3 | 0.3333 | 0.2500 | 0.6667 | 0.6667 | 0.3333 |
| citation-aware-verifier-v1 | authority_conflict | 3 | 0.3333 | 0.5000 | 0.6667 | 0.6667 | 0.3333 |
| citation-aware-verifier-v1 | citation_overreach_probe | 3 | 0.0000 | 0.3952 | 0.5000 | 1.0000 | 0.0000 |
| citation-aware-verifier-v1 | cross_document_contradiction | 3 | 0.0000 | 0.3952 | 0.5000 | 0.5000 | 1.0000 |
| citation-aware-verifier-v1 | document_lifecycle_appendix | 3 | 0.0000 | 0.5000 | 0.5000 | 0.5000 | 1.0000 |
| citation-aware-verifier-v1 | insufficiency_probe | 3 | 0.0000 | 0.5000 | 0.5000 | 0.5000 | 0.0000 |
| citation-aware-verifier-v1 | native_row | 9 | 0.2222 | 0.7296 | 0.6111 | 0.6111 | 1.0000 |
| citation-aware-verifier-v1 | stale_current_conflict | 3 | 0.3333 | 0.2500 | 0.6667 | 0.6667 | 0.3333 |

## Lexical Failure Taxonomy

| Category | Failures | Failure rate | Reason counts |
| --- | --- | --- | --- |
| multi-hop synthesis | 3/3 | 1.0000 | wrong_answer:2<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:2<br>missing_required_evidence:2 |
| stale-vs-current document conflicts | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:2<br>bad_abstention_behavior:2 |
| appended document lifecycle changes | 3/3 | 1.0000 | wrong_answer:3<br>unfaithful_or_overbroad_citation:3<br>unsupported_conclusion:3 |
| table + text reasoning | 3/3 | 1.0000 | wrong_answer:3<br>unfaithful_or_overbroad_citation:3<br>unsupported_conclusion:3 |
| evidence insufficiency / abstention | 3/3 | 1.0000 | wrong_answer:3<br>unfaithful_or_overbroad_citation:3<br>unsupported_conclusion:3<br>bad_abstention_behavior:3 |
| citation supports fact but not conclusion | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:3 |
| entity disambiguation | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:2 |
| temporal questions: as of date X | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:2<br>bad_abstention_behavior:2 |
| cross-document contradiction | 3/3 | 1.0000 | wrong_answer:3<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:3<br>unsupported_conclusion:3 |
| source authority conflicts | 2/3 | 0.6667 | wrong_answer:2<br>unfaithful_or_overbroad_citation:2<br>unsupported_conclusion:2<br>bad_abstention_behavior:2 |

## Representative Lexical Failures

### hgr_multi_hop_001_pilot_001

- Category: multi-hop synthesis
- Challenge: native_row
- Reasons: wrong_answer, unfaithful_or_overbroad_citation, unsupported_conclusion
- Expected: yes
- Submitted: Scott Derrickson (born July 16, 1966) is an American director, screenwriter and producer.
- Missing required citations: none

### hgr_stale_current_001_pilot_001

- Category: stale-vs-current document conflicts
- Challenge: stale_current_conflict
- Reasons: wrong_answer, missing_required_evidence, unfaithful_or_overbroad_citation, unsupported_conclusion, bad_abstention_behavior
- Expected: SUPPORTS
- Submitted: ABSTAIN
- Missing required citations: 5a8b57f25542995d1e6f1371:support:1

### hgr_appendix_lifecycle_001_pilot_001

- Category: appended document lifecycle changes
- Challenge: document_lifecycle_appendix
- Reasons: wrong_answer, unfaithful_or_overbroad_citation, unsupported_conclusion
- Expected: BIBREF19
- Submitted: Appendix Z, dated 2018-06-30, supersedes the original body for this question.
- Missing required citations: none

### hgr_table_text_001_pilot_001

- Category: table + text reasoning
- Challenge: native_row
- Reasons: wrong_answer, unfaithful_or_overbroad_citation, unsupported_conclusion
- Expected: 36755
- Submitted: header: Year | Division | League | Regular Season | Playoffs | Open Cup | Avg.
- Missing required citations: none

### hgr_authority_conflict_001_pilot_001

- Category: source authority conflicts
- Challenge: authority_conflict
- Reasons: wrong_answer, unfaithful_or_overbroad_citation, unsupported_conclusion, bad_abstention_behavior
- Expected: SUPPORTS
- Submitted: ABSTAIN
- Missing required citations: none


## Headline Contrast

- Lexical answer-correct gap vs oracle sanity runner: 0.8000
- Lexical citation-faithfulness gap vs oracle sanity runner: 0.4000
- Lexical evidence-recall gap vs oracle sanity runner: 0.3021
- Citation-aware verifier answer-correct delta vs lexical: -0.0333
- Citation-aware verifier citation-precision delta vs lexical: 0.0000
- Citation-aware verifier citation-faithfulness delta vs lexical: -0.0167
- Citation-aware verifier conclusion-support delta vs lexical: 0.1000
- Citation-aware verifier abstention-quality delta vs lexical: -0.1000

## Interpretation

The lexical and citation-aware verifier baselines are intentionally non-oracle: they do not read native answers or gold citation ids. Their weakest categories are a first operational signal for the paper question: hard grounded research failures are not just lookup misses; they include answer selection under insufficiency, table/text interpretation, contradiction handling, and citation support for conclusions.

This report remains preliminary until the adjudication queue is reviewed and at least one API or open-model baseline has a scored report.
