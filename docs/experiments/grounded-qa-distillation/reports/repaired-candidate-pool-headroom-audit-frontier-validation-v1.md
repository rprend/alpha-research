# Repaired Candidate Pool Headroom Audit

Generated: 2026-06-29T03:30:37.108Z

Status: `candidate_pool_has_selector_headroom`

This is a diagnostic oracle audit over the repaired validation gate, not a deployable selected policy.

## Systems

| System | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
| train_calibrated_scaffold | 20/70 | 44/70 (62.9%) | 72.9% | 84.3% |
| constrained_qwen_hybrid | 20/70 | 45/70 (64.3%) | 72.9% | 85.7% |
| repaired_qwen3b | 33/70 | 35/70 (50.0%) | 60.0% | 68.6% |
| train_selected_constrained_policy | 21/70 | 41/70 (58.6%) | 71.4% | 80.0% |
| learned_repaired_selector | 22/70 | 41/70 (58.6%) | 70.0% | 80.0% |

## Oracle Headroom

- Pool oracle: 58/70 (82.9%)
- All systems wrong: 12/70 (17.1%)
- Delta vs train-calibrated scaffold: 14
- Delta vs best single system: 13
- Scaffold wrong but pool correct: 14
- Scaffold correct but some pool candidates wrong: 25

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote oracle as result: no
- Next step: Build a selector/verifier around candidate routing before more candidate generation.
