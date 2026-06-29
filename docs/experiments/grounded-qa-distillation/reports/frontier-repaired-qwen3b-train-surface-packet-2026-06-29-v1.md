# Frontier Repaired Qwen3B Launch Packet

Generated: 2026-06-29T05:50:00.923Z

Status: `ready_for_bounded_repaired_qwen3b_smoke_after_fresh_price_gate`

## Examples

- SFT train: 223
- SFT validation: 70
- DPO train: 223
- DPO validation: 70
- Eval prompts: 223
- Eval targets: 223

## Local Checks

- PASS bash_syntax_smoke_runner
- PASS python_syntax_validator
- PASS python_syntax_train
- PASS python_syntax_eval
- PASS dataset_validator

## Decision

- Launch Prime now: no
- Run fresh Prime price gate next: yes
- Buy OpenAI judgments now: no
- Reason: The repaired Qwen3B packet is executable, but pod creation should be gated by a fresh Prime price/auth check and deterministic validation acceptance.
