# Dashboard Product Surface

The dashboard is the human and agent-facing control room for Alpha Research.

## Primary Jobs

- Explain the public product clearly before sign-in: Alpha Research is a research platform plus CLI for asking questions over large datasets, reviewing evidence, and running traceable analyses on public or private corpora.
- Start and continue RESEARCH CLI assistant sessions from the browser.
- Browse registered datasets and inspect deployment/profile state.
- Track remote runs by dataset, type, prompt, status, and timestamps.
- When an assistant session starts a remote run, keep the user in the session and render the run as an inline live block that shows current status, latest tool/command activity, cancel affordance while active, and the final human-readable artifact when complete.
- Open run details with observed progress, remote Codex transcript, and a resizable file explorer/viewer for produced run artifacts.
- Direct run links from CLI or other surfaces should land on a run header that immediately shows the dataset, run type, status, prompt, run id, and produced artifact names without requiring extra navigation.
- Completed run detail should lead with the result hierarchy: a plain-language finished state, `report.html` as the primary answer artifact, `result.json` as the structured companion, and a labeled `Artifacts (n)` control.
- Completed run detail should also keep an always-visible audit summary above the transcript: original prompt, dataset, run type, status, requested artifacts, produced artifacts, and the latest timeline evidence.
- The artifact panel for completed runs should read like a results view, not a raw file browser: show the original request, promote `report.html` first, surface `result.json` second, keep `work.md` plus figures/tables/scripts/queries as supporting files, and provide a direct download affordance on the selected artifact.
- If a completed run also has a remote Codex session, expose it inside the artifact panel as optional advanced debugging with explicit copy such as `Open remote Codex session`; normal artifact review must remain the primary reading path.
- Transcript branch controls must explain what they are navigating. Avoid unlabeled counters such as `2 / 2`; use explicit copy such as `Branch 2 of 2`.
- Running run detail should lead with liveness: an explicit `Run is alive` verdict, the current phase in plain English, humanized heartbeat recency, and an explicit auto-refresh cue.
- On phone-sized viewports, running run detail should keep the first screen focused on the quick answer: status, phase, latest evidence freshness, and a labeled `Artifacts` action. Debug metadata and transcript utilities should stay secondary.
- Running run detail must also surface a visible guarded cancel action when the run is still active, explain whether any saved artifacts already exist, and say plainly what cancellation preserves, what it stops, and that it is not reversible.
- Stalled or uncertain run detail should lead with diagnosis: a plain-language verdict such as `Worker lost connection`, the last evidence timestamp, explicit artifact presence or absence, and labeled next actions such as `Retry in chat`, `Inspect artifacts`, or `Show debug details`.
- Failed or uncertain run detail should preserve salvage value before raw logs: separate `What completed`, `What is missing`, `Can you trust saved output?`, `What happened`, and `Recommended next move`.
- The artifacts surface for a failed or uncertain run must list expected outputs even when no files were produced, so the user can see what was recovered versus what was lost.
- Inspect terminal sessions proxied through Alpha Research.
- Admin-only operators can open an operations overview that lists all user runs, chat sessions, users, costs, usage totals, and admin-owned canonical dataset executions with progress logs.

## Admin Expectations

- The admin overview must never render for non-admin sessions; access is controlled by the signed-in email allowlist, not a browser-exposed token.
- Runs and chat sessions should show owner, status, linked dataset/run context, cost, token usage, and recent progress or transcript size.
- Admin sessions are the default admin subview. Session cost should include direct chat usage plus costs from every run linked to that session, and linked runs should be visible as navigable run references.
- Admin session rows should link to the full session transcript, and linked runs should open their run logs for admin users.
- User rows should aggregate signup day, total cost, runs per user, active runs, sessions, datasets, subscription state, and last activity.
- Canonical dataset executions should show status, dataset id, artifacts, progress logs, and whether work is still active.
- Admin overview sections should be separate subviews navigated from the top of the admin page, not stacked tables.

## Terminal Session Expectations

