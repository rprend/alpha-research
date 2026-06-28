# Final Miss Repairability Audit

Generated: 2026-06-28T15:00:37.419Z

Status: `remaining_misses_are_selector_ranking_gap`

This is a final-window diagnostic only. It checks whether the remaining time-aware source-prefix misses are caused by missing supported candidates or by ranking existing supported candidates below unsupported selections.

## Summary

- Final examples: 49
- Baseline supported: 44
- Baseline unsupported misses: 5
- Oracle candidate-pool supported: 49/49
- Misses with supported candidate already present: 5
- Misses without supported candidate: 0
- Misses with Qwen supported candidate: 5
- Misses with OpenAI supported candidate: 1

## Decision

- Promote oracle selector now: no
- Treat remaining misses as selector gap: yes
- Treat remaining misses as candidate-pool gap: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Build a leakage-safe non-final selector diagnostic that can recognize low-prior supported candidates without using final labels.
- Reason: Every remaining miss has at least one supported candidate already present, so the immediate bottleneck is ranking/calibration rather than generation coverage.
