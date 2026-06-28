# Frontier Replay Audit

Generated: 2026-06-28T12:22:33.764Z

This is a zero-call frontier replay audit. It recomputes D272 boundary features on non-final frontier-pool validation pairs and uses no final-window labels for training, tuning, or evaluation.

## Summary

- Frontier validation pairs: 21
- Alpha boundary weight: 0.3
- Boundary vs D262 disagreements: 13

## Selector Accuracy

- d262_proxy_hard_negative_baseline: 19/21 correct, accuracy 0.904762, mean margin 3.878774
- d272_frontier_replay_boundary_only: 10/21 correct, accuracy 0.47619, mean margin -0.639027
- d272_frontier_replay_selected_hybrid: 19/21 correct, accuracy 0.904762, mean margin 3.687066

## Diagnosis

- Primary finding: frontier_replay_does_not_justify_hybrid_promotion
- Interpretation: Same-row frontier replay does not justify promoting the D272 selected hybrid over the stronger hard-negative D262 proxy.

## Decision

- Promote selected hybrid now: no
- Integrate boundary-only now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Use the hard-negative/frontier replay signal to design a comparable-coverage hybrid only if it preserves existing validation and beats D262 on frontier validation without relying on final rows.