- The terminal session page should read like continuity for a run, not like detached infrastructure logs.
- Before turns arrive, the page should show a syncing/loading state instead of implying the session is empty or missing.
- The header should explain what run the session belongs to, when it last updated, and whether the transcript is still syncing or complete.
- Command/output/synthesis content should remain easy to scan, while raw session ids stay secondary.
- If the session produced durable outputs such as `work.md` or `result.json`, the page should expose direct artifact affordances without forcing the user to infer where those files live.

## Runs Inventory Expectations

- The runs page should behave like a triage surface, not a neutral event log.
- The runs page is labeled `Remote runs` in navigation and page headers.
- The runs page should share the dataset inventory structure: section header, two-column icon-led rows, title, one-sentence description, dataset, type, and freshness.
- Default ordering should put risky or still-active work ahead of stale completed work.
- Every row should lead with the underlying question or run title so repeated dataset names do not read like duplicates.
- Each run should persist a generated title and one-sentence description; active runs may use prompt-based fallbacks, and terminal callbacks should refresh the label from the run prompt, status/output preview, recent events, artifacts, and dataset context.
- Status styling should encode urgency and explain unclear failure states such as `Worker Unreachable` in plain language.
- Runs inventory should expose an explicit outcome/result signal such as `Artifacts ready`, `No outputs recovered`, or `Watching for outputs`, not just raw status.
- Completed runs should indicate whether artifacts or linked sessions exist so a user can tell if there is anything worth opening.
- When several successful runs are visible, the newest completed candidate should be called out explicitly.
- In-progress runs should read like live monitors rather than developer inspectors; raw config, run ids, runner ids, and other diagnostics belong in collapsed or secondary treatment.
- The primary action to open the run should read like the next step, not like incidental table chrome.

## Dataset Inventory Expectations

- The datasets page should answer three questions at a glance: what this dataset is about, whether it is usable now, and whether it is public or private.
- Dataset cards should use user-language readiness labels such as `Ready for research` or `Still building`, not raw lifecycle wording alone.
- Inventory copy in harness mode should still read like product copy, not internal QA or fixture text.
- Private and public groupings should remain visible even when one group is empty so absence is not ambiguous.
- When the dashboard receives a topic hint such as `?topic=housing-affordability`, the page should pivot from neutral inventory to guided selection: show a topic-aware header, rank likely matches, explain coverage/freshness/limitations, and recommend one next action without requiring dataset ids.
- A zero-dataset workspace should read as a normal starting state, not an error or sync mystery.
- The zero-dataset state should show the fastest setup path, the exact inputs required next, and a direct CLI or setup-help handoff without forcing prior product knowledge.
- An authenticated data-load failure must not reuse zero-dataset copy or layout. The page should say that sign-in succeeded, that dataset availability could not be verified, and that retry/support actions are available.

## Dataset Detail Expectations

- The dataset detail page should render the dataset inventory briefing text itself as plain text.
- The detail page should not add trust-summary filler, briefing status filler, starter prompts, dataset-scoped asking instructions, file tables, metadata tables, cards, borders, or background panels around the inventory briefing.
- If an inventory briefing is not available yet, the page may fall back to the inventory summary, profile summary, or dataset description as plain text.
- The left sidebar recent chat history should remain visible on dataset detail pages so the user can navigate back to prior sessions while inspecting a dataset.
- Another active run on the same dataset should not add a blocking conflict card to the dataset detail page.

## Assistant Home Expectations

- The signed-in assistant home is browser-first, not CLI-first. It should orient a user who only knows they want to do research.
- The page should expose one explicit first action: draft a plan before work starts.
- Remote run launches from assistant chat should be approval-gated: first generate a plain-text prompt from the session history, show it to the user, and only start the run after explicit approval.
- The same page should also support prepared users who already have a full research specification: it should explain that a complete spec can be pasted directly, that only field-resolution questions should interrupt launch, and that the next state will show run id, status, expected artifacts, and destination.
- Run-launch responses should not redirect away from chat. The run block in the assistant transcript is the primary review path; full run pages remain secondary debugging and deep-link surfaces.
- The page should explain the surface model in plain language: chat for asking, datasets for source material, recent work for continuation.
- The page should explicitly reassure the user that they can start in the dashboard without CLI setup.
- The page should show whether sample data is ready and what that sample is for.
- The page should include example first prompts so the user can see what a successful first action looks like.
- For vague-intent journeys, the page should surface a compact proposed-plan block with likely dataset context, operational choices, and explicit confirmation language before expensive work.
- Signed-in account state must be visible without hunting in footer chrome.
- Recent items should read like understandable work records, not raw run-lifecycle labels.
- Recent work should stay secondary on first visit and not crowd out onboarding copy.
- Reopened assistant threads should lead with a compact continuity card: human-readable title, last activity time, dataset or corpus target, linked run status, a short recap, and explicit actions to continue the thread or inspect results without remembering ids.
- New assistant threads should be renamed after the first user message and assistant response with a model-generated title under five words; active linked runs should show a lightweight spinner in recent chats.
- The assistant transcript scroll target should include the empty gutter around the main message column so users do not need to hover directly over text to scroll a session.

