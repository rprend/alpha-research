# Support Contract Gate

Generated: 2026-06-28T07:02:07.686Z

Source run: `joint-action-qwen7b-v13-support-delta-smoke-eval-v14-citation-repair`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source | 73.9% | 39.2% | 55.1% | 20 | 31 |
| Contract-gated | 10.1% | 71.4% | 58.0% | 5 | 2 |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| 44 | 13 | 11 | 27 | 16 |

Reason counts:

- counterfactual_or_insufficient_evidence_metadata: 16
- claim_table_citation_contract_failed: 38
- citation_channels_inconsistent: 36
- top_level_citation_contract_failed: 7
- inline_citation_contract_failed: 7

## Conclusion

Status: `contract_gate_improves_support_but_collapses_coverage`

- Answer support changes from 39.2% to 71.4%.
- Answer rate changes from 73.9% to 10.1%.
- The gate suppresses 44 source answers, including 11 supported answers and 27 answerable rows.
- It performs 13 useful unsupported-answer suppressions on reference-abstain rows.

Use the contract gate as a pre-judge safety filter and training diagnostic, not as the final policy. The generator still needs contract-complete supported answers for answerable rows.

This gate makes no LLM calls and launches no compute.
