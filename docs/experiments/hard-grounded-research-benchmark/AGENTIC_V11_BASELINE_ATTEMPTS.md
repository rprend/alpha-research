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

## Codex CLI GPT-5.5 Clean Run

- Date: 2026-06-27
- CLI: `codex-cli 0.142.2`
- Model requested: `gpt-5.5`
- Workspace: `/tmp/hgr-agentic-v11-codex-run-clean`
- Transcript: `agentic-v11-runs/codex-cli-gpt-5-5-v11-clean/transcript.txt`
- Result: eligible

The clean run completed all 200 no-gold workspaces without hidden-gold access. The run manifest records the exact command transcript, model attestation, tool permissions, and hidden-gold status. Hidden deterministic scoring produced 7.5% answer membership and 38.25% required-evidence recall.

## Claude Code Opus Attempts

### Manual Inspection Attempts

- Date: 2026-06-27
- CLI: `Claude Code 2.1.118`
- Model requested: `opus`
- Model reported: `claude-opus-4-7`
- Transcripts:
  - `agentic-v11-runs/claude-code-opus-v11-clean/transcript.jsonl`
  - `agentic-v11-runs/claude-code-opus-v11-script/transcript.jsonl`
- Result: not eligible

These runs inspected tasks manually and did not write 200 answer files, so they are retained only as failed attempt evidence.

### Minimal Script Run

- Date: 2026-06-27
- CLI: `Claude Code 2.1.118`
- Model requested: `opus`
- Model reported: `claude-opus-4-7`
- Workspace: `/tmp/hgr-agentic-v11-claude-minimal-run`
- Transcript: `agentic-v11-runs/claude-code-opus-v11-minimal/transcript.jsonl`
- Result: eligible

This run completed all 200 no-gold workspaces and is scored as the Anthropic frontier-agent baseline. The prompt asked Claude to make its first action a batch solver script, but the transcript shows it first inspected directory, task, schema, and corpus structure, then wrote and ran `solve_tasks.py`. The manifest therefore records filesystem/Bash/Write tool use rather than a pure Bash-only protocol. Hidden deterministic scoring produced 0% answer membership and 0% required-evidence recall.

## Current Baseline Status

V11 now has two eligible full-workspace frontier-agent runs:

- Codex CLI `gpt-5.5`: 7.5% answer membership, 38.25% required-evidence recall.
- Claude Code `claude-opus-4-7`: 0% answer membership, 0% required-evidence recall.
