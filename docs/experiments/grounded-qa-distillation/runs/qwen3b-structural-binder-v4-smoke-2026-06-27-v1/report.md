# Qwen 3B Structural Citation/Support Binder

Generated: 2026-06-27T17:44:15.365Z

Status: `binder_tradeoff_not_final`

## Metrics

| System | Answer rate | Answer support | Abstention support | Overall judged correct | Unsupported answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source repaired Qwen | 65.2% | 33.3% | 100.0% | 56.5% | 30 |
| Structural binder | 43.5% | 43.3% | 74.4% | 60.9% | 17 |

## Suppressions

| Suppressed answers | Helpful suppressions | Harmful suppressions |
| ---: | ---: | ---: |
| 15 | 5 | 2 |

## Suppression Reasons

- `no_valid_citations`: 6
- `invalid_citations_dropped`: 6
- `too_short_for_question_type`: 7
- `answer_number_absent_from_cited_evidence`: 3
- `comparison_claim_not_in_cited_evidence`: 1

## Interpretation

Structural binding buys support/correctness, if any, by suppressing too much answer coverage.

Diagnostic scaffold evidence only. It is not a trained student and should not be reported as support-preserving distillation unless evaluated on a fresh held-out window.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
