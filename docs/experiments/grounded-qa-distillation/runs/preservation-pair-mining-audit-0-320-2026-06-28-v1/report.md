# Preservation Pair Mining Audit

Generated: 2026-06-28T14:44:54.028Z

Status: `preservation_pairs_available_for_balanced_packet`

This audit mines same-label non-final judged candidates as preservation/equivalence pairs for balanced grounded-QA post-training.

## Summary

- Preservation pairs: 391
- Exact duplicate preservation pairs excluded: 477
- Examples with preservation pairs: 187
- Supported-answer pairs: 215
- Supported-abstention pairs: 84
- Unsupported-answer pairs: 92
- Train-window preservation pairs: 305
- Validation-window preservation pairs: 86

## Decision

- Build balanced packet next: yes
- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Merge preservation pairs with targeted supported-vs-unsupported contrasts into a balanced packet and test a learner that preserves same-label candidate neighborhoods.
- Reason: Existing non-final support labels contain many same-label pairs that were invisible to the supported-vs-unsupported contrast packet, so the next balanced objective can be built without new calls.
