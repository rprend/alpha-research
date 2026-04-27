# Dashboard Product Surface

The dashboard is the human and agent-facing control room for Alpha Research.

## Primary Jobs

- Start and continue RESEARCH CLI assistant sessions from the browser.
- Browse registered datasets and inspect deployment/profile state.
- Track remote runs by dataset, type, prompt, status, and timestamps.
- Open run details with observed progress, remote Codex transcript, and artifacts.
- Inspect terminal sessions proxied through Alpha Research.

## Harness Mode

The dashboard supports a deterministic local harness mode for agent QA:

```bash
VITE_ALPHA_RESEARCH_HARNESS=1 pnpm dev
```

Harness mode bypasses production auth/data requirements and renders seeded datasets, runs, artifacts, events, and sessions. It is intended for Codex/browser validation and should stay deterministic.

## Expected Agent Workflows

- Open the dashboard in harness mode.
- Verify datasets, runs, and terminal sessions render.
- Open a seeded run and inspect progress/artifacts.
- Use screenshots or DOM snapshots to validate UI changes.
- Only use production APIs when the task explicitly requires production behavior.
