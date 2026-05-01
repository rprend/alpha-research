# Dashboard Product Surface

The dashboard is the human and agent-facing control room for Alpha Research.

## Primary Jobs

- Start and continue RESEARCH CLI assistant sessions from the browser.
- Give prepared users a launch-ready assistant entry that surfaces active dataset context, preserved run requirements, and where run status/artifacts will appear after submit.
- Browse registered datasets and inspect deployment/profile state.
- Track remote runs by dataset, type, prompt, status, and timestamps.
- Open run details with observed progress, remote Codex transcript, and a resizable file explorer/viewer for produced run artifacts.
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
- Open a seeded run and inspect progress, produced files, and rendered markdown/JSON/code previews.
- Use screenshots or DOM snapshots to validate UI changes.
- Only use production APIs when the task explicitly requires production behavior.

## Journey Evaluation

Dashboard journey evaluation extends harness validation with canonical UX journeys in `docs/dashboard-journey-eval.md`. Run capture with `pnpm run journey:dashboard:capture` to collect deployed-dashboard screenshots, visible text snapshots, DOM snapshots, and videos. Run judging separately with `pnpm run journey:dashboard:judge` so product evidence collection stays independent from recommendation generation.
