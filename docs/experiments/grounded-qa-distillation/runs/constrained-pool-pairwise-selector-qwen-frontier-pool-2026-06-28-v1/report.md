# Constrained Pool-Pairwise Selector

Generated: 2026-06-28T10:47:21.660Z

Status: `constrained_selector_partial_signal`

This run makes no new LLM calls. It reuses paid non-final GPT-4o pool adjudications, constrains them with the D258 pairwise support model, and uses final-window labels only as forbidden diagnostics.

| Split | Items | Correct/selected | Rate |
| --- | ---: | ---: | ---: |
| Train pool choice | 14 | 10 | 71.4% |
| Adjudication validation pool choice | 6 | 5 | 83.3% |
| Existing validation pairwise | 24 | 20 | 83.3% |
| Final diagnostic pairwise | 61 | 35 | 57.4% |
| Pool-only final selection | 8 | 3 | 37.5% |
| Hybrid final selection | 8 | 3 | 37.5% |
| Constrained validation pool choice | 6 | 5 | 83.3% |
| Constrained existing validation pairwise | 24 | 19 | 79.2% |
| Constrained final diagnostic pairwise | 61 | 35 | 57.4% |
| Constrained final selection | 8 | 4 | 50.0% |

## Selected Policy

```json
{
  "alpha_pool_weight": 0,
  "uncited_claim_penalty": 0,
  "claim_answer_mismatch_penalty": 0,
  "claim_over_answer_penalty": 0
}
```

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The constrained selector recovers final diagnostic support relative to pool-only selection but does not yet clear the conference-grade threshold.
- Next step: Use this constrained objective as the next scaffold baseline and target remaining both-fail final examples before buying more labels.
