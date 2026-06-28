# Question Focus Guard Audit

Generated: 2026-06-28T15:47:23.258Z

Status: `question_focus_guards_not_promotable`

This audit tests lexical question-focus guards after D304 showed simple coverage guards were not enough.

## Non-Final Selection

- Guard count: 8
- Threshold rows: 337
- Eligible zero-regression rescue policies: 26
- Selected guard: question_overlap_and_answer_length_non_decreasing

## Final Reporting

- Baseline source-prefix selector: 44/49
- Selected question-focus guard: 41/49
- Best question-focus diagnostic: 44/49
- Overlap and coverage diagnostic: 43/49

## Decision

- Promote question-focus guard now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Move to a richer verifier target: mine or label examples for question-target completeness rather than relying on lexical overlap, scalar entailment, or simple coverage guards.
- Reason: Question-focus guards produce 26 eligible non-final zero-regression rescue policies, but the selected policy anti-transfers to 41/49 final support with 4 regressions; final-only best policies do not improve over the 44/49 source-prefix baseline.
