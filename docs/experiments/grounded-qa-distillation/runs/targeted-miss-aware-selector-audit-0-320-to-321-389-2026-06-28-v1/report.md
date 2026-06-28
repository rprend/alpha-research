# Targeted Miss-Aware Selector Audit

Generated: 2026-06-28T14:20:52.136Z

Status: `targeted_packet_ready_selector_not_promoted`

This run converts the D293 mined rows into a targeted post-training contrast packet, then tests a preregistered deployable same-citation rescue rule against the final heldout candidate pool.

## Targeted Packet

- Targeted train contrasts: 55
- High-priority same-citation overexpansion contrasts: 7
- Best target-pair diagnostic: high_priority_shape_guard (6/7)

## Final Selector Diagnostic

- Baseline source-prefix selector: 44/49
- Conservative same-citation rescue: 39/49
- Switches: 12
- Rescued misses: 3
- Regressions: 8

## Decision

- Promote miss-aware selector now: no
- Use targeted packet for post-training now: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Use the targeted packet as post-training/eval data, not as a hand-written listwise rule; the next run should train or fit a bounded learner on the packet and test temporal transfer.
- Reason: The mined contrast packet captures the desired overexpansion behavior, but a deployable hand-written same-citation rescue rule over-applies and regresses previously supported final examples.
