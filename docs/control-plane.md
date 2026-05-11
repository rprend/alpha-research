# Control Plane Contract

The control plane in `src/control-plane.ts` owns durable state for datasets, runs, artifacts, and assistant sessions.

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

## Modal Runner Contract

Remote run metadata can include `config.resources`, but the control plane always submits execution to Modal. Modal jobs mount the shared public dataset volume at `/data`, use `/workspace` for writable scratch, and write final outputs plus worker state under `/results/<job id>/`.

- Ordinary analysis jobs receive `/data` as read-only and must write deliverables under `/results/<job id>/`.
- Dataset deploy and environment jobs may write normalized dataset files under `/data/datasets/<dataset id>`.
- Failed public/research environment launches must move the dataset to `failed` so stale provisioning rows are visible and retryable.

## Boundary Rules

- External providers are accessed through provider modules, not UI code.
- Runner callbacks are authenticated with `RESEARCH_INTERNAL_RUNNER_TOKEN`.
- Artifacts are stored through `run_artifacts`; transcripts should be captured as artifacts or assistant session entries.
- Remote Codex runners may receive `EXA_API_KEY` and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` as environment variables for canonical dataset-improvement jobs. Workers must not write credentials into prompts, logs, artifacts, or mounted volumes.
- Modal worker submission uses `MODAL_AGENT_ENDPOINT_URL` and optional `MODAL_AGENT_SUBMIT_TOKEN`. These values are control-plane secrets and must not be exposed to frontend code.

## Infrastructure Test Cases

Run the deterministic contract checks with `pnpm run test:infra`. Run the live deployed smoke test with `pnpm run smoke:infra:live` when a RESEARCH CLI session is available.

- Failed public/research environment launches update both dataset `deployment_status` and `status` to `failed`.
- Runner launch, status, event, and artifact callback routes remain wired.
- Remote runner bootstrap forwards Exa and canonical Slack webhook secrets so dataset-improvement jobs can search the web and notify the owner without embedding credentials in prompts.
- Modal provider files exist and keep `/data` read-only for ordinary workers.
- Modal runner state and outputs are written under `/results/<job id>`, not under `/data`.
- Live canonical datasets `econ`, `sociology`, `philosophy`, `history`, `literature`, `political-science`, `anthropology`, `linguistics`, and `classics` are present and ready.
- Completed canonical runs have persisted events and artifacts.
