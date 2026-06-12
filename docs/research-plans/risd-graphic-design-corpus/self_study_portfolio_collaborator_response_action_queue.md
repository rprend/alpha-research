# RISD Graphic Design Collaborator Response Action Queue

Generated: 2026-06-12

This queue turns pending collaborator response reconciliation checks into exact learner or mentor/reviewer follow-through tasks.

- Action rows: 9
- Pending: 9
- High priority: 3

## collaborator_response_action_portfolio_milestone_01_foundation_methods_01_paste_response_import

- Milestone: portfolio_milestone_01_foundation_methods
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods
- Order: 1
- Kind: paste_response_import
- Owner: learner
- Priority: high
- Status: pending
- Source check: collaborator_response_pasted
- Learner action: Paste the collaborator response into the intake template, copy approved fields into self_study_portfolio_reviewer_feedback_import.jsonl, and keep only evidence-bounded refs.
- Verification: A live reviewer feedback import exists for the feedback template named by the reconciliation row.
- Target artifacts:
  - intake_template: collaborator_response_intake_portfolio_milestone_01_foundation_methods (self_study_portfolio_collaborator_response_intake_template.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_01_foundation_methods (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Copy approved intake fields into self_study_portfolio_reviewer_feedback_import.jsonl, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.

## collaborator_response_action_portfolio_milestone_01_foundation_methods_02_collect_signature

- Milestone: portfolio_milestone_01_foundation_methods
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods
- Order: 2
- Kind: collect_signature
- Owner: mentor_reviewer
- Priority: medium
- Status: pending
- Source check: decision_packet_followup_ready
- Learner action: Use the decision packet notes draft and imported feedback to collect reviewer signature, learner acknowledgement, review date, and source-boundary notes.
- Verification: The decision packet reaches ready_to_sign after feedback import and review decisions are recorded.
- Target artifacts:
  - decision_packet: decision_packet_portfolio_milestone_01_foundation_methods (self_study_portfolio_decision_packets.jsonl)
  - handoff_packet: collaborator_handoff_portfolio_milestone_01_foundation_methods (self_study_portfolio_collaborator_handoff_packets.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete the decision packet signature fields, then regenerate derived artifacts.

## collaborator_response_action_portfolio_milestone_01_foundation_methods_03_complete_after_review_checklist

- Milestone: portfolio_milestone_01_foundation_methods
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods
- Order: 3
- Kind: complete_after_review_checklist
- Owner: learner
- Priority: medium
- Status: pending
- Source check: completion_checklist_followup_ready
- Learner action: Complete the after-review checklist actions for feedback import, revision queue resolution, gate status import, regeneration, and dashboard verification.
- Verification: The completion checklist reaches ready_for_after_review and names no unresolved blocking condition for this milestone.
- Target artifacts:
  - completion_checklist: completion_checklist_portfolio_milestone_01_foundation_methods (self_study_portfolio_completion_checklists.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_01_foundation_methods (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_01_foundation_methods (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete checklist follow-through, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.

## collaborator_response_action_portfolio_milestone_02_typography_systems_01_paste_response_import

- Milestone: portfolio_milestone_02_typography_systems
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems
- Order: 1
- Kind: paste_response_import
- Owner: learner
- Priority: high
- Status: pending
- Source check: collaborator_response_pasted
- Learner action: Paste the collaborator response into the intake template, copy approved fields into self_study_portfolio_reviewer_feedback_import.jsonl, and keep only evidence-bounded refs.
- Verification: A live reviewer feedback import exists for the feedback template named by the reconciliation row.
- Target artifacts:
  - intake_template: collaborator_response_intake_portfolio_milestone_02_typography_systems (self_study_portfolio_collaborator_response_intake_template.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_02_typography_systems (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Copy approved intake fields into self_study_portfolio_reviewer_feedback_import.jsonl, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.

## collaborator_response_action_portfolio_milestone_02_typography_systems_02_collect_signature

- Milestone: portfolio_milestone_02_typography_systems
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems
- Order: 2
- Kind: collect_signature
- Owner: mentor_reviewer
- Priority: medium
- Status: pending
- Source check: decision_packet_followup_ready
- Learner action: Use the decision packet notes draft and imported feedback to collect reviewer signature, learner acknowledgement, review date, and source-boundary notes.
- Verification: The decision packet reaches ready_to_sign after feedback import and review decisions are recorded.
- Target artifacts:
  - decision_packet: decision_packet_portfolio_milestone_02_typography_systems (self_study_portfolio_decision_packets.jsonl)
  - handoff_packet: collaborator_handoff_portfolio_milestone_02_typography_systems (self_study_portfolio_collaborator_handoff_packets.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete the decision packet signature fields, then regenerate derived artifacts.

## collaborator_response_action_portfolio_milestone_02_typography_systems_03_complete_after_review_checklist

- Milestone: portfolio_milestone_02_typography_systems
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems
- Order: 3
- Kind: complete_after_review_checklist
- Owner: learner
- Priority: medium
- Status: pending
- Source check: completion_checklist_followup_ready
- Learner action: Complete the after-review checklist actions for feedback import, revision queue resolution, gate status import, regeneration, and dashboard verification.
- Verification: The completion checklist reaches ready_for_after_review and names no unresolved blocking condition for this milestone.
- Target artifacts:
  - completion_checklist: completion_checklist_portfolio_milestone_02_typography_systems (self_study_portfolio_completion_checklists.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_02_typography_systems (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_02_typography_systems (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete checklist follow-through, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.

## collaborator_response_action_portfolio_milestone_03_advanced_synthesis_01_paste_response_import

- Milestone: portfolio_milestone_03_advanced_synthesis
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis
- Order: 1
- Kind: paste_response_import
- Owner: learner
- Priority: high
- Status: pending
- Source check: collaborator_response_pasted
- Learner action: Paste the collaborator response into the intake template, copy approved fields into self_study_portfolio_reviewer_feedback_import.jsonl, and keep only evidence-bounded refs.
- Verification: A live reviewer feedback import exists for the feedback template named by the reconciliation row.
- Target artifacts:
  - intake_template: collaborator_response_intake_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_collaborator_response_intake_template.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Copy approved intake fields into self_study_portfolio_reviewer_feedback_import.jsonl, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.

## collaborator_response_action_portfolio_milestone_03_advanced_synthesis_02_collect_signature

- Milestone: portfolio_milestone_03_advanced_synthesis
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis
- Order: 2
- Kind: collect_signature
- Owner: mentor_reviewer
- Priority: medium
- Status: pending
- Source check: decision_packet_followup_ready
- Learner action: Use the decision packet notes draft and imported feedback to collect reviewer signature, learner acknowledgement, review date, and source-boundary notes.
- Verification: The decision packet reaches ready_to_sign after feedback import and review decisions are recorded.
- Target artifacts:
  - decision_packet: decision_packet_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_decision_packets.jsonl)
  - handoff_packet: collaborator_handoff_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_collaborator_handoff_packets.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete the decision packet signature fields, then regenerate derived artifacts.

## collaborator_response_action_portfolio_milestone_03_advanced_synthesis_03_complete_after_review_checklist

- Milestone: portfolio_milestone_03_advanced_synthesis
- Reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis
- Order: 3
- Kind: complete_after_review_checklist
- Owner: learner
- Priority: medium
- Status: pending
- Source check: completion_checklist_followup_ready
- Learner action: Complete the after-review checklist actions for feedback import, revision queue resolution, gate status import, regeneration, and dashboard verification.
- Verification: The completion checklist reaches ready_for_after_review and names no unresolved blocking condition for this milestone.
- Target artifacts:
  - completion_checklist: completion_checklist_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_completion_checklists.jsonl)
  - feedback_import_or_template: feedback_reviewer_handoff_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_reviewer_feedback_template.jsonl)
  - reconciliation: collaborator_response_reconciliation_portfolio_milestone_03_advanced_synthesis (self_study_portfolio_collaborator_response_reconciliation.jsonl)
- Next command: Complete checklist follow-through, then run node scripts/risd-graphic-design-corpus.mjs --render-derived-only.
