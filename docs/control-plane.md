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

- `runnerSize` is the provider-specific runner size used for the run. For legacy DigitalOcean runs, it is the droplet size.
- For legacy volume-backed resources, `workspaceDiskGb` is the minimum dataset/workspace volume capacity; existing smaller volumes are resized before attachment.
- For `storageMode: "object-store-versioned"`, `workspaceDiskGb` is runner scratch intent, not a shared dataset volume resize. Canonical public and standard analysis profiles must not resize the dataset volume; `large-ingest` is the only object-store profile that may request a large volume-backed ingest workspace.
- Explicit `runnerSize` requests use a dedicated runner, not the warm pool, because pooled runners are only keyed by coarse size class.
- Failed public/research environment launches must move the dataset to `failed` so stale provisioning rows are visible and retryable.

## Boundary Rules

- External providers are accessed through provider modules, not UI code.
- Runner callbacks are authenticated with `RESEARCH_INTERNAL_RUNNER_TOKEN`.
- Artifacts are stored through `run_artifacts`; transcripts should be captured as artifacts or assistant session entries.
- Remote Codex runners may receive `EXA_API_KEY` and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` as environment variables for canonical dataset-improvement jobs. These are worker secrets and must not be written into prompts, artifacts, logs, or repository files.
- `REMOTE_AGENT_EXECUTOR=modal` routes ordinary research runs to the Modal worker provider. Modal jobs mount the shared public dataset volume at `/data`, use `/workspace` for writable scratch, and write final outputs plus worker state under `/results/<job id>/`.
- Modal worker submission uses `MODAL_AGENT_ENDPOINT_URL` and optional `MODAL_AGENT_SUBMIT_TOKEN`. These values are control-plane secrets and must not be exposed to frontend code.

## Infrastructure Test Cases

Run the deterministic contract checks with `pnpm run test:infra`. Run the live deployed smoke test with `pnpm run smoke:infra:live` when a RESEARCH CLI session and `doctl` context are available.

- Object-store canonical and standard-analysis resource profiles parse `storageMode`, `datasetAccess`, and `publishMode`.
- Object-store profiles skip shared dataset volume resize unless the profile is `large-ingest`.
- Skipped volume resize writes a durable run event for auditability.
- Failed public/research environment launches update both dataset `deployment_status` and `status` to `failed`.
- Runner launch, status, event, and artifact callback routes remain wired.
- Remote runner bootstrap forwards Exa and canonical Slack webhook secrets so dataset-improvement jobs can search the web and notify the owner without embedding credentials in prompts.
- Modal provider files exist and keep `/data` read-only for ordinary workers.
- Modal runner state and outputs are written under `/results/<job id>`, not under `/data`.
- Live canonical datasets `econ`, `sociology`, `philosophy`, `history`, `literature`, `political-science`, `anthropology`, `linguistics`, and `classics` are present and ready.
- New canonical dataset volumes stay at the default 10GiB size; `econ` is allowed as a legacy 500GiB exception until it is migrated safely.
- Completed canonical environment runs have persisted events and artifacts, including the resize-skip event.
- No environment runner droplets remain active after successful completion.
