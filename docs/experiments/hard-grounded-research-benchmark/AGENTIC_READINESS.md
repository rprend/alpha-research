# Agentic Readiness

This gate checks whether the benchmark has evidence for the new objective: frontier tool-using agents must run over the large-corpus agentic suite and measurably fail or succeed under deterministic scoring.

## Status

- Suite: agentic-large-corpus-research-v3
- Tasks: 200
- Required eligible frontier agent runs: 2
- Eligible frontier agent runs: 2
- Ready: true
- Completion claim allowed: true

## Run Manifests

| Run | Agent surface | Model | Model/version | Tasks | Eligible | Rejection reasons |
| --- | --- | --- | --- | ---: | --- | --- |
| claude-code-opus-v2-final | Claude Code | opus | opus<br>claude-opus-4-7 via Claude Code 2.1.118 | 10 | no | wrong_evaluation_source<br>task_count_mismatch
| claude-code-opus-v3-full | Claude Code | opus | opus<br>claude-opus-4-7 via Claude Code 2.1.118 | 200 | yes | none
| codex-cli-gpt-5-5-v2-final | Codex CLI | gpt-5.5 | gpt-5.5<br>gpt-5.5 via codex exec v0.142.2 | 10 | no | wrong_evaluation_source<br>task_count_mismatch
| codex-cli-gpt-5-5-v3-full | Codex CLI | gpt-5.5 | gpt-5.5<br>gpt-5.5 via codex exec v0.142.2 | 200 | yes | none |

## Eligible Run Contract

An eligible run must be a real tool-using agent run. It must name the agent surface, exact model/version or snapshot, inference date, frontier-model attestation, tools enabled, transcript path, scored report path, task count, and hidden-gold access. Single-call packet runs are not eligible.
