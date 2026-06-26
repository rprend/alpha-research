# Hard Grounded Research Baseline Analysis

This report is generated from checked-in run artifacts. It is a pilot result summary, not a paper claim over gold data.

## Readiness

- Gold ready: false
- Valid reviewed items: 0/30
- Unreviewed items: 30
- OpenAI prompt packet rows: 30
- OpenAI scored report present: false

## Macro Results

| System | Tasks | Answer correct | Evidence recall | Citation faithfulness | Abstention quality |
| --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | 30 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| lexical-evidence-baseline-v1 | 30 | 0.2333 | 0.6979 | 0.6167 | 0.7000 |

## Lexical Baseline Weakest Categories

| Category | Answer correct | Evidence recall | Citation faithfulness | Abstention quality |
| --- | --- | --- | --- | --- |
| cross-document contradiction | 0.0000 | 0.3952 | 0.5000 | 1.0000 |
| evidence insufficiency / abstention | 0.0000 | 1.0000 | 0.5000 | 0.0000 |
| table + text reasoning | 0.0000 | 1.0000 | 0.5000 | 1.0000 |
| citation supports fact but not conclusion | 0.3333 | 0.3952 | 0.6667 | 1.0000 |
| entity disambiguation | 0.3333 | 0.5000 | 0.6667 | 1.0000 |

## Lexical Failure Taxonomy

| Category | Failures | Failure rate | Reason counts |
| --- | --- | --- | --- |
| multi-hop synthesis | 3/3 | 1.0000 | wrong_answer:2<br>unfaithful_or_overbroad_citation:2<br>missing_required_evidence:2 |
| stale-vs-current document conflicts | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>bad_abstention_behavior:2 |
| table + text reasoning | 3/3 | 1.0000 | wrong_answer:3<br>unfaithful_or_overbroad_citation:3 |
| evidence insufficiency / abstention | 3/3 | 1.0000 | wrong_answer:3<br>unfaithful_or_overbroad_citation:3<br>bad_abstention_behavior:3 |
| citation supports fact but not conclusion | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2 |
| entity disambiguation | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2 |
| temporal questions: as of date X | 3/3 | 1.0000 | wrong_answer:2<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:2<br>bad_abstention_behavior:2 |
| cross-document contradiction | 3/3 | 1.0000 | wrong_answer:3<br>missing_required_evidence:3<br>unfaithful_or_overbroad_citation:3 |
| appended document lifecycle changes | 2/3 | 0.6667 | wrong_answer:2<br>unfaithful_or_overbroad_citation:2 |
| source authority conflicts | 2/3 | 0.6667 | wrong_answer:2<br>unfaithful_or_overbroad_citation:2<br>bad_abstention_behavior:2 |

## Representative Lexical Failures

### hgr_multi_hop_001_pilot_001

- Category: multi-hop synthesis
- Challenge: native_row
- Reasons: wrong_answer, unfaithful_or_overbroad_citation
- Expected: yes
- Submitted: Scott Derrickson (born July 16, 1966) is an American director, screenwriter and producer.
- Missing required citations: none

### hgr_stale_current_001_pilot_001

- Category: stale-vs-current document conflicts
- Challenge: stale_current_conflict
- Reasons: wrong_answer, missing_required_evidence, unfaithful_or_overbroad_citation, bad_abstention_behavior
- Expected: SUPPORTS
- Submitted: ABSTAIN
- Missing required citations: 5a8b57f25542995d1e6f1371:support:1

### hgr_appendix_lifecycle_001_pilot_002

- Category: appended document lifecycle changes
- Challenge: document_lifecycle_appendix
- Reasons: wrong_answer, unfaithful_or_overbroad_citation
- Expected: Stanford NER
- Submitted: In this section we describe a number of experiments targeted to compare the performance of popular named entity recognition algorithms on our data.
- Missing required citations: none

### hgr_table_text_001_pilot_001

- Category: table + text reasoning
- Challenge: native_row
- Reasons: wrong_answer, unfaithful_or_overbroad_citation
- Expected: 36755
- Submitted: header: Year | Division | League | Regular Season | Playoffs | Open Cup | Avg.
- Missing required citations: none

### hgr_authority_conflict_001_pilot_001

- Category: source authority conflicts
- Challenge: authority_conflict
- Reasons: wrong_answer, unfaithful_or_overbroad_citation, bad_abstention_behavior
- Expected: SUPPORTS
- Submitted: ABSTAIN
- Missing required citations: none


## Headline Contrast

- Lexical answer-correct gap vs oracle sanity runner: 0.7667
- Lexical citation-faithfulness gap vs oracle sanity runner: 0.3833
- Lexical evidence-recall gap vs oracle sanity runner: 0.3021

## Interpretation

The lexical baseline is intentionally non-oracle: it does not read native answers or gold citation ids. Its weakest categories are a first operational signal for the paper question: hard grounded research failures are not just lookup misses; they include answer selection under insufficiency, table/text interpretation, contradiction handling, and citation support for conclusions.

This report remains preliminary until the adjudication queue is reviewed and at least one API or open-model baseline has a scored report.
