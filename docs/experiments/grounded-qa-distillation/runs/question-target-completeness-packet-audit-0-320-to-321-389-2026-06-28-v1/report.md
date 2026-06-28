# Question-Target Completeness Packet Audit

Generated: 2026-06-28T15:55:00.666Z

Status: `target_completeness_supervision_sparse_in_current_packet`

This audit checks whether the current non-final packet contains enough high-entailment hard negatives to train the richer verifier implied by D305.

## Non-Final Packet

- Pair rows: 58
- Target rows: 44
- Unsupported high-entailment rows: 9
- Focus-guard hard negatives: 1
- Coverage-guard hard negatives: 4

## Final Diagnostic

- D305 selected switches: 5
- D305 regressions: 4
- D305 rescues: 1

## Decision

- Train question-target verifier now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Mine a broader question-target completeness packet from existing judged frontier pools before any GPU or new label spend; the current non-final train packet has only one focus-guard hard negative.
- Reason: D305 anti-transfers because the non-final packet has many ordinary supported-vs-unsupported rows but almost no high-entailment, focus-preserving hard negatives matching the final regressions.
