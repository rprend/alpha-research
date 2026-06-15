# Generic Claim Adjudication Workflow

This workflow converts an arbitrary connotative claim into testable components, checks data availability before overclaiming, and rates the claim using H1/H2/H3.

## Inputs

- Original claim in native wording.
- Claimed or implied population.
- Suspected comparison baseline.
- Candidate data sources or permission to search for them.
- Desired decision: disprove, narrow, explain, or quantify.

## Steps

1. **Literal claim.** What would have to be true for the sentence to be literally accurate?
   - Deliverable: Atomic empirical claims plus definitional and normative residues.
2. **Implied comparison.** Compared to what baseline?
   - Deliverable: Explicit comparison classes and historical periods.
3. **Hidden denominator.** Few relative to what: people, wealth, total giving, historical precedent, or opportunity?
   - Deliverable: Denominators and rate definitions.
4. **Operational definitions.** What counts and what does not?
   - Deliverable: Inclusion/exclusion rules for donors, gifts, founding, endowments, and university support.
5. **Observable proxies.** What data could represent the claim, even imperfectly?
   - Deliverable: Proxy variables, source classes, and measurement caveats.
6. **Failure modes.** How could the claim be technically true but substantively misleading?
   - Deliverable: Narrow readings, missing data, and rhetorical overreach.
7. **Opposite hypothesis.** What would it look like if reality were backwards?
   - Deliverable: Evidence pattern that would show the claim is false.
8. **Orthogonal hypothesis.** What would it look like if the framing itself were wrong?
   - Deliverable: Evidence pattern showing the old category is not the live institutional form.

## Data Availability Gate

For every decomposed subclaim, assign:

- **Highly observable:** public records or structured datasets directly measure the thing.
- **Partially observable:** proxies exist, but coverage, joins, or definitions are incomplete.
- **Weakly observable:** mostly interpretive, hidden, anonymous, or costly to observe.
- **Non-observable/normative:** cannot be settled by data without additional value premises.

Do not let weakly observable or normative components drive a statistical rating. Keep them in the limitations and interpretation.

## H1/H2/H3 Rating

- **H1:** The broad claim is basically supported.
- **H2:** The claim is technically narrow or partly supported but substantively misleading.
- **H3:** The claim uses the wrong frame or is contradicted/orthogonal to the observed reality.

Each rating must include:

- Rating strength.
- Rationale.
- Evidence references.
- Limitations.
- What data could change the rating.

## Required Output Shape

```json
{
  "claimAdjudication": {
    "originalClaim": "...",
    "decomposedClaims": [],
    "dataSourcePlan": [],
    "observabilityAssessment": [],
    "studyDesign": {},
    "outcomeVariables": [],
    "alternativeExplanations": [],
    "failureModes": [],
    "oppositeHypothesis": "...",
    "orthogonalHypothesis": "...",
    "hypothesisRatings": [
      { "hypothesisId": "H1", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] },
      { "hypothesisId": "H2", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] },
      { "hypothesisId": "H3", "rating": "...", "rationale": "...", "evidenceRefs": [], "limitations": [] }
    ],
    "finalRating": "H1|H2|H3"
  }
}
```
