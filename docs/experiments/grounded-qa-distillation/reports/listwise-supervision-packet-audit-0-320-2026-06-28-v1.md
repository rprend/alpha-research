# Listwise Supervision Packet Audit

Generated: 2026-06-28T20:58:09.816Z

Status: `listwise_supervision_ready_for_cross_window_selector_probe`

This audit makes no new OpenAI calls and launches no compute.

## Data

| Split | Examples | Candidates |
| --- | ---: | ---: |
| All non-final | 116 | 784 |
| Train | 41 | 308 |
| Validation | 53 | 476 |

## Supervision

- Positive+negative examples: 109
- Abstention-boundary examples: 40
- Supported-answer candidates: 191
- Unsafe-answer candidates: 294
- Target-incomplete candidates: 164
- Preservation pairs available: 391

## Final Reporting Profile

- Frozen final pairs: 865
- Final structural pair errors remaining: 137
- Structural regressions vs D314: 83

## Decision

- Train selector now: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Reason: The expanded packet has 116 non-final examples, 109 positive/negative examples, 164 target-incomplete candidates, and 40 abstention-boundary examples; fixed split train rows are still modest, so use cross-window validation rather than a single holdout.
- Next step: Train a zero-call cross-window listwise selector probe from this packet before any new GPU launch.
