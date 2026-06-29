# Label Contract Calibration Audit

Generated: 2026-06-29T17:25:41.349Z

Status: `labels_need_calibration_before_more_spend`

This zero-cost audit checks D432/D433 failures for label and contract calibration issues before any more paid calls or GPU work.

## Summary

- Examples audited: 28
- Target grounded rows: 26
- Target abstain rows: 2
- Target evidence looks supported: 18
- Target grounded labels needing review: 5
- Counterfactual labels that may be too strict: 2
- Citation-minimality failures: 6
- Contextual over-citation failures: 5
- Important under-citation failures: 1

## Calibration Families

| Family | Count |
| --- | ---: |
| `false_abstention_against_supported_target` | 9 |
| `citation_minimality_overcitation` | 5 |
| `target_grounded_label_needs_review` | 5 |
| `target_citation_minimality_needs_review` | 4 |
| `counterfactual_label_may_be_too_strict` | 2 |
| `semantic_or_answer_content_mismatch` | 2 |
| `citation_minimality_undercitation` | 1 |

## Decision

- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Change primary metric now: no
- Create calibrated target packet next: yes
- Reason: 5 grounded labels need review, 2 abstention/counterfactual labels may be too strict, and 6 failures are citation-minimality cases.
- Next step: Create a leakage-safe calibrated target packet that separates exact target citations from acceptable support citations, then rerun local routing against both strict and calibrated gates before more paid calls.
