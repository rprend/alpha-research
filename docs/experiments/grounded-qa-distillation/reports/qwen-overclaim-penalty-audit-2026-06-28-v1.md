# Qwen Overclaim Penalty Audit

Generated: 2026-06-28T08:45:51.733Z

Status: `overclaim_verifier_needed`

This audit makes no OpenAI calls, launches no compute, and does not authorize GPU spend.

| Diagnostic examples | Base supported | Best deployable supported | Oracle overclaim supported | Verifier target pairs |
| ---: | ---: | ---: | ---: | ---: |
| 8 | 4 | 5 | 7 | 4 |

## Penalty Sweep

| Variant | Class | Selected supported | Rescued | Degraded |
| --- | --- | ---: | ---: | ---: |
| base_ranker | baseline | 4/8 | 0 | 0 |
| deployable_short_answer_regularizer | deployable_heuristic | 4/8 | 0 | 0 |
| deployable_family_neutralizer | deployable_heuristic | 4/8 | 0 | 0 |
| deployable_short_citation_family_regularizer | deployable_heuristic | 5/8 | 1 | 0 |
| oracle_unsupported_claim_penalty | oracle_diagnostic | 7/8 | 3 | 0 |
| oracle_support_first_selector | oracle_diagnostic | 8/8 | 4 | 0 |

## Leakage Guard

Final-window labels are not used for training. Oracle rows and verifier target pairs are marked `forbidden_diagnostic_only`.

## Conclusion

Simple deployable penalties can be audited, but final-window unsupported-claim labels are the signal that directly fixes these misses.

Next step: Treat the final miss pairs as verifier regression targets only. Build analogous selected-vs-supported pairs from leakage-safe non-final Qwen labels or buy a small bounded verifier-label batch before any further generator GPU run.
