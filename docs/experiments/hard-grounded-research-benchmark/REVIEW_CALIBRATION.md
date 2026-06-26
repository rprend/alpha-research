# Hard Grounded Research Review Calibration

This generated packet defines reviewer-screening sentinel items for the hard-grounded benchmark. The sentinels are controlled calibration checks, not benchmark gold items, and they must not be used for paper task scores.

## Summary

- Calibration ready: true
- Scope: reviewer_screening_only
- Sentinels: 10
- Categories covered: 10
- Gold promotion allowed: false
- Minimum reviewer calibration accuracy: 0.9
- Must pass before review batch assignment: true

## Expected Label Coverage

| Label | Sentinels |
| --- | --- |
| SUPPORTED | 6 |
| REFUTED | 1 |
| INSUFFICIENT | 1 |
| CONFLICT | 1 |
| INVALID_ITEM | 1 |

## Sentinel Matrix

| Sentinel | Category | Expected label | Expected citations | Reviewer trap |
| --- | --- | --- | --- | --- |
| hgr_calibration_01 | multi-hop synthesis | SUPPORTED | cal_multi_hop:a<br>cal_multi_hop:b | Citing only one hop should fail calibration. |
| hgr_calibration_02 | stale-vs-current document conflicts | SUPPORTED | cal_stale:new | Treating the older threshold as current should fail calibration. |
| hgr_calibration_03 | appended document lifecycle changes | SUPPORTED | cal_appendix:body<br>cal_appendix:update | Accepting body-only evidence should fail calibration. |
| hgr_calibration_04 | table + text reasoning | SUPPORTED | cal_table:cell<br>cal_table:text | Using the table without the scoping text should fail calibration. |
| hgr_calibration_05 | source authority conflicts | REFUTED | cal_authority:registry | Letting the lower-authority source decide the answer should fail calibration. |
| hgr_calibration_06 | evidence insufficiency / abstention | INSUFFICIENT | none | Inferring a comparison from absent evidence should fail calibration. |
| hgr_calibration_07 | citation supports fact but not conclusion | INVALID_ITEM | none | Accepting a broad superiority conclusion from a narrow fact should fail calibration. |
| hgr_calibration_08 | entity disambiguation | SUPPORTED | cal_entity:target | Following the same-name distractor should fail calibration. |
| hgr_calibration_09 | temporal questions: as of date X | SUPPORTED | cal_temporal:before | Using future evidence for an as-of question should fail calibration. |
| hgr_calibration_10 | cross-document contradiction | CONFLICT | cal_contradiction:a<br>cal_contradiction:b | Choosing one side without a resolution source should fail calibration. |
