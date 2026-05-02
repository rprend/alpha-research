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
- Terminal statuses are `ready`, `completed`, `failed`, `cancelled`, `canceled`, `error`, or `worker_unreachable`.
- Stale heartbeats mark the run `worker_unreachable` and release the dataset lease. They do not mark the product execution `failed` unless the worker reported `failed`.
- All state transitions that matter to a human should append a run event.

## Runner Resource Contract

Run metadata can include `config.resources`:

```json
{
  "profile": "canonical-public",
  "runnerSize": "s-8vcpu-16gb",
  "workspaceDiskGb": 50,
  "storageMode": "object-store-versioned",
  "datasetAccess": "read-only-version",
  "publishMode": "versioned"
}
```

When present, the control plane must honor it before launching the remote agent:

- `runnerSize` is the DigitalOcean droplet size used for the run.
- For legacy volume-backed resources, `workspaceDiskGb` is the minimum dataset/workspace volume capacity; existing smaller volumes are resized before attachment.
- For `storageMode: "object-store-versioned"`, `workspaceDiskGb` is runner scratch intent, not a shared dataset volume resize. Canonical public and standard analysis profiles must not resize the dataset volume; `large-ingest` is the only object-store profile that may request a large volume-backed ingest workspace.
- Explicit `runnerSize` requests use a dedicated runner, not the warm pool, because pooled runners are only keyed by coarse size class.
- Failed public/research environment launches must move the dataset to `failed` so stale provisioning rows are visible and retryable.

## Boundary Rules

- External providers are accessed through provider modules, not UI code.
- Runner callbacks are authenticated with `RESEARCH_INTERNAL_RUNNER_TOKEN`.
- Artifacts are stored through `run_artifacts`; transcripts should be captured as artifacts or assistant session entries.