## Signed-Out Gate Expectations

- A signed-out dashboard visit should read as a recoverable gate, not a broken or partially loaded workspace.
- Signed-out dashboard visits should stay inside the main product shell, with the sidebar and new-chat composer visible.
- The primary action should be one clear `Sign in` button on the new-chat page.
- Signed-out copy should avoid internal terms such as RESEARCH CLI sessions or terminal history unless that context is essential to the recovery step.
- If the user opened a deep link to a dashboard, run, dataset, or session, the sign-in flow should preserve that destination and say so in plain language.
- Signed-out views should avoid extra labels, icons, and explanatory blocks that make the state feel separate from the product.
- The signed-out path should not probe protected dashboard data endpoints before redirecting or rendering the gate.

## Public Homepage Expectations

- The first viewport must answer four questions without prior context: what Alpha Research is, who it is for, what kind of output it produces, and what the next step should be.
- Public homepage copy should avoid ambiguous branding or unexplained sub-brands in primary navigation and hero content.
- The primary CTA for a new visitor should help them understand or inspect the product before sales or consulting language takes over.
- The page should show at least one concrete example workflow or output artifact above the fold so skeptical researchers can map claims to real work.
- Hosted public examples, CLI self-serve for private datasets, and optional human setup help should be visibly distinct paths rather than blended into one generic pitch.
- For visitors with private, proprietary, or enterprise data, the first viewport should also expose a human-assisted setup path with clear booking/contact actions and a short explanation of what the setup help covers.
- The homepage should include an explicit proof path for skeptical visitors: dataset, example question, and inspectable output/artifact.
- Live examples and planned datasets should be visually separated and labeled so roadmap items do not read like current proof.
- The page should tell a skeptical visitor what to inspect next in a clear sequence before asking them to sign in or talk to sales.

## Public CLI Page Expectations

- The public CLI page must lead with the exact install command, not product framing or agent prompt copy.
- The first screen should explain prerequisites, browser sign-in behavior, dataset input shape, and what success looks like after `research` starts.
- The page must say plainly what stays local, what gets uploaded when a dataset is created, and where resulting dataset ids, run ids, logs, and artifacts will appear.
- Copyable install and agent-prompt affordances should be visible and keyboard-accessible.
- Agent-assisted setup should stay secondary to the self-serve install-and-run path.

## Public Privacy Page Expectations

- The privacy page must answer current-state trust questions in plain English before a user signs in or uploads anything.
- The first viewport should make three things explicit: what is collected today, what is not collected on the public page, and how to contact Alpha Research before sharing sensitive data.
- The page should explain public-site logging separately from dashboard or CLI-authenticated product storage.
- If retention windows or deletion workflows are not yet self-serve, the page should say that directly instead of using placeholder future-policy language.
- Public trust pages should avoid ambiguous or legacy branding in primary navigation.

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
- For completed runs with artifacts, confirm the page explicitly tells the user which file to read first and labels supporting artifacts as secondary.
- Use screenshots or DOM snapshots to validate UI changes.
- Only use production APIs when the task explicitly requires production behavior.

## Journey Evaluation

Dashboard journey evaluation extends harness validation with canonical UX journeys in `docs/dashboard-journey-eval.md`. Run capture with `pnpm run journey:dashboard:capture` to collect deployed-dashboard screenshots, visible text snapshots, DOM snapshots, and videos. Run judging separately with `pnpm run journey:dashboard:judge` so product evidence collection stays independent from recommendation generation.
