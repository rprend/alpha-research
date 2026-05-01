# Dashboard Product Surface

The dashboard is the human and agent-facing control room for Alpha Research.

## Primary Jobs

- Start and continue RESEARCH CLI assistant sessions from the browser.
- Browse registered datasets and inspect deployment/profile state.
- Track remote runs by dataset, type, prompt, status, and timestamps.
- Open run details with observed progress, remote Codex transcript, and a resizable file explorer/viewer for produced run artifacts.
- Inspect terminal sessions proxied through Alpha Research.

## Dataset Inventory Expectations

- The datasets page should answer three questions at a glance: what this dataset is about, whether it is usable now, and whether it is public or private.
- Dataset cards should use user-language readiness labels such as `Ready for research` or `Still building`, not raw lifecycle wording alone.
- Inventory copy in harness mode should still read like product copy, not internal QA or fixture text.
- Private and public groupings should remain visible even when one group is empty so absence is not ambiguous.

## Dataset Detail Expectations

- The dataset detail page should answer trust-and-fit questions before it exposes implementation details.
- The top of the page should state what the dataset is good for, where it came from, how fresh it is, and the main limitation.
- Summary metrics should explain the actual source, tables, formats, and limits, not only show counts.
- The primary reading path should include the human-readable briefing, visible schema fields, and sample rows.
- Describe actions should explain whether they generate or refresh the briefing.
- Run ids, artifact ids, manifest paths, raw JSON payloads, and similar debugging material belong in a collapsed developer-only section.

## Assistant Home Expectations

- The signed-in assistant home is browser-first, not CLI-first. It should orient a user who only knows they want to do research.
- The page should expose one explicit first action: start a new research chat.
- The page should explain the surface model in plain language: chat for asking, datasets for source material, recent work for continuation.
- Signed-in account state must be visible without hunting in footer chrome.
- Recent items should read like understandable work records, not raw run-lifecycle labels.

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
