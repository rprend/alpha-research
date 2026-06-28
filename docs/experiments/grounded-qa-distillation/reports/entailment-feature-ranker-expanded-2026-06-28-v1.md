# Entailment Feature Ranker

Generated: 2026-06-28T07:43:17.969Z

Status: `entailment_features_partial_signal`

This run makes no OpenAI calls and launches no compute.

## Metrics

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | 59 | 51 | 86.4% |
| Validation pairwise | 24 | 12 | 50.0% |
| Final diagnostic pairwise | 61 | 28 | 45.9% |
| Final diagnostic selection | 8 | 5 | 62.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Reason: Deterministic entailment features do not transfer strongly enough to select supported final-frontier Qwen candidates.
- Next step: Use a stronger verifier signal: add non-final Qwen-style candidate pairs, run a small local NLI scorer on packet candidates, or buy a bounded set of GPT-4o support labels before spending Prime GPU budget.
