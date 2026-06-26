# Versioned Private/Domain KB Eval

Generated: 2026-06-26T21:58:13.288Z

Status: `versioned_domain_kb_eval_complete`

Source: `versioned-private-kb-prototype-git-docs-2026-06-26-v1`

## Systems

| System | Answer rate | Overall correct | Answer support | Abstention correct | Citation precision | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| copy_first_evidence | 100.0% | 50.0% | 50.0% | 0.0% | 50.0% | 50.0% |
| snapshot_aware_stale_guard | 60.0% | 90.0% | 83.3% | 100.0% | 83.3% | 50.0% |
| prefix_retriever_snapshot_guard | 60.0% | 100.0% | 100.0% | 100.0% | 100.0% | 60.0% |

## Stale Snapshot Slice

| System | Stale examples | Answered | Correct |
| --- | ---: | ---: | ---: |
| copy_first_evidence | 12 | 12 | 0.0% |
| snapshot_aware_stale_guard | 12 | 0 | 100.0% |
| prefix_retriever_snapshot_guard | 12 | 0 | 100.0% |

Interpretation: The versioned prototype surfaces a real stale-KB failure mode: citation syntax is easy, but snapshot-aware abstention is necessary when the requested update is absent from the retrieved snapshot.

This evaluation makes no OpenAI calls, launches no GPU jobs, and records no spend.
