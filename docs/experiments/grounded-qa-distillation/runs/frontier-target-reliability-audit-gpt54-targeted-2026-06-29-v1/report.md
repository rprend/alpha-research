# Frontier Target Reliability Audit

Generated: 2026-06-29T00:55:12.231Z

Status: `diagnostic_targets_over_answer_relative_to_evidence`

## Source Runs

- Frontier: `openai-evidence-first-frontier-gpt54-targeted-2026-06-29-v1`
- Contract gate: `openai-evidence-first-frontier-gpt54-targeted-2026-06-29-v1-evidence-first-contract-gate`
- Judge: `openai-judge-frontier-gpt54-targeted-2026-06-29-v1`

## Metrics

- Examples: 10
- Contract overall correct: 30.0%
- Contract evidence-first valid: 100.0%
- Contract answer type accuracy: 40.0%
- Judge overall correct: 100.0%
- Judge abstention support: 100.0%
- Contract failures judged correct: 7
- Target answerability conflicts: 6

## Interpretation

Do not use the 10-row evidence-first diagnostic target as a sole ground truth for answerability. It is useful for schema/citation shape checks only after target reliability repair.

Build a target-reliability repair packet: adjudicate answerability before using targets for student training or contract pass/fail. Prefer frontier/judge-agreed evidence-first traces as teacher data.

## Decision

- Promote frontier teacher traces now: no
- Buy more OpenAI judgments now: no
- Launch Prime now: no
- Repair diagnostic targets next: yes
- Reason: Frontier predictions pass the independent judge but fail the target-based contract mostly by abstaining where the target expects answers.
