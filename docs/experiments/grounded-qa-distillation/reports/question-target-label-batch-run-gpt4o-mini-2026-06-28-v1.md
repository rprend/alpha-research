# Question-Target Label Batch Run

Generated: 2026-06-28T16:22:05.485Z

This run executed the D308 target-completeness label batch with per-call OpenAI ledger rows. It did not use final-window labels and did not launch GPU compute.

| Requests | Calls | Cost | Target-gap primary rows | Calibration exact | Budget remaining |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 87 | 87 | $0.016071 | 71/79 | 6/8 | $86.476324 |

## Primary Labels

- Chosen complete: 79/79
- Rejected complete: 8/79
- Chosen preferred: 76/79
- Rejected preferred: 3/79
- Failure modes: {"entailed_but_incomplete":30,"complete_supported":42,"entailed_but_wrong_target":4,"unsupported_claim":3}

## Decision

- Integrate labels now: yes
- Train question-target verifier now: yes
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The batch found a stable set of cases where the chosen answer is target-complete and the rejected answer is not.
- Next step: Build a small target-completeness verifier or selector from these labels before spending on GPU training.
