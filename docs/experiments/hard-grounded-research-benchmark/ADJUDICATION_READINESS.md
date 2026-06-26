# Hard Grounded Research Adjudication Readiness

This generated report ties pilot and expansion merge outputs to their resolution queues. Empty queues do not imply adjudication is complete when reviewer workbooks are still blank; they only mean no completed double-review disagreements have been produced yet.

## Summary

- Adjudication readiness report ready: true
- Gold ready: false
- Pilot resolution queue items: 0
- Expansion resolution queue items: 0
- Reviewed target items remaining: 300
- Release promotion allowed: false

## Tracks

| Track | Merge-ready items | Completed reviews | Missing-review items | Disagreement items | Resolution queue | Queue status |
| --- | --- | --- | --- | --- | --- | --- |
| pilot_gold | 0/30 | 0 | 30 | 0 | 0 | empty_before_review |
| scaled_expansion | 0/270 | 0 | 270 | 0 | 0 | empty_before_review |

## Required Adjudicator Fields

| Track | Fields |
| --- | --- |
| pilot_gold | `final_label`, `final_answer`, `required_citation_ids`, `insufficient_or_conflicting_evidence`, `notes` |
| scaled_expansion | `final_label`, `final_answer`, `required_citation_ids`, `insufficient_or_conflicting_evidence`, `notes`, `category_fit`, `generation_defect` |

## Promotion Preconditions

| Precondition | Passed | Detail |
| --- | --- | --- |
| pilot_double_review_complete | no | 0/30 pilot items have two complete reviews |
| pilot_disagreements_resolved | yes | 0 pilot disagreement items; queue=0 |
| expansion_double_review_complete | no | 0/270 expansion items have two complete reviews |
| expansion_disagreements_resolved | yes | 0 expansion disagreement items; queue=0 |
| gold_summary_ready | no | 0/30 valid reviewed pilot items |

## Next Actions

- Complete independent pilot and expansion reviewer workbooks.
- Run strict preflight and merge for both pilot and expansion review tracks.
- Resolve any non-empty resolution queue with the required adjudicator fields.
- Rerun adjudication and release-gate generators before making paper claims.
