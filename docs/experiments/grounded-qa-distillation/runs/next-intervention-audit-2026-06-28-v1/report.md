# Next Intervention Audit

Generated: 2026-06-28T23:38:45.458Z

Status: `needs_new_contract_before_paid_gpu`

## Current Blockers

- trained_qwen3b_student_positive
- qwen7b_support_delta_positive
- judge_reliability_submission_ready

## Evidence

- Selector branches negative: yes
- Known paid generator branches negative: yes
- Backend ready: yes
- Budget under cap: yes

## Decision

- Launch Prime now: no
- Buy OpenAI labels now: no
- Run another local selector now: no
- Run repeated Qwen 3B/7B packet now: no
- Use Prime when new contract preflight passes: yes
- Reason: The currently available selectors fail end-to-end support, Qwen 3B repair fails the shape gate, and the latest Qwen 7B support-delta result does not beat the calibrated hybrid. Prime is available and budget-safe, but there is no untested launch packet worth renting for until the output contract changes.
- Next step: Design and validate a new evidence-first generation contract that forces cited claim planning before answer text, then run only a local/fixture shape preflight before any Prime launch.

No OpenAI calls, no GPU jobs, and no new spend were made.
