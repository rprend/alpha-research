# Evidence-First Contract Launch Packet

Generated: 2026-06-29T00:20:49.184Z

Status: `ready_for_bounded_evidence_first_smoke_after_price_check`

## Local Checks

- PASS bash_syntax_smoke_runner
- PASS python_syntax_validator
- PASS python_syntax_train
- PASS python_syntax_eval
- PASS dataset_validator

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Remote smoke next if spend is allowed: yes
- Reason: The evidence-first packet is now wired into a bounded runner and contract gate; paid judging remains forbidden until generated predictions pass the evidence-first gate.

The runner calls the evidence-first contract gate on generated predictions before any paid judging.
