# Targeted Packet Learner Transfer Audit

Generated: 2026-06-28T14:31:05.002Z

Status: `targeted_learner_unstable_final_neutral_not_promoted`

This run fits a bounded learner on early targeted non-final contrasts, validates it on a later non-final targeted window, and then replays a frozen conservative overlay against the final heldout selector.

## Temporal Transfer

- Train targeted pairs: 14/38
- Validation targeted pairs: 16/17
- Selected overlay alpha: 0
- Train threshold met: no
- Validation threshold met: yes

## Final Diagnostic

- Baseline source-prefix selector: 44/49
- Targeted learner overlay: 44/49
- Switches: 0
- Rescued misses: 0
- Regressions: 0

## Decision

- Promote targeted learner overlay now: no
- Keep targeted packet for training: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Keep the targeted packet as a training/eval slice, but build a balanced objective with broad preservation examples before another reranker or compact-student run.
- Reason: The bounded learner finds a later-window targeted signal but underfits the early targeted training rows, so the frozen overlay is disabled and final heldout selection remains the 44/49 source-prefix baseline.
