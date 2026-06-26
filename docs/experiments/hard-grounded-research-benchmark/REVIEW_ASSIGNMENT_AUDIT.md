# Hard Grounded Research Review Assignment Audit

This generated audit checks that assigned work is ready for blind double review with distinct reviewer slots and reviewer-field-only constraints. It does not fill labels, resolve disagreements, or clear gold, scale, novelty, or completion gates.

## Summary

- Assignment audit ready: true
- Version: review-assignment-audit-v1
- Total assignments: 22
- Pilot assignments: 12
- Expansion assignments: 10
- Double-review assignments: 22
- Blocked assignments: 0
- Immutable fields: 9
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| assignment_plan_loaded | true | 12 pilot assignments; 10 expansion assignments |
| review_packet_audit_clean | true | 30 packet files; findings=0 |
| return_contract_enforces_reviewer_fields_only | true | 9 immutable fields |
| all_assignments_have_distinct_reviewer_slots | true | 22/22 assignments have reviewer_a and reviewer_b |
| completion_still_blocked | true | assignment audit does not fill reviewer fields or promote gold |

## Assignment Rows

| Assignment | Wave | Scope | Category | Reviewer slots | Status |
| --- | --- | --- | --- | --- | --- |
| pilot_triage_01 | pilot_triage_wave_1 | pilot_review | cross-document contradiction | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_02 | pilot_triage_wave_1 | pilot_review | cross-document contradiction | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_03 | pilot_triage_wave_1 | pilot_review | cross-document contradiction | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_04 | pilot_triage_wave_1 | pilot_review | evidence insufficiency / abstention | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_05 | pilot_triage_wave_1 | pilot_review | temporal questions: as of date X | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_06 | pilot_triage_wave_1 | pilot_review | stale-vs-current document conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_07 | pilot_triage_wave_2 | pilot_review | temporal questions: as of date X | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_08 | pilot_triage_wave_2 | pilot_review | temporal questions: as of date X | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_09 | pilot_triage_wave_2 | pilot_review | stale-vs-current document conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_10 | pilot_triage_wave_2 | pilot_review | evidence insufficiency / abstention | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_11 | pilot_triage_wave_2 | pilot_review | source authority conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| pilot_triage_12 | pilot_triage_wave_2 | pilot_review | source authority conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_01 | expansion_balance_wave_1 | expansion_review | appended document lifecycle changes | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_02 | expansion_balance_wave_1 | expansion_review | citation supports fact but not conclusion | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_03 | expansion_balance_wave_1 | expansion_review | cross-document contradiction | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_04 | expansion_balance_wave_1 | expansion_review | entity disambiguation | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_05 | expansion_balance_wave_1 | expansion_review | evidence insufficiency / abstention | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_06 | expansion_balance_wave_1 | expansion_review | multi-hop synthesis | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_07 | expansion_balance_wave_1 | expansion_review | source authority conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_08 | expansion_balance_wave_1 | expansion_review | stale-vs-current document conflicts | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_09 | expansion_balance_wave_1 | expansion_review | table + text reasoning | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
| expansion_balance_10 | expansion_balance_wave_1 | expansion_review | temporal questions: as of date X | reviewer_a<br>reviewer_b | assignment_ready_for_blind_double_review |
