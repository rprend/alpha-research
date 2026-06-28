# High-Score Support Label Batch Run

Generated: 2026-06-28T21:48:13.925Z

Status: `high_score_support_labels_adjudicated`

This run executed the targeted support-adjudication batch with per-call OpenAI ledger rows. It did not launch GPU compute. Final-window rows are validation/adjudication-only.

| Requests | Calls | Cost | Non-final chosen preferred | Final chosen preferred | Calibration exact | Budget remaining |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 80 | $0.017446 | 39/48 | 17/24 | 5/8 | $86.138384 |

## Primary Labels

- Rejected unsupported: 54/72
- Chosen preferred: 56/72
- Rejected preferred: 0/72
- Failure modes: {"overbroad_or_overclaimed":25,"fully_supported":18,"missing_direct_evidence":23,"wrong_question_target":1,"citation_mismatch":5}
- Support hints: {"none_or_other":66,"citation_density":6}

## Decision

- Integrate labels now: no
- Train support discriminator now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: Duplicate calibration is too unstable for training.
- Next step: Audit disagreement examples before buying additional labels or launching GPU work.
