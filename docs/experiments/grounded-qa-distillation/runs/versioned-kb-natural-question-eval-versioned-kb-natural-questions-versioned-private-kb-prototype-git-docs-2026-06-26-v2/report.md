# Versioned KB Natural Question Eval

Generated: 2026-06-26T23:47:27.450Z

Status: `versioned_kb_natural_question_eval_complete`

Source: `versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2`

## Naturalness Surface

| Template rate | Prefix leakage | Snapshot-label rate |
| ---: | ---: | ---: |
| 0.0% | 3.3% | 0.0% |

## Systems

| System | Answer rate | Overall correct | Answer support | Abstention correct | Citation precision | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| copy_first_evidence | 100.0% | 50.0% | 50.0% | 0.0% | 50.0% | 50.0% |
| snapshot_aware_stale_guard | 60.0% | 90.0% | 83.3% | 100.0% | 83.3% | 50.0% |
| lexical_retriever_snapshot_guard | 60.0% | 96.7% | 94.4% | 100.0% | 94.4% | 56.7% |

## Stale Snapshot Slice

| System | Stale examples | Answered | Correct |
| --- | ---: | ---: | ---: |
| copy_first_evidence | 12 | 12 | 0.0% |
| snapshot_aware_stale_guard | 12 | 0 | 100.0% |
| lexical_retriever_snapshot_guard | 12 | 0 | 100.0% |

Interpretation: The natural-question packet preserves the stale-KB failure mode after removing deterministic prefix wording: naive citation-copy still over-answers stale train-snapshot questions, while snapshot-aware abstention is still required.

This evaluation makes no OpenAI calls, launches no GPU jobs, and records no spend.
