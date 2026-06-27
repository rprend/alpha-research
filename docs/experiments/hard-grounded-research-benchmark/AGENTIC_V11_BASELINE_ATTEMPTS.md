# Agentic V11 Baseline Attempts

This note records frontier-agent baseline attempts for the v11 candidate.

## Codex CLI GPT-5.5 Attempt

- Date: 2026-06-27
- CLI: `codex-cli 0.142.2`
- Model requested: `gpt-5.5`
- Workspace: `/tmp/hgr-agentic-v11-codex-run`
- Transcript: `agentic-v11-runs/codex-cli-gpt-5-5-v11-full/transcript.txt`
- Result: not eligible

The run started as a full 200-task no-gold workspace attempt. Codex created a workspace-local solver script, but the script delegated per-task answering to a local `ollama run llama3.2:3b` call and became slow/unreliable. The run was stopped after it had written only 9 `answer.json` files. Because it did not complete all 200 tasks, it is not packaged as an eligible scored frontier baseline.

## Remaining Baseline Requirement

V11 still needs two eligible full-workspace frontier-agent runs before buyer-grade claims:

- Codex CLI with the strongest available OpenAI model.
- Claude Code with the strongest available Anthropic model.
