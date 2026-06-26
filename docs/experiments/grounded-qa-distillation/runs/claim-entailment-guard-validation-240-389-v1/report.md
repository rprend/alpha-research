# Claim-Entailment Guard Validation

Scope: extended_temporal_future_holdout examples 241-389

This synthesis makes no LLM calls. It compares the fresh `gpt-4o` judge result for the deterministic claim-entailment guard with the already judged direct-mini and balanced-risk-gate transfer results.

| Policy | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | GPT-4o answer support | GPT-4o abstention support | GPT-4o overall correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct mini + citation repair | 117 | 78.5% | 64.1% | 70.4% | 30.2% | 64.1% | 100.0% | 71.8% |
| Balanced support-risk gate | 90 | 60.4% | 65.4% | 56.2% | 24.7% | 70.0% | 94.9% | 79.9% |
| Risk gate + claim-entailment guard | 85 | 57.0% | 67.0% | 55.1% | 24.1% | 74.1% | 95.3% | 83.2% |

## Guard Delta

Versus the balanced support-risk gate:

- Answered examples: -5
- GPT-4o overall judged correctness: +3.4pp
- GPT-4o answer support: +4.1pp
- Citation recall: -1.1pp
- Answer F1: -0.7pp

The guard judge run made 149 `gpt-4o` calls and cost $0.3042625. The deterministic guard itself makes zero inference-time LLM calls.

## Interpretation

Fresh judging confirms that the conservative numeric/comparative claim-entailment guard is a small positive support layer over the balanced risk gate: it raises overall correctness and answer support while giving up five answered examples. It is still a narrow heuristic, not a final verifier, because most retained unsupported answers remain unsuppressed and answer F1/citation recall remain below direct mini prompting.
