# Preservation-Balanced Learner Audit

Generated: 2026-06-28T14:53:20.228Z

Status: `preservation_balanced_overlay_selected_without_final_lift_not_promoted`

This run combines targeted supported-over-unsupported contrasts with mined same-label preservation pairs. The goal is to test whether post-training data can teach a cheap selector to prefer grounded concise answers while preserving equivalence among already-correct or already-incorrect candidates.

## Packet Composition

- Targeted contrast pairs: 55
- Preservation pairs: 391
- Train contrast pairs: 38
- Validation contrast pairs: 17
- Train preservation pairs: 305
- Validation preservation pairs: 86

## Non-Final Selection

- Selected preservation weight: 1
- Train contrast: 22/38
- Validation contrast: 16/17
- Train preservation mean abs margin: 0.0005
- Validation preservation mean abs margin: 0.0015
- Selected overlay alpha: 0.1

## Final Reporting

- Baseline source-prefix selector: 44/49
- Preservation-balanced overlay: 44/49
- Switches: 0
- Rescued misses: 0
- Regressions: 0

## Decision

- Promote preservation-balanced overlay now: no
- Keep preservation pairs for training: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Use preservation pairs as a regularization diagnostic, but inspect whether the shallow feature set is too weak before renting GPU or buying more labels.
- Reason: The non-final selection rule allowed a nonzero overlay; final reporting determines whether this is a genuine lift or only a diagnostic switch.
