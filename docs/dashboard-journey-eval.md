# Dashboard Journey Evaluation

This document mirrors the CLI journey-evaluation workflow for the Alpha Research dashboard. The capture run and the judge run are intentionally separate.

Default target:

```text
https://dashboard.alpharesearch.nyc/?harness=1
```

Harness mode uses the deployed dashboard UI with deterministic datasets, runs, artifacts, events, and terminal sessions. Use `--base-url=` or `DASHBOARD_JOURNEY_BASE_URL` to point the same journeys at another dashboard host.

## Capture Contract

Run capture only:

```bash
pnpm run journey:dashboard:capture -- --journeys=D01,D02
```

The runner creates one directory per journey:

```text
.tmp/dashboard-journey-runs/<journey-id>/<timestamp>/
  journey.md
  input.json
  events.jsonl
  metadata.json
  screenshots/
    0000-start.png
    0001-step-1.png
    ...
  snapshots/
    0000-start.txt
    0000-start.html
    ...
  videos/
    <playwright-video>.webm
  index.html              # written at .tmp/dashboard-journey-runs/index.html
```

Screenshots and video are captured from the actual rendered dashboard. Text snapshots preserve visible transcript-like UI text, while HTML snapshots make exact rendered state auditable.

The capture runner also writes `.tmp/dashboard-journey-runs/index.html`, a browsable report with final screenshots, recordings, visible-text previews, journey definitions, event logs, and judge briefings when present.

Useful capture options:

```bash
DASHBOARD_JOURNEY_SNAPSHOT_MS=2500 pnpm run journey:dashboard:capture -- --journeys=D06
pnpm run journey:dashboard:capture -- --base-url=http://127.0.0.1:4173 --journeys=D01,D02
pnpm run journey:dashboard:capture -- --headed --journeys=D03
```

## Judge Contract

Run judging after capture:

```bash
pnpm run journey:dashboard:judge -- --journeys=D01,D02
```

The judge reads the latest captured run for each selected journey and writes:

```text
briefing.md
judge.log
index.html              # refreshed at the output root
```

To judge exact run directories instead of latest-by-journey:

```bash
pnpm run journey:dashboard:judge -- --runs=.tmp/dashboard-journey-runs/D01/20260501T120000Z
```

## Remediation Contract

After capture and judge have produced `briefing.md` files, generate remediation jobs:

```bash
pnpm run journey:dashboard:remediate -- --dry-run
```

By default, dry run writes one prompt per journey under:

```text
.tmp/dashboard-journey-remediation/jobs/<journey-id>/prompt.md
```

Each prompt includes the journey definition, captured run metadata, the full judge briefing, and instructions to update Alpha Research so the journey aligns with expectations in future runs.

To execute Codex jobs in isolated git worktrees:

```bash
pnpm run journey:dashboard:remediate -- --execute --journeys=D11,D12
```

To start background jobs and return immediately:

```bash
pnpm run journey:dashboard:remediate -- --detach --only-verdicts=fail
```

The worktree mode creates one branch and worktree per journey:

```text
.tmp/dashboard-journey-remediation/worktrees/<journey-id>/
codex/dashboard-journey-<journey-id>-remediation
```

Job status and Codex logs are written next to the generated prompt:

```text
.tmp/dashboard-journey-remediation/jobs/<journey-id>/status.json
.tmp/dashboard-journey-remediation/jobs/<journey-id>/codex.log
```

## Global Rubric

For every dashboard journey, judge:

- User input burden: clicks, hidden ids, internal terms, or prior CLI knowledge required.
- Intent recognition: whether the visible dashboard state matches the user goal.
- State clarity: whether the user can tell if work is ready, running, blocked, failed, uncertain, or complete.
- Displayed information: visible datasets, statuses, prompts, run links, transcripts, artifacts, and account state.
- Information density: whether the screen shows too little, the right amount, or too much detail.
- Recovery clarity: for auth, failed, stuck, or busy states, whether the next action is obvious.
- Artifact clarity: whether produced and requested artifacts are discoverable and understandable.
- Continuity: whether the user can resume from chats, runs, and terminal sessions without remembering exact ids.
- Pass/fail: whether the journey met the correct outcome.

## Journeys

The canonical journey definitions live in `scripts/dashboard-journeys.mjs`.

Each journey is deliberately framed in two layers:

- Product step: the product job Alpha Research needs to help the user accomplish.
- User mind: what the user actually knows, assumes, fears, and does not know when they arrive.

Judging should evaluate whether the rendered dashboard moves the user from the entry mental state toward the correct product step. For example, `D11: Choose The Right Dataset` is not judged as “does a dataset list exist?” It is judged as “does the page help a user who only knows they want to study housing affordability choose or discover the right data without knowing dataset ids?”

Current journey coverage:

- `D01` Dashboard Orientation
- `D02` Dataset Inventory
- `D03` Dataset Detail And Briefing
- `D04` Start Dataset Describe From Detail
- `D05` Runs Inventory
- `D06` Completed Run Transcript And Artifacts
- `D07` Running Run Status
- `D08` Terminal Session Continuity
- `D09` First-Time Signed-In Landing
- `D10` No Datasets Yet
- `D11` Choose The Right Dataset
- `D12` Ask A Question Against A Dataset
- `D13` Convert Vague Intent Into A Plan
- `D14` Launch A Well-Specified Run
- `D15` Is My Run Alive
- `D16` Why Is This Run Stuck
- `D17` Failed Run Salvage
- `D18` Inspect Produced Artifacts
- `D19` Original Prompt Traceability
- `D20` Resume Last Research Thread
- `D21` Compare Recent Runs
- `D22` Dataset Freshness
- `D23` Data Trust And Provenance
- `D24` Signed-Out Dashboard Visit
- `D25` Signed In But Data Fails To Load
- `D26` Busy Dataset Conflict
- `D27` Cancel A Running Job
- `D28` Open Dashboard Link From CLI
- `D29` Open Remote Codex Session
- `D30` Mobile Run Check-In
- `D31` Public Homepage Product Understanding
- `D32` CLI Install And Bring-Your-Own-Dataset
- `D33` Skeptical Researcher Proof Check
- `D34` Request Human Setup Help
- `D35` Blog Visitor Converts To Product Interest
- `D36` Privacy And Trust Before Data Use
