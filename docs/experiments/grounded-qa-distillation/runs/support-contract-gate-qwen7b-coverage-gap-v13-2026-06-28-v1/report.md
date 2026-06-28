# Support Contract Gate

Generated: 2026-06-28T06:08:59.075Z

Source run: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13-citation-repair`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source | 75.4% | 40.4% | 55.1% | 21 | 31 |
| Contract-gated | 13.0% | 77.8% | 60.9% | 7 | 2 |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| 43 | 14 | 10 | 25 | 16 |

Reason counts:

- counterfactual_or_insufficient_evidence_metadata: 16
- claim_table_citation_contract_failed: 34
- citation_channels_inconsistent: 26
- top_level_citation_contract_failed: 17
- inline_citation_contract_failed: 17

## Conclusion

Status: `contract_gate_improves_support_but_collapses_coverage`

- Answer support changes from 40.4% to 77.8%.
- Answer rate changes from 75.4% to 13.0%.
- The gate suppresses 43 source answers, including 10 supported answers and 25 answerable rows.
- It performs 14 useful unsupported-answer suppressions on reference-abstain rows.

Use the contract gate as a pre-judge safety filter and training diagnostic, not as the final policy. The generator still needs contract-complete supported answers for answerable rows.

This gate makes no LLM calls and launches no compute.
