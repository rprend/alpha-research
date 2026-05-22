# Canonical Agent Demo: Housing Affordability

This Phase 1 demo shows why Alpha Research belongs inside a coding agent: the agent discovers the right dataset, plans remote work, asks for approval, monitors execution, and summarizes durable artifacts back into the coding session.

## Demo Dataset

- Dataset id: `housing-affordability`
- Domain: housing
- Sources: HUD Fair Market Rents plus Census/ACS income and rent-burden context
- Grain: county-year
- Time coverage: 2018-2024
- Canonical public page: `/canonical-datasets/housing-affordability.html`
- Harness completed run: `/?harness=1&view=runs&runId=run-harness-housing-completed`
- Harness running run: `/?harness=1&view=runs&runId=run-harness-housing-running`
- Harness remote session: `/?harness=1&view=terminal-sessions&sessionId=session-harness-housing-remote`
- Public production run link: `pending-live-run`
- Live bootstrap execution: `5ba401e3-5b25-4301-aee0-eb5fddac3179`

## Known-Good Questions

1. Where did rental affordability pressure worsen most from 2018 to 2024?
   Known-good output: Miami-Dade County, FL ranks first with `pressure_score` 91.4 and `rent_to_income_ratio` increasing from 0.38 to 0.49.
2. Which counties show high Fair Market Rent growth but only moderate severe rent burden?
   Known-good output: Travis County, TX is flagged as high-growth/moderate-burden because FMR growth is 39 percent while `severe_rent_burden_share` remains below the fixture median.
3. Which metro outliers should a housing policy analyst inspect first?
   Known-good output: Miami-Fort Lauderdale, Phoenix-Mesa, and Tampa-St. Petersburg are the top three metro contexts by `pressure_score`.
4. What limitation should accompany county comparisons?
   Known-good output: compare changes and ranks, not exact affordability levels, when ACS renter-income estimates are suppressed or have wide margins of error.

## Golden Workflow

1. User says: “Use Alpha Research to investigate where rental affordability pressure worsened most from 2018-2024.”
2. Agent lists datasets.
3. Agent selects `housing-affordability`.
4. Agent drafts the remote run prompt and asks for approval.
5. User approves.
6. Remote run starts.
7. Dashboard shows live status, current phase, latest event, and saved partial artifacts.
8. Final artifacts appear: `report.html`, `work.md`, `result.json`, and `source_inventory.csv`.
9. Agent resumes from artifacts and summarizes the result with limitations attached.

## Repo-Local Harness Command

```bash
VITE_ALPHA_RESEARCH_HARNESS=1 pnpm dev
```

Open these paths after the dev server starts:

```text
http://127.0.0.1:5173/?harness=1&view=datasets&topic=housing-affordability
http://127.0.0.1:5173/?harness=1&view=runs&runId=run-harness-housing-completed
http://127.0.0.1:5173/?harness=1&view=runs&runId=run-harness-housing-running
```

## 2-Minute Video Script

0:00-0:15: Open Codex Desktop. Say: “I am starting with a broad research request, not a dataset id: use Alpha Research to investigate where rental affordability pressure worsened most from 2018 to 2024.”

0:15-0:35: Show the agent listing datasets. Say: “The agent does not guess. It asks Alpha Research what datasets exist, reads the dataset briefing, and selects Housing Affordability because it has HUD Fair Market Rent and ACS income context.”

0:35-0:55: Show the approval-gated plan. Say: “Before spending remote worker time, the agent turns the conversation into an explicit run prompt and asks for approval.”

0:55-1:20: Show the dashboard running state. Say: “The run is remote. The dashboard shows that the worker is alive, what phase it is in, and whether artifacts have already been saved.”

1:20-1:45: Open the completed run artifacts. Say: “When the run finishes, the answer is durable. The report is first, the structured JSON is inspectable, and the work log explains what the agent did.”

1:45-2:00: Return to Codex summary. Say: “The coding agent resumes from those artifacts and summarizes the result with limitations. Research work becomes inspectable state the agent can operate.”

## 5-Minute Technical Walkthrough

1. Run `VITE_ALPHA_RESEARCH_HARNESS=1 pnpm dev`.
2. Open `http://127.0.0.1:5173/?harness=1&view=datasets&topic=housing-affordability` and show that the dataset inventory recommends the housing dataset.
3. Open `http://127.0.0.1:5173/?harness=1&view=runs&runId=run-harness-housing-completed` and show `report.html`, `work.md`, and `result.json`.
4. Open `http://127.0.0.1:5173/?harness=1&view=runs&runId=run-harness-housing-running` and show live status and latest runner evidence.
5. Open `http://127.0.0.1:5173/?harness=1&view=terminal-sessions&sessionId=session-harness-housing-remote` and explain that transcript entries are audit context while artifacts remain the primary result path.
6. Show the production run link once available: `pending-live-run`. The live canonical dataset bootstrap is currently tracked as remote execution `5ba401e3-5b25-4301-aee0-eb5fddac3179`.

## Acceptance Check

A skeptical engineer should be able to inspect the demo and say: “I understand why this belongs inside a coding agent.”
