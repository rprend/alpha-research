# Numeric Teacher Smoke Postmortem

Generated: 2026-06-29T08:30:36.661Z

Status: `numeric_teacher_smoke_regresses_diagnostic_baseline`

This audit makes no OpenAI calls and launches no compute.

## Summary

| Metric | Count |
| --- | ---: |
| Examples | 10 |
| Baseline normalized correct | 7 |
| Numeric normalized correct | 4 |
| Numeric - baseline | -3 |
| Numeric recoveries | 0 |
| Numeric regressions from baseline | 3 |

## Buckets

| Bucket | Count |
| --- | ---: |
| `both_contract_correct` | 4 |
| `both_wrong` | 3 |
| `numeric_regression_from_baseline` | 3 |

## Tags

| Tag | Count |
| --- | ---: |
| `answerability_error_survives_normalization` | 6 |
| `invalid_answer_type_alias` | 5 |
| `over_answered_insufficient_evidence` | 5 |
| `abstention_evidence_first_has_citations` | 4 |
| `citation_selection_error_survives_normalization` | 3 |
| `evidence_first_error_survives_normalization` | 3 |
| `claims_without_top_level_citations` | 1 |
| `false_abstention` | 1 |

## Conclusion

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Keep numeric teacher packet for Qwen 3B: no
- Try constrained scaffold before more GPU: yes
- Reason: After deterministic normalization the numeric-teacher smoke gets 4/10 contract-correct rows, -3 versus the DPO-prompt-repaired baseline, with persistent answerability/citation errors rather than only schema errors.
- Next step: Stop Qwen 3B SFT/DPO launches for this numeric-teacher packet. Prototype a deterministic constrained output scaffold or a stronger student on a tiny diagnostic surface before spending more GPU or OpenAI judge budget.
