# Balanced Packet Learner Audit

Generated: 2026-06-28T14:38:45.649Z

Status: `balanced_packet_too_sparse_final_neutral_not_promoted`

This run adds the available broad preservation contrasts to the targeted packet and tests whether that balanced objective stabilizes the bounded learner without final-label tuning.

## Packet Composition

- Broad pairs: 58
- Targeted pairs: 55
- Preservation-only pairs: 3
- Train pairs: 38
- Validation pairs: 20

## Temporal Transfer

- Prior targeted-only train: 14/38
- Balanced train: 14/38
- Prior targeted-only validation: 16/17
- Balanced validation: 17/20
- Preservation-only rows: 3
- Selected overlay alpha: 0

## Final Diagnostic

- Baseline source-prefix selector: 44/49
- Balanced learner overlay: 44/49
- Switches: 0
- Regressions: 0

## Decision

- Promote balanced learner overlay now: no
- Keep balanced packet for training: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Treat broad-preservation mixing as the default packet-construction principle, but mine additional non-final preservation rows before another learner or compact-student run.
- Reason: The available broad packet adds only three preservation-only rows, all in the late validation window; that improves validation coverage by one correct pair but does not fix early train underfit or improve final selection.
