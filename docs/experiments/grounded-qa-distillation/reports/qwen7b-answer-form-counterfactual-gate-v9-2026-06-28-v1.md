# Qwen 7B V9 Answer-Form Counterfactual Gate

Generated: 2026-06-28T01:53:10.540Z

Source run: `joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair`

## Metrics

| Surface | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source v9 | 40.6% | 50.0% | 78.3% | 14 | 14 |
| Gated v9 | 21.7% | 60.0% | 79.7% | 9 | 6 |

## Suppressions

| Total | Useful unsupported suppressions | Harmful supported suppressions | Harmful answerable suppressions | Counterfactual suppressions |
| ---: | ---: | ---: | ---: | ---: |
| 13 | 3 | 2 | 7 | 5 |

Reason counts:

- too_short_or_yes_no: 9
- counterfactual_or_insufficient_evidence_metadata: 5
- missing_inline_citation: 1
- no_structured_citations: 1

## Conclusion

Status: `answer_form_gate_improves_support_but_collapses_coverage`

- The gate changes answer support from 50.0% to 60.0%.
- The gate changes answer rate from 40.6% to 21.7%.
- It suppresses 13 source answers, including 2 supported answers and 7 answerable rows.
- It performs 3 useful unsupported-answer suppressions on reference-abstain rows.

Next intervention: Answer-form suppression is a safety diagnostic, not a solution: it raises support by deleting too many answers. The next packet must generate longer, question-complete supported answers for oracle-gap rows rather than only suppress bad answers.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
