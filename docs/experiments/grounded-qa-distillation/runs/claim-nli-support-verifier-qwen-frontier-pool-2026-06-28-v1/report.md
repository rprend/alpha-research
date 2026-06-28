# Claim NLI Support Verifier

Generated: 2026-06-28T10:08:41.392Z

Status: `claim_nli_support_verifier_learns_nonfinal_but_not_final`

This run makes no OpenAI calls and launches no external compute. It trains on non-final claim-level support labels plus local `cross-encoder/nli-distilroberta-base` NLI scores, and uses final-window candidate labels only as forbidden diagnostics.

| Split | Examples/pairs | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train claim classification | 166 | 156 | 94.0% |
| Validation claim classification | 52 | 42 | 80.8% |
| Non-final validation pairwise | 21 | 17 | 81.0% |
| Existing validation pairwise | 24 | 20 | 83.3% |
| Final diagnostic pairwise | 61 | 18 | 29.5% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Local NLI features improve some validation metrics but still do not clear the final diagnostic selection threshold.
- Next step: Use the remaining budget on a bounded final-like non-final adjudication or contrast-construction batch before any more generator-only GPU spend.
