# Qwen 7B V4-V9 Answer-Form Regression Audit

Generated: 2026-06-28T01:50:06.940Z

## System Summary

| System | Answer rate | Answer support | Overall correct | Supported answers | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| qwen7b_v4_support_aware | 50.7% | 65.7% | 82.6% | 23 | 12 |
| qwen7b_v5_coverage_aware | 63.8% | 50.0% | 68.1% | 22 | 22 |
| qwen7b_v6_answerability_gated | 49.3% | 61.8% | 81.2% | 21 | 13 |
| qwen7b_v7_structure_repair | 91.3% | 41.3% | 46.4% | 26 | 37 |
| qwen7b_v8_repair_regeneration | 0.0% | 0.0% | 95.7% | 0 | 0 |
| qwen7b_v9_span_claim | 40.6% | 50.0% | 78.3% | 14 | 14 |

## V9 Incremental Coverage

| Row set | Count | Counterfactual |
| --- | ---: | ---: |
| v9_answered | 28 | 5 |
| v9_supported_answers | 14 | 3 |
| v9_unsupported_answers | 14 | 2 |
| v9_new_answers_over_prior | 0 | 0 |
| v9_new_supported_answers_over_prior | 1 | 1 |
| v9_new_non_counterfactual_supported_answers_over_prior | 0 | 0 |
| v9_new_unsupported_answers_over_prior | 0 | 0 |
| v9_lost_prior_supported_answers | 24 | 4 |
| v9_counterfactual_answered | 5 | 5 |

## Answer-Form Failures

V9 answered 28 rows, with 14 supported and 14 unsupported answers.
Short or yes/no answer-form failures account for 8 unsupported answers.
Counterfactual answered rows: 5.

Unsupported tag counts:

- unsupported_context_or_annotation: 3
- unsupported_task_or_experiment: 7
- too_short_or_yes_no: 8
- partial_support: 2
- unsupported_comparison_or_baseline: 2
- missing_direct_evidence: 2
- counterfactual_answered: 2
- invalid_citation_id: 1
- other_unsupported_claim: 2

## Candidate-Pool Oracle

The oracle over existing v4-v9 candidates answers 38/69 rows (55.1%) with 38 supported answers and 100.0% overall judged correctness.
This is held-out-label headroom, not a deployable policy.

## Conclusion

Status: `v9_adds_no_unique_supported_coverage`

- V9 adds 1 unique supported answers over the existing v4-v8 Qwen 7B candidate pool, but 0 are non-counterfactual answerable rows.
- V9 loses 24 previously supported answer opportunities when used as a standalone policy.
- The v4-v9 candidate-pool oracle answers 38/69 rows (55.1%) with 38 supported answers.
- 8/14 unsupported v9 answers are short, yes/no, or underspecified answer-form failures.
- 13 answerable final-window rows still have no supported Qwen 7B candidate across v4-v9; the candidate pool needs 11 more supported answers to reach a 70% answer rate on the 69-query final window.

Next intervention: Do not spend on a larger blind GPU run yet. Build answer-form-aware supervision and a support verifier that rejects short/underspecified answers, then test whether it creates new supported candidates rather than only changing abstention rate.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
