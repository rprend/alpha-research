# Dashboard Product Surface

The dashboard is the human and agent-facing control room for Alpha Research.

## Primary Jobs

- Start and continue RESEARCH CLI assistant sessions from the browser.
- Browse registered datasets and inspect deployment/profile state.
- Track remote runs by dataset, type, prompt, status, and timestamps.
- Open run details with observed progress, remote Codex transcript, and a resizable file explorer/viewer for produced run artifacts.
- Completed run detail should lead with the result hierarchy: a plain-language finished state, the primary answer artifact, the structured companion if present, and a labeled `Artifacts (n)` control.
- Running run detail should lead with liveness: `Running`, a plain-English current step, humanized recency, an explicit auto-refresh cue, and a clear `no action needed` reassurance unless the product has evidence of trouble.
- Inspect terminal sessions proxied through Alpha Research.

## Terminal Session Expectations

- The terminal session page should read like continuity for a run, not like detached infrastructure logs.
- Before turns arrive, the page should show a syncing/loading state instead of implying the session is empty or missing.
- The header should explain what run the session belongs to, when it last updated, and whether the transcript is still syncing or complete.
- Command/output/synthesis content should remain easy to scan, while raw session ids stay secondary.
- If the session produced durable outputs such as `summary.md` or `result.json`, the page should expose direct artifact affordances without forcing the user to infer where those files live.

## Runs Inventory Expectations

- The runs page should behave like a triage surface, not a neutral event log.
- Default ordering should put risky or still-active work ahead of stale completed work.
- Every row should make the underlying question legible even when the same dataset appears multiple times.
- Status styling should encode urgency and explain unclear failure states such as `Worker Unreachable` in plain language.
- Completed runs should indicate whether artifacts or linked sessions exist so a user can tell if there is anything worth opening.
- In-progress runs should read like live monitors rather than developer inspectors; raw config, runner ids, and other diagnostics belong in collapsed or secondary treatment.
- The primary action to open the run should read like the next step, not like incidental table chrome.

## Dataset Inventory Expectations

- The datasets page should answer three questions at a glance: what this dataset is about, whether it is usable now, and whether it is public or private.
- Dataset cards should use user-language readiness labels such as `Ready for research` or `Still building`, not raw lifecycle wording alone.
- Inventory copy in harness mode should still read like product copy, not internal QA or fixture text.
- Private and public groupings should remain visible even when one group is empty so absence is not ambiguous.
- When the dashboard receives a topic hint such as `?topic=housing-affordability`, the page should pivot from neutral inventory to guided selection: show a topic-aware header, rank likely matches, explain coverage/freshness/limitations, and recommend one next action without requiring dataset ids.
- A zero-dataset workspace should read as a normal starting state, not an error or sync mystery.
- The zero-dataset state should show the fastest setup path, the exact inputs required next, and a direct CLI or setup-help handoff without forcing prior product knowledge.

## Dataset Detail Expectations

- The dataset detail page should answer trust-and-fit questions before it exposes implementation details.
- The top of the dataset page should also expose a dataset-scoped ask path so users can move directly from “this is the data” to “ask a grounded question about it.”
- Dataset-scoped asking should state plainly that the current dataset is attached automatically and the user does not need to copy an id or restate context.
- If the initial question is broad, the assistant should clarify scope before launching expensive work; the dataset page should say that up front.
- Before the user leaves the dataset page, the UI should explain the likely outputs from asking: direct answer, scoped plan, or a run with transcript and artifacts when work starts.
- The top of the page should state what the dataset is good for, where it came from, how fresh it is, and the main limitation.
- Summary metrics should explain the actual source, tables, formats, and limits, not only show counts.
- The primary reading path should include the human-readable briefing, visible schema fields, and sample rows.
- Describe actions should explain whether they generate or refresh the briefing, that they start async work, and that the resulting briefing/profile artifacts will appear in the run view and dataset detail.
- Run ids, artifact ids, manifest paths, raw JSON payloads, and similar debugging material belong in a collapsed developer-only section.

## Assistant Home Expectations

- The signed-in assistant home is browser-first, not CLI-first. It should orient a user who only knows they want to do research.
- The page should expose one explicit first action: draft a plan before work starts.
- The same page should also support prepared users who already have a full research specification: it should explain that a complete spec can be pasted directly, that only field-resolution questions should interrupt launch, and that the next state will show run id, status, expected artifacts, and destination.
- The page should explain the surface model in plain language: chat for asking, datasets for source material, recent work for continuation.
- The page should explicitly reassure the user that they can start in the dashboard without CLI setup.
- The page should show whether sample data is ready and what that sample is for.
- The page should include example first prompts so the user can see what a successful first action looks like.
- For vague-intent journeys, the page should surface a compact proposed-plan block with likely dataset context, operational choices, and explicit confirmation language before expensive work.
- Signed-in account state must be visible without hunting in footer chrome.
- Recent items should read like understandable work records, not raw run-lifecycle labels.
- Recent work should stay secondary on first visit and not crowd out onboarding copy.

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
- For dataset describe runs, confirm the run view calls out the briefing destination and exposes a primary `Open briefing artifact` action without requiring the artifact drawer icon.
- For completed runs with artifacts, confirm the page explicitly tells the user which file to read first and labels supporting artifacts as secondary.
- Use screenshots or DOM snapshots to validate UI changes.
- Only use production APIs when the task explicitly requires production behavior.

## Journey Evaluation

Dashboard journey evaluation extends harness validation with canonical UX journeys in `docs/dashboard-journey-eval.md`. Run capture with `pnpm run journey:dashboard:capture` to collect deployed-dashboard screenshots, visible text snapshots, DOM snapshots, and videos. Run judging separately with `pnpm run journey:dashboard:judge` so product evidence collection stays independent from recommendation generation.
