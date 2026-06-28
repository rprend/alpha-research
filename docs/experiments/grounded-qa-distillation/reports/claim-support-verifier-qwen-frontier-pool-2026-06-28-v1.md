# Claim Support Verifier

Generated: 2026-06-28T10:00:46.516Z

Status: `claim_support_verifier_learns_nonfinal_but_not_final`

This run makes no OpenAI calls and launches no compute. It trains on non-final claim-level support labels and uses final-window candidate labels only as forbidden diagnostics.

| Split | Examples/pairs | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train claim classification | 166 | 154 | 92.8% |
| Validation claim classification | 52 | 43 | 82.7% |
| Non-final validation pairwise | 21 | 19 | 90.5% |
| Existing validation pairwise | 24 | 18 | 75.0% |
| Final diagnostic pairwise | 61 | 20 | 32.8% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Claim-level supervision still does not clear the final diagnostic selection threshold.
- Next step: Escalate from lexical claim features to stronger semantic verifier labels/modeling before any more generator-only GPU spend.
