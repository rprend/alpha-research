# RISD Graphic Design Needs Follow-Up

Generated: 2026-06-11

## Summary

- Review queue rows: 10
- Pending review decisions: 10
- Field conflicts: 6
- High-priority reviews: 0
- Medium-priority reviews: 1

## High-Priority Reviews

- None

## Medium-Priority Reviews

- reading_normalization_low_confidence: review_reading_normalization_backlog. Action: Review 68 unresolved reading snippets and expand the local catalog or tighten extraction patterns.

## Field Conflicts

- HIGH term on Design Studio 1: 2016 | 2016-2018. Do not merge records across terms unless they are explicitly the same archived course version.
- HIGH term on GRAPH-3210: 2016 | 2016-2018. Do not merge records across terms unless they are explicitly the same archived course version.
- MEDIUM instructor on Design Studio 1: John Caserta | DS1 team. Treat instructor differences as likely section or term variants until corroborated.
- MEDIUM class_time on GRAPH-2313-01: Thursdays 1:10–6:10pm | Thursdays 1:10pm–6:10pm. Treat meeting-time differences as section or term variants.
- MEDIUM instructor on GRAPH-3210: John Caserta | DS1 team. Treat instructor differences as likely section or term variants until corroborated.
- LOW class_location on GRAPH-2313-01: Design Center 407 | DC 407. Treat location differences as section or term variants.

## Review Protocol

1. Open the public source URL or source IDs listed in the review row.
2. Decide whether the artifact contains recoverable syllabus, schedule, assignment, reading, critique, grading, or student-work evidence.
3. Update `review_decisions.jsonl` with the decision, reviewer, date, and notes.
4. If a parser improvement is needed, change the generator and regenerate the corpus instead of editing derived artifacts by hand.
