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

### D01: Dashboard Orientation

The user opens the dashboard without knowing where to start. Judge whether the assistant, existing chats, datasets, and account state are understandable without CLI knowledge.

### D02: Dataset Inventory

The user wants to see what datasets are available before choosing work. Judge whether dataset names, descriptions, grouping, and readiness are scannable.

### D03: Dataset Detail And Briefing

The user opens a ready dataset to understand research fitness. Judge whether description, briefing, profile metrics, provenance, schema, limitations, and describe action are clear.

### D04: Start Dataset Describe From Detail

The user clicks `Describe dataset`. Judge whether the transition into run monitoring is understandable and whether artifact expectations are visible.

### D05: Runs Inventory

The user wants to monitor recent work across datasets. Judge whether completed, running, and uncertain states are easy to distinguish.

### D06: Completed Run Transcript And Artifacts

The user opens a completed run and then opens artifacts. Judge transcript readability, artifact discoverability, names, and content preview.

### D07: Running Run Status

The user opens an in-progress run. Judge whether the dashboard shows aliveness, last activity, and current work without implying false certainty.

### D08: Terminal Session Continuity

The user opens a persisted terminal session. Judge whether command output and synthesis are readable and whether raw ids or implementation terms are over-emphasized.
