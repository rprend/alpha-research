# Agentic V8 Claude Code Attempts

These are diagnostic Claude Code opus attempts against the v8 no-gold workspaces. They are not counted as eligible frontier baselines.

## Full 200-Task Attempts

- Surface: Claude Code
- CLI version: 2.1.118
- Model accepted by CLI: `opus`; verbose stream reported `claude-opus-4-7`
- Workspace: `/tmp/hgr-agentic-v8-claude-run`
- Hidden gold access: false
- Result: not eligible

Two full-run prompts were attempted. The first all-task prompt and a script-first prompt produced no answer files or transcript output before interruption. A later verbose forced-script attempt did start Claude Code, but it inspected task files and corpus snippets manually instead of creating and running a batch solver script as instructed. It was interrupted before any `answer.json` files were written.

Evidence:

- `agentic-v8-runs/claude-code-opus-v8-attempts/forced-script-interrupted-transcript.jsonl`

## Single-Task Smoke

A one-task smoke run completed successfully and wrote one `answer.json`, proving Claude Code could access and operate on the no-gold workspace. It is not an eligible baseline because it covers 1/200 tasks.

Evidence:

- `agentic-v8-runs/claude-code-opus-v8-attempts/single-task-smoke-transcript.jsonl`

## Interpretation

The current v8 readiness gate remains false. V8 has one eligible Codex CLI frontier run, but no eligible Claude Code full-suite run. The Claude attempts are useful diagnostic evidence about tool-use behavior on the corpus format, not a substitute for the required second scored baseline.
