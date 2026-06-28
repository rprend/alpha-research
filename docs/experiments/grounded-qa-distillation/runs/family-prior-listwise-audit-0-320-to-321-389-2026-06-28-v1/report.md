# Family-Prior Listwise Audit

Generated: 2026-06-28T13:39:54.903Z

Status: `family_prior_promising_not_promoted`

This audit trains only generator-family reliability priors from non-final judged contrasts, then selects from the final candidate pool using family prior first and raw broad-selector score only as a tiebreaker.

## Selection

- Non-final family-prior pairwise accuracy: 45/58
- Raw broad selector: 19/49 supported
- Deployable complete tournament: 19/49 supported
- Family-prior listwise selector: 42/49 supported
- Delta vs raw: +23

## Decision

- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Stress-test source-family priors across additional temporally separated windows and combine them with evidence/claim features under a preregistered listwise selector.
- Reason: A non-final family prior substantially improves heldout selection, but the training set is sparse and missing some final families, so this is a promising deployable feature rather than a final claim.
