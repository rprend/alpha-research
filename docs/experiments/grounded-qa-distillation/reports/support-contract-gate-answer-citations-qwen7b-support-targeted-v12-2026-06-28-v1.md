# Support Contract Gate

Generated: 2026-06-28T04:20:57.042Z

Source run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source | 59.4% | 26.8% | 56.5% | 11 | 30 |
| Contract-gated | 18.8% | 53.8% | 71.0% | 7 | 6 |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| 28 | 10 | 0 | 14 | 13 |

Reason counts:

- counterfactual_or_insufficient_evidence_metadata: 13
- top_level_citation_contract_failed: 19
- inline_citation_contract_failed: 19

## Conclusion

Status: `contract_gate_improves_support_but_collapses_coverage`

- Answer support changes from 26.8% to 53.8%.
- Answer rate changes from 59.4% to 18.8%.
- The gate suppresses 28 source answers, including 0 supported answers and 14 answerable rows.
- It performs 10 useful unsupported-answer suppressions on reference-abstain rows.

Use the contract gate as a pre-judge safety filter and training diagnostic, not as the final policy. The generator still needs contract-complete supported answers for answerable rows.

This gate makes no LLM calls and launches no compute.
