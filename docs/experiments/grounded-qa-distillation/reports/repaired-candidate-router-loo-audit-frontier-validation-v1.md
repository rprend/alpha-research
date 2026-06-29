# Repaired Candidate Router LOO Audit

Generated: 2026-06-29T03:36:55.874Z

Status: `loo_router_recovers_some_oracle_headroom`

This is a diagnostic leave-one-example-out router over repaired-validation labels. It is not a deployable policy.

## Metrics

| System | Contract Correct |
| --- | ---: |
| Best single existing system | 45/70 |
| LOO router | 47/70 (67.1%) |
| Candidate-pool oracle | 58/70 |

## Router Behavior

- Selected systems: constrained_qwen_hybrid=55, repaired_qwen3b=6, learned_repaired_selector=8, train_selected_constrained_policy=1
- Delta vs best single system: 2
- Remaining gap to oracle: 11
- Oracle gap closed: 15.4%
- Missed oracle rows: 11

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as policy: no
- Next step: Build a leakage-safe router/verifier using non-validation supervision or a fresh split; do not spend on Prime until it beats the validation baseline without validation-label training.
