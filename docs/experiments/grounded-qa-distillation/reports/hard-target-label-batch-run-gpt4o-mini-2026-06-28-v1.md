# Question-Target Label Batch Run

Generated: 2026-06-28T16:51:42.193Z

This run executed the D308 target-completeness label batch with per-call OpenAI ledger rows. It did not use final-window labels and did not launch GPU compute.

| Requests | Calls | Cost | Target-gap primary rows | Calibration exact | Budget remaining |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 108 | 108 | $0.021652 | 88/96 | 11/12 | $86.454672 |

## Primary Labels

- Chosen complete: 91/96
- Rejected complete: 8/96
- Chosen preferred: 84/96
- Rejected preferred: 11/96
- Failure modes: {"entailed_but_incomplete":31,"complete_supported":53,"entailed_but_wrong_target":10,"other":1,"unsupported_claim":1}

## Decision

- Integrate labels now: yes
- Train question-target verifier now: yes
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The batch found a stable set of cases where the chosen answer is target-complete and the rejected answer is not.
- Next step: Build a small target-completeness verifier or selector from these labels before spending on GPU training.
