# Entailment Coverage Guard Postmortem Audit

Generated: 2026-06-28T15:37:56.638Z

Status: `coverage_guards_do_not_make_entailment_selector_promotable`

This audit diagnoses D303 entailment-min listwise regressions and tests simple coverage guards selected only on non-final chronological transfer.

## Non-Final Selection

- Guard count: 7
- Threshold rows: 295
- Eligible zero-regression rescue policies: 0
- Selected guard: no_override
- Selected entailment delta: 999
- Selected entailment floor: 999

## Final Reporting

- Baseline source-prefix selector: 44/49
- Selected coverage guard: 44/49
- Best deployable coverage guard diagnostic: 43/49
- Best unguarded entailment diagnostic: 31/49

## Decision

- Promote coverage guard now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Mine a stronger verifier feature or broaden non-final supervision; simple claim/citation/token coverage guards do not provide a zero-regression rescue policy.
- Reason: No guard/threshold policy rescues a latest-window low-prior row with zero non-final regressions. Final-only diagnostics show coverage guards can reduce damage but still fail to beat the 44/49 source-prefix baseline.
