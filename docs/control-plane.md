# Control Plane Contract

The control plane in `src/control-plane.ts` owns durable state for datasets, runs, artifacts, assistant sessions, and runner pool entries.

## Required Run Debug Shape

`GET /runs/:id/debug-view` must return enough information for an agent to understand the run without needing dashboard-specific logic:

- run id, dataset id, type, status, prompt, timestamps
- requested artifacts
- produced artifact summaries
- event count and last event
- terminal status flag
- active/stale health signal
- remote Codex session id when available
- session kinds and entry counts

## State Transition Expectations

- New work starts as `queued` or `running`.
- Runner callbacks append events and update status.
- Terminal statuses are `ready`, `completed`, `failed`, `cancelled`, `canceled`, or `error`.
- Stale heartbeats fail the run and release the dataset lease.
- All state transitions that matter to a human should append a run event.

## Runner Resource Contract

Run metadata can include `config.resources`:

```json
{
  "runnerSize": "s-8vcpu-16gb",
  "workspaceDiskGb": 500
}
```

When present, the control plane must honor it before launching the remote agent:

- `runnerSize` is the DigitalOcean droplet size used for the run.
- `workspaceDiskGb` is the minimum dataset/workspace volume capacity; existing smaller volumes are resized before attachment.
- Explicit resource requests use a dedicated runner, not the warm pool, because pooled runners are only keyed by coarse size class.

## Boundary Rules

- External providers are accessed through provider modules, not UI code.
- Runner callbacks are authenticated with `RESEARCH_INTERNAL_RUNNER_TOKEN`.
- Artifacts are stored through `run_artifacts`; transcripts should be captured as artifacts or assistant session entries.
